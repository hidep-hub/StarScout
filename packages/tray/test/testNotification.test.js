import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTestNotificationScenario, playTestNotificationScenario } from '../src/testNotification.js';

test('buildTestNotificationScenario plays DOWN then RECOVERED for the same dummy target', () => {
  const scenario = buildTestNotificationScenario();
  assert.equal(scenario.length, 2);

  const [down, recovered] = scenario;
  assert.equal(down.event.type, 'down');
  assert.equal(down.delayMs, 0);

  assert.equal(recovered.event.type, 'recovered');
  assert.ok(recovered.delayMs > 0);
  assert.equal(recovered.event.target.name, down.event.target.name);
  assert.equal(recovered.event.downtimeMs, recovered.delayMs);
});

test('playTestNotificationScenario schedules each step via the provided timer', () => {
  const scheduled = [];
  const fakeSetTimeout = (fn, delayMs) => scheduled.push({ fn, delayMs });

  playTestNotificationScenario(() => {}, { setTimeoutFn: fakeSetTimeout });

  assert.equal(scheduled.length, 2);
  assert.equal(scheduled[0].delayMs, 0);
  assert.ok(scheduled[1].delayMs > 0);
});

test('playTestNotificationScenario invokes onEvent with down then recovered', () => {
  const events = [];
  const fakeSetTimeout = (fn) => fn(); // 即時実行して順序だけ検証する

  playTestNotificationScenario((event) => events.push(event), { setTimeoutFn: fakeSetTimeout });

  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'down');
  assert.equal(events[1].type, 'recovered');
});
