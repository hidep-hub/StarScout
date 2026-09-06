// FR-001: 登録時に初期ページタイトルを自動取得して保持するのみ(状態判定には使わない)
async function fetchPageTitle(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const html = await response.text();
    const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function serializeTarget(storage, target) {
  return { ...target, state: storage.state.get(target.id) };
}

export function registerTargetRoutes(router, storage, engine) {
  router.get('/api/targets', async ({ sendJson, res }) => {
    sendJson(res, 200, storage.targets.findAll().map((t) => serializeTarget(storage, t)));
  });

  router.get('/api/targets/:id', async ({ params, sendJson, res }) => {
    const target = storage.targets.findById(Number(params.id));
    if (!target) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    sendJson(res, 200, serializeTarget(storage, target));
  });

  router.post('/api/targets', async ({ body, sendJson, res }) => {
    if (!body?.name || !body?.url) {
      sendJson(res, 400, { error: 'name and url are required' });
      return;
    }

    const initialPageTitle = await fetchPageTitle(body.url);
    const target = storage.targets.create({ ...body, initialPageTitle });

    if (target.enabled) {
      engine.scheduleTarget(target);
      engine.runCheck(target).catch(() => {});
    }

    sendJson(res, 201, serializeTarget(storage, target));
  });

  // FR-015: 設定変更はWeb UI/APIからDBへ即時反映し、Monitor Engineのスケジュールも同時に更新する
  router.put('/api/targets/:id', async ({ params, body, sendJson, res }) => {
    const id = Number(params.id);
    const target = storage.targets.update(id, body ?? {});
    if (!target) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }

    if (target.enabled) {
      engine.scheduleTarget(target);
    } else {
      engine.unscheduleTarget(target.id);
    }

    sendJson(res, 200, serializeTarget(storage, target));
  });

  router.delete('/api/targets/:id', async ({ params, sendJson, res }) => {
    const id = Number(params.id);
    engine.unscheduleTarget(id);
    const removed = storage.targets.remove(id);
    sendJson(res, removed ? 200 : 404, removed ? { ok: true } : { error: 'not found' });
  });

  router.get('/api/targets/:id/history', async ({ params, query, sendJson, res }) => {
    const id = Number(params.id);
    const limit = Number(query.get('limit') ?? 100);
    sendJson(res, 200, storage.history.findByTarget(id, { limit }));
  });

  router.get('/api/targets/:id/incidents', async ({ params, query, sendJson, res }) => {
    const id = Number(params.id);
    const limit = Number(query.get('limit') ?? 50);
    sendJson(res, 200, storage.incidents.findByTarget(id, { limit }));
  });
}
