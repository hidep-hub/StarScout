// SS-024: 相関障害(社内オンプレ基盤の混雑等)で同一tick内に多数のイベントが発生すると、
// Windows Toast(Notification API)の同期連続呼び出しがメインプロセスをブロックし、
// 「PC全体が固まったような」挙動につながる。イベント件数が閾値を超えたら
// 個別通知ではなく1件のサマリ通知にまとめ、ネイティブ通知APIの呼び出し回数を抑える。
import { formatDuration } from './poller.js';

const DEFAULT_THRESHOLD = 3;
const MAX_LISTED_TARGETS = 5;

const EVENT_LABELS = {
  down: { emoji: '\u{1F534}', label: 'DOWN' },
  recovered: { emoji: '\u{1F7E2}', label: 'RECOVERED' },
  warning: { emoji: '\u{1F7E1}', label: 'SLOW' },
};

function buildIndividualNotification(event) {
  if (event.type === 'down') {
    return {
      title: `\u{1F534} ${event.target.name} is DOWN`,
      body: `${event.target.url}\n\nReason: ${event.target.lastError ?? 'unknown'}`,
    };
  }
  if (event.type === 'recovered') {
    return {
      title: `\u{1F7E2} ${event.target.name} recovered`,
      body: `HTTP ${event.target.lastHttpStatus ?? '-'}\nDowntime: ${formatDuration(event.downtimeMs)}`,
    };
  }
  if (event.type === 'warning') {
    return {
      title: `\u{1F7E1} ${event.target.name} is slow`,
      body: `${event.target.url}\n\nResponse time: ${event.target.lastResponseTimeMs} ms`,
    };
  }
  return null;
}

function buildSummaryNotification(events) {
  const counts = {};
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;

  const countLine = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([type, n]) => `${EVENT_LABELS[type].emoji} ${EVENT_LABELS[type].label}: ${n}件`)
    .join(' / ');

  const names = events.slice(0, MAX_LISTED_TARGETS).map((e) => e.target.name);
  const remaining = events.length - names.length;
  const nameLine = remaining > 0 ? `${names.join(', ')} 他${remaining}件` : names.join(', ');

  return {
    title: `⚠️ ${events.length}件の状態変化を検知`,
    body: `${countLine}\n${nameLine}`,
  };
}

function buildAggregatablePlan(events, threshold) {
  if (events.length === 0) return [];
  if (events.length <= threshold) {
    return events.map(buildIndividualNotification).filter(Boolean);
  }
  return [buildSummaryNotification(events)];
}

// events(1tick分の状態変化)から、実際に発行すべきNotification(title/body)一覧を組み立てる。
// SS-030: globalModeが'individual'(トレイ設定でユーザーが選択)なら常に全件個別通知。
// globalModeが既定の'aggregate'の場合は、サイト単位で「常に個別通知」指定(target.notificationMode
// === 'individual', SS-029でダッシュボードから設定)があるイベントを集約対象から除外して個別に出し、
// 残りは閾値以下なら個別・超えたら1件のサマリにまとめる。
export function buildNotificationPlan(events, { threshold = DEFAULT_THRESHOLD, globalMode = 'aggregate' } = {}) {
  if (events.length === 0) return [];

  if (globalMode === 'individual') {
    return events.map(buildIndividualNotification).filter(Boolean);
  }

  const alwaysIndividual = events.filter((event) => event.target.notificationMode === 'individual');
  const aggregatable = events.filter((event) => event.target.notificationMode !== 'individual');

  const individualNotifications = alwaysIndividual.map(buildIndividualNotification).filter(Boolean);
  return [...individualNotifications, ...buildAggregatablePlan(aggregatable, threshold)];
}
