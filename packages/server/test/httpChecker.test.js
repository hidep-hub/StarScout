import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { checkTarget } from '../src/monitor/httpChecker.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test('checkTarget succeeds on 200 response', async () => {
  const server = createServer((req, res) => res.writeHead(200).end('ok'));
  const port = await listen(server);

  try {
    const result = await checkTarget({
      url: `http://127.0.0.1:${port}/`,
      timeout_sec: 5,
      expected_status_pattern: '2xx',
    });
    assert.equal(result.success, true);
    assert.equal(result.httpStatus, 200);
    assert.equal(result.error, null);
    assert.equal(typeof result.responseTimeMs, 'number');
  } finally {
    await close(server);
  }
});

test('checkTarget fails on 500 response by default', async () => {
  const server = createServer((req, res) => res.writeHead(500).end('error'));
  const port = await listen(server);

  try {
    const result = await checkTarget({
      url: `http://127.0.0.1:${port}/`,
      timeout_sec: 5,
      expected_status_pattern: '2xx',
    });
    assert.equal(result.success, false);
    assert.equal(result.httpStatus, 500);
    assert.equal(result.error, 'HTTP 500');
  } finally {
    await close(server);
  }
});

test('checkTarget honors an overridden expected_status_pattern', async () => {
  const server = createServer((req, res) => res.writeHead(500).end('error'));
  const port = await listen(server);

  try {
    const result = await checkTarget({
      url: `http://127.0.0.1:${port}/`,
      timeout_sec: 5,
      expected_status_pattern: '2xx,5xx',
    });
    assert.equal(result.success, true);
    assert.equal(result.httpStatus, 500);
  } finally {
    await close(server);
  }
});

test('checkTarget reports Timeout when the server never responds in time', async () => {
  const server = createServer(() => {
    /* 応答を返さずタイムアウトさせる */
  });
  const port = await listen(server);

  try {
    const result = await checkTarget({
      url: `http://127.0.0.1:${port}/`,
      timeout_sec: 0.2,
      expected_status_pattern: '2xx',
    });
    assert.equal(result.success, false);
    assert.equal(result.httpStatus, null);
    assert.equal(result.error, 'Timeout');
  } finally {
    await close(server);
  }
});

test('checkTarget reports a connection error when nothing is listening', async () => {
  const result = await checkTarget({
    url: 'http://127.0.0.1:1/',
    timeout_sec: 5,
    expected_status_pattern: '2xx',
  });
  assert.equal(result.success, false);
  assert.equal(result.httpStatus, null);
  assert.match(result.error, /Connection Error/);
});
