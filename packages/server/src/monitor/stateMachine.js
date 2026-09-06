// docs/00_requirements/03_monitoring_state_and_notification.md の状態遷移表に対応する純粋関数。
//
// UNKNOWN ── 初回チェック完了 ──→ NORMAL / DOWN
// NORMAL  ── 2回連続失敗     ──→ DOWN
// NORMAL  ── 遅延閾値超過    ──→ WARNING
// WARNING ── check OK(閾値内) ──→ NORMAL
// WARNING ── 2回連続失敗     ──→ DOWN
// DOWN    ── check OK        ──→ RECOVERED ──→ (次回check OK確定で)NORMAL
export function evaluateTransition({ currentStatus, consecutiveFailures, checkResult, warningThresholdMs }) {
  const { success, responseTimeMs } = checkResult;
  const withinThreshold = success && (responseTimeMs == null || responseTimeMs <= warningThresholdMs);
  const recoveredStatus = () => (withinThreshold ? 'NORMAL' : 'WARNING');

  // UNKNOWN/RECOVEREDは「次の1回のチェック結果」で即座にNORMAL系/DOWNへ確定する特殊状態。
  // 2回連続失敗ルールはNORMAL/WARNINGからの遷移にのみ適用する。
  if (currentStatus === 'UNKNOWN' || currentStatus === 'RECOVERED') {
    if (success) {
      return { nextStatus: recoveredStatus(), consecutiveFailures: 0, incidentEvent: null };
    }
    return { nextStatus: 'DOWN', consecutiveFailures: 1, incidentEvent: 'open' };
  }

  if (currentStatus === 'DOWN') {
    if (success) {
      return { nextStatus: 'RECOVERED', consecutiveFailures: 0, incidentEvent: 'close' };
    }
    return { nextStatus: 'DOWN', consecutiveFailures: consecutiveFailures + 1, incidentEvent: null };
  }

  // NORMAL または WARNING
  if (success) {
    return { nextStatus: recoveredStatus(), consecutiveFailures: 0, incidentEvent: null };
  }

  const nextFailures = consecutiveFailures + 1;
  if (nextFailures >= 2) {
    return { nextStatus: 'DOWN', consecutiveFailures: nextFailures, incidentEvent: 'open' };
  }
  return { nextStatus: currentStatus, consecutiveFailures: nextFailures, incidentEvent: null };
}
