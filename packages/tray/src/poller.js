// FR-009/FR-010/FR-010a: 状態遷移(前回ポーリング結果との差分)からToast通知すべきイベントを検出する。
// 「監視周期ごとの失敗」ではなく「状態が変化したこと」だけを通知するため、diffベースで検出する。
export function diffEvents(previousTargets, currentTargets) {
  const prevMap = new Map(previousTargets.map((t) => [t.id, t]));
  const events = [];

  for (const target of currentTargets) {
    const prev = prevMap.get(target.id);
    if (!prev || prev.status === target.status) continue;

    if (target.status === 'DOWN') {
      events.push({ type: 'down', target });
    } else if (prev.status === 'DOWN' && target.status === 'RECOVERED') {
      events.push({ type: 'recovered', target, downtimeMs: computeDowntimeMs(target) });
    } else if (target.status === 'WARNING' && target.warningNotifyEnabled) {
      events.push({ type: 'warning', target });
    }
  }

  return events;
}

function computeDowntimeMs(target) {
  if (!target.incidentStartAt || !target.recoveredAt) return null;
  return new Date(target.recoveredAt).getTime() - new Date(target.incidentStartAt).getTime();
}

export function formatDuration(ms) {
  if (ms == null || ms < 0) return '-';
  const totalSec = Math.round(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export async function fetchStatus(serverUrl) {
  const res = await fetch(new URL('/api/status', serverUrl));
  if (!res.ok) throw new Error(`status request failed: ${res.status}`);
  return res.json();
}

// serverUrlを定期ポーリングし、状態差分イベントをonEventsへ通知する。stop関数を返す。
export function startPolling(serverUrl, { intervalMs = 5000, onStatus, onEvents, onError }) {
  let previousTargets = [];
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const data = await fetchStatus(serverUrl);
      onStatus?.(data);
      const events = diffEvents(previousTargets, data.targets);
      if (events.length > 0) onEvents?.(events);
      previousTargets = data.targets;
    } catch (err) {
      onError?.(err);
    }
  }

  tick();
  const timer = setInterval(tick, intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
