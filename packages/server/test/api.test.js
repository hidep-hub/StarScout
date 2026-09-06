import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/db/index.js';
import { createRouter } from '../src/api/router.js';
import { registerTargetRoutes } from '../src/api/routes/targets.js';
import { registerStatusRoutes } from '../src/api/routes/status.js';
import { createHttpServer } from '../src/api/server.js';

function stubEngine() {
  const scheduled = new Set();
  return {
    scheduleTarget: (t) => scheduled.add(t.id),
    unscheduleTarget: (id) => scheduled.delete(id),
    runCheck: async () => {},
    scheduled,
  };
}

async function setup() {
  const storage = createStorage(':memory:');
  const engine = stubEngine();
  const router = createRouter();
  registerTargetRoutes(router, storage, engine);
  registerStatusRoutes(router, storage);

  const server = createHttpServer(router);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    storage,
    engine,
    baseUrl,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('POST /api/targets creates a target and schedules it', async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Web API', url: 'http://127.0.0.1:1/' }),
    });
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.name, 'Web API');
    assert.equal(body.state.status, 'UNKNOWN');
    assert.equal(ctx.engine.scheduled.has(body.id), true);
  } finally {
    await ctx.close();
  }
});

test('POST /api/targets rejects missing name/url', async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'no url' }),
    });
    assert.equal(res.status, 400);
  } finally {
    await ctx.close();
  }
});

test('GET /api/targets lists all targets with their state', async () => {
  const ctx = await setup();
  try {
    ctx.storage.targets.create({ name: 'A', url: 'https://a.example.local' });
    ctx.storage.targets.create({ name: 'B', url: 'https://b.example.local' });

    const res = await fetch(`${ctx.baseUrl}/api/targets`);
    const body = await res.json();
    assert.equal(body.length, 2);
    assert.ok(body[0].state);
  } finally {
    await ctx.close();
  }
});

test('PUT /api/targets/:id updates fields and DELETE removes it', async () => {
  const ctx = await setup();
  try {
    const target = ctx.storage.targets.create({ name: 'A', url: 'https://a.example.local' });

    const putRes = await fetch(`${ctx.baseUrl}/api/targets/${target.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A2', enabled: false }),
    });
    assert.equal(putRes.status, 200);
    const updated = await putRes.json();
    assert.equal(updated.name, 'A2');
    assert.equal(updated.enabled, 0);
    assert.equal(ctx.engine.scheduled.has(target.id), false);

    const delRes = await fetch(`${ctx.baseUrl}/api/targets/${target.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    assert.equal(ctx.storage.targets.findById(target.id), null);
  } finally {
    await ctx.close();
  }
});

test('GET /api/status aggregates counts by status', async () => {
  const ctx = await setup();
  try {
    const a = ctx.storage.targets.create({ name: 'A', url: 'https://a.example.local' });
    ctx.storage.targets.create({ name: 'B', url: 'https://b.example.local' });
    ctx.storage.state.update(a.id, { status: 'DOWN' });

    const res = await fetch(`${ctx.baseUrl}/api/status`);
    const body = await res.json();
    assert.equal(body.summary.down, 1);
    assert.equal(body.summary.unknown, 1);
    assert.equal(body.targets.length, 2);
  } finally {
    await ctx.close();
  }
});

test('unknown API route returns 404 JSON', async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/nope`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'not found');
  } finally {
    await ctx.close();
  }
});

test('static file server serves the dashboard index', async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /StarScout/);
  } finally {
    await ctx.close();
  }
});
