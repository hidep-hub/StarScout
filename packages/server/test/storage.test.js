import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/db/index.js';

function setup() {
  return createStorage(':memory:');
}

test('targets.create initializes target_state as UNKNOWN', () => {
  const storage = setup();
  const target = storage.targets.create({ name: 'Web API', url: 'https://api.example.local' });

  assert.equal(target.name, 'Web API');
  assert.equal(target.enabled, 1);

  const state = storage.state.get(target.id);
  assert.equal(state.status, 'UNKNOWN');
  assert.equal(state.consecutive_failures, 0);

  storage.close();
});

test('targets.findAll / update / remove', () => {
  const storage = setup();
  const a = storage.targets.create({ name: 'A', url: 'https://a.example.local' });
  storage.targets.create({ name: 'B', url: 'https://b.example.local' });

  assert.equal(storage.targets.findAll().length, 2);

  const updated = storage.targets.update(a.id, { name: 'A2', intervalSec: 30 });
  assert.equal(updated.name, 'A2');
  assert.equal(updated.interval_sec, 30);
  assert.equal(updated.url, 'https://a.example.local');

  const removed = storage.targets.remove(a.id);
  assert.equal(removed, true);
  assert.equal(storage.targets.findAll().length, 1);

  storage.close();
});

test('state.update applies partial patch only', () => {
  const storage = setup();
  const target = storage.targets.create({ name: 'A', url: 'https://a.example.local' });

  storage.state.update(target.id, {
    status: 'DOWN',
    consecutiveFailures: 2,
    lastHttpStatus: 500,
  });

  const state = storage.state.get(target.id);
  assert.equal(state.status, 'DOWN');
  assert.equal(state.consecutive_failures, 2);
  assert.equal(state.last_http_status, 500);

  storage.close();
});

test('incidents.open / close computes duration_sec', () => {
  const storage = setup();
  const target = storage.targets.create({ name: 'A', url: 'https://a.example.local' });

  const opened = storage.incidents.open(target.id, '2026-09-07T10:02:00.000Z', 'Timeout');
  assert.equal(opened.recovered_at, null);
  assert.equal(storage.incidents.findOpenByTarget(target.id).id, opened.id);

  const closed = storage.incidents.close(opened.id, '2026-09-07T10:05:00.000Z');
  assert.equal(closed.duration_sec, 180);
  assert.equal(storage.incidents.findOpenByTarget(target.id), null);

  storage.close();
});

test('history.insert / findByTarget / deleteOlderThan', () => {
  const storage = setup();
  const target = storage.targets.create({ name: 'A', url: 'https://a.example.local' });

  storage.history.insert({
    targetId: target.id,
    checkedAt: '2026-06-01T00:00:00.000Z',
    httpStatus: 200,
    responseTimeMs: 120,
    result: 'NORMAL',
  });
  storage.history.insert({
    targetId: target.id,
    checkedAt: '2026-09-07T00:00:00.000Z',
    httpStatus: 500,
    responseTimeMs: null,
    result: 'DOWN',
    error: 'HTTP 500',
  });

  const rows = storage.history.findByTarget(target.id);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].result, 'DOWN'); // checked_at降順

  const deleted = storage.history.deleteOlderThan('2026-07-01T00:00:00.000Z');
  assert.equal(deleted, 1);
  assert.equal(storage.history.findByTarget(target.id).length, 1);

  storage.close();
});
