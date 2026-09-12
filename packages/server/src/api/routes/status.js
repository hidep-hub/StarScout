// FR-013: ダッシュボード用の全体サマリ(正常/警告/異常件数、現在の障害一覧)
export function registerStatusRoutes(router, storage) {
  router.get('/api/status', async ({ sendJson, res }) => {
    const targets = storage.targets.findAll();
    const summary = { normal: 0, warning: 0, down: 0, unknown: 0 };

    const items = targets.map((target) => {
      const state = storage.state.get(target.id);
      const key = state.status.toLowerCase();
      if (key in summary) summary[key] += 1;
      // RECOVEREDは「直近まで異常だった」ことを示すのでダッシュボード集計上はnormal扱いにする
      if (state.status === 'RECOVERED') summary.normal += 1;

      return {
        id: target.id,
        name: target.name,
        url: target.url,
        enabled: !!target.enabled,
        warningNotifyEnabled: !!target.warning_notify_enabled,
        notificationMode: target.notification_mode,
        status: state.status,
        lastHttpStatus: state.last_http_status,
        lastResponseTimeMs: state.last_response_time_ms,
        lastCheckedAt: state.last_checked_at,
        lastError: state.last_error,
        incidentStartAt: state.incident_start_at,
        recoveredAt: state.recovered_at,
        initialPageTitle: target.initial_page_title,
        lastPageTitle: state.last_page_title,
        titleChangedAt: state.title_changed_at,
        keyword: target.keyword,
      };
    });

    sendJson(res, 200, { summary, targets: items });
  });
}
