import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/db/index.js';
import { createMonitorEngine } from '../src/monitor/engine.js';

function ok(responseTimeMs = 100) {
  return { success: true, httpStatus: 200, responseTimeMs, error: null };
}

function fail(error = 'Timeout') {
  return { success: false, httpStatus: null, responseTimeMs: null, error };
}

function okWithTitle(pageTitle, responseTimeMs = 100) {
  return { success: true, httpStatus: 200, responseTimeMs, error: null, pageTitle };
}

// checkFnの戻り値をテストごとに差し替えるためのスタブ
function stubChecker(results) {
  let call = 0;
  return async () => results[Math.min(call++, results.length - 1)];
}

function setupTarget(storage) {
  return storage.targets.create({
    name: 'Test Target',
    url: 'https://example.local',
    warningThresholdMs: 2000,
  });
}

test('runCheck: first success moves target from UNKNOWN to NORMAL, no incident', async () => {
  const storage = createStorage(':memory:');
  const target = setupTarget(storage);
  const engine = createMonitorEngine(storage, { checkFn: stubChecker([ok()]) });

  const events = [];
  engine.on('incident-detected', () => events.push('incident-detected'));

  await engine.runCheck(target);

  const state = storage.state.get(target.id);
  assert.equal(state.status, 'NORMAL');
  assert.equal(events.length, 0);
  assert.equal(storage.history.findByTarget(target.id).length, 1);

  storage.close();
});

test('runCheck: single failure does not open an incident (2-strike rule)', async () => {
  const storage = createStorage(':memory:');
  const target = setupTarget(storage);
  const engine = createMonitorEngine(storage, { checkFn: stubChecker([ok(), fail('Timeout')]) });

  const detected = [];
  engine.on('incident-detected', (evt) => detected.push(evt));

  await engine.runCheck(target); // -> NORMAL
  await engine.runCheck(target); // -> still NORMAL, 1 failure

  const state = storage.state.get(target.id);
  assert.equal(state.status, 'NORMAL');
  assert.equal(state.consecutive_failures, 1);
  assert.equal(detected.length, 0);

  storage.close();
});

test('runCheck: second consecutive failure opens an incident and emits incident-detected', async () => {
  const storage = createStorage(':memory:');
  const target = setupTarget(storage);
  const engine = createMonitorEngine(storage, {
    checkFn: stubChecker([ok(), fail('Timeout'), fail('Timeout')]),
  });

  const detected = [];
  engine.on('incident-detected', (evt) => detected.push(evt));

  await engine.runCheck(target); // NORMAL
  await engine.runCheck(target); // NORMAL, 1 failure
  await engine.runCheck(target); // DOWN, 2 failures

  const state = storage.state.get(target.id);
  assert.equal(state.status, 'DOWN');
  assert.equal(detected.length, 1);

  const openIncident = storage.incidents.findOpenByTarget(target.id);
  assert.ok(openIncident);

  storage.close();
});

test('runCheck: recovery closes the incident and emits incident-recovered', async () => {
  const storage = createStorage(':memory:');
  const target = setupTarget(storage);
  const engine = createMonitorEngine(storage, {
    checkFn: stubChecker([ok(), fail(), fail(), ok()]),
  });

  const recovered = [];
  engine.on('incident-recovered', (evt) => recovered.push(evt));

  await engine.runCheck(target); // NORMAL
  await engine.runCheck(target); // NORMAL, 1 failure
  await engine.runCheck(target); // DOWN
  await engine.runCheck(target); // RECOVERED, incident closed

  const state = storage.state.get(target.id);
  assert.equal(state.status, 'RECOVERED');
  assert.equal(recovered.length, 1);
  assert.equal(storage.incidents.findOpenByTarget(target.id), null);

  const [incident] = storage.incidents.findByTarget(target.id);
  assert.ok(incident.recovered_at);
  assert.ok(incident.duration_sec >= 0);

  storage.close();
});

test('runCheck emits state-changed only when the status actually changes', async () => {
  const storage = createStorage(':memory:');
  const target = setupTarget(storage);
  const engine = createMonitorEngine(storage, { checkFn: stubChecker([ok(), ok(), ok()]) });

  const changes = [];
  engine.on('state-changed', (evt) => changes.push(evt));

  await engine.runCheck(target); // UNKNOWN -> NORMAL (change)
  await engine.runCheck(target); // NORMAL -> NORMAL (no change)
  await engine.runCheck(target); // NORMAL -> NORMAL (no change)

  assert.equal(changes.length, 1);
  assert.equal(changes[0].from, 'UNKNOWN');
  assert.equal(changes[0].to, 'NORMAL');

  storage.close();
});

test('runCheck emits title-changed once, then clears it when the title reverts', async () => {
  const storage = createStorage(':memory:');
  const target = storage.targets.create({
    name: 'Test Target',
    url: 'https://example.local',
    initialPageTitle: 'Original Title',
  });
  const engine = createMonitorEngine(storage, {
    checkFn: stubChecker([
      okWithTitle('Original Title'),
      okWithTitle('Changed Title'),
      okWithTitle('Changed Title'),
      okWithTitle('Original Title'),
    ]),
  });

  const changes = [];
  engine.on('title-changed', (evt) => changes.push(evt));

  await engine.runCheck(target); // タイトル変化なし
  assert.equal(storage.state.get(target.id).title_changed_at, null);

  await engine.runCheck(target); // タイトル変化を検知
  assert.equal(changes.length, 1);
  assert.equal(changes[0].from, 'Original Title');
  assert.equal(changes[0].to, 'Changed Title');
  assert.ok(storage.state.get(target.id).title_changed_at);

  await engine.runCheck(target); // 変化継続中は再emitしない
  assert.equal(changes.length, 1);

  await engine.runCheck(target); // 元のタイトルに戻ったら解除
  assert.equal(storage.state.get(target.id).title_changed_at, null);

  storage.close();
});
