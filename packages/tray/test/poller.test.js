import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { diffEvents, formatDuration, fetchStatus, startPolling } from '../src/poller.js';

function normal(id, name = 'A') {
  return { id, name, status: 'NORMAL', warningNotifyEnabled: false };
}

test('diffEvents detects a new DOWN transition', () => {
  const prev = [normal(1)];
  const curr = [{ ...normal(1), status: 'DOWN', lastError: 'Timeout' }];
  const events = diffEvents(prev, curr);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'down');
});

test('diffEvents detects recovery and computes downtime', () => {
  const prev = [{ ...normal(1), status: 'DOWN' }];
  const curr = [{
    ...normal(1),
    status: 'RECOVERED',
    incidentStartAt: '2026-09-07T10:02:00.000Z',
    recoveredAt: '2026-09-07T10:05:00.000Z',
  }];
  const events = diffEvents(prev, curr);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'recovered');
  assert.equal(events[0].downtimeMs, 180000);
});

test('diffEvents only fires WARNING when warningNotifyEnabled is true', () => {
  const prev = [normal(1)];

  const disabled = diffEvents(prev, [{ ...normal(1), status: 'WARNING', warningNotifyEnabled: false }]);
  assert.equal(disabled.length, 0);

  const enabled = diffEvents(prev, [{ ...normal(1), status: 'WARNING', warningNotifyEnabled: true }]);
  assert.equal(enabled.length, 1);
  assert.equal(enabled[0].type, 'warning');
});

test('diffEvents ignores unchanged status and unknown targets', () => {
  const prev = [normal(1)];
  assert.equal(diffEvents(prev, [normal(1)]).length, 0);
  assert.equal(diffEvents(prev, [normal(2)]).length, 0);
});

test('formatDuration formats seconds and minutes', () => {
  assert.equal(formatDuration(45000), '45s');
  assert.equal(formatDuration(252000), '4m 12s');
  assert.equal(formatDuration(null), '-');
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}
function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test('fetchStatus retrieves /api/status from the given server URL', async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ summary: { normal: 1 }, targets: [normal(1)] }));
  });
  const port = await listen(server);

  try {
    const data = await fetchStatus(`http://127.0.0.1:${port}`);
    assert.equal(data.summary.normal, 1);
    assert.equal(data.targets.length, 1);
  } finally {
    await close(server);
  }
});

test('startPolling calls onStatus/onEvents and can be stopped', async () => {
  let call = 0;
  const responses = [
    { summary: {}, targets: [normal(1)] },
    { summary: {}, targets: [{ ...normal(1), status: 'DOWN', lastError: 'Timeout' }] },
  ];

  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responses[Math.min(call++, responses.length - 1)]));
  });
  const port = await listen(server);

  const statuses = [];
  const eventBatches = [];

  try {
    const stop = startPolling(`http://127.0.0.1:${port}`, {
      intervalMs: 20,
      onStatus: (data) => statuses.push(data),
      onEvents: (events) => eventBatches.push(events),
    });

    await new Promise((resolve) => setTimeout(resolve, 60));
    stop();

    assert.ok(statuses.length >= 2);
    assert.ok(eventBatches.some((batch) => batch.some((e) => e.type === 'down')));
  } finally {
    await close(server);
  }
});
