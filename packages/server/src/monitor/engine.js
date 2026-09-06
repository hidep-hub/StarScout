import { EventEmitter } from 'node:events';
import { checkTarget } from './httpChecker.js';
import { evaluateTransition } from './stateMachine.js';

// check_history.result は NORMAL/WARNING/DOWN のみを許容する(スキーマのCHECK制約)。
// RECOVEREDは「応答は正常に戻った」ことを表すため、履歴上はNORMALとして記録する。
function toHistoryResult(status) {
  return status === 'RECOVERED' ? 'NORMAL' : status;
}

export function createMonitorEngine(storage, { checkFn = checkTarget } = {}) {
  const emitter = new EventEmitter();
  const timers = new Map();

  async function runCheck(target) {
    const checkResult = await checkFn(target);
    const now = new Date().toISOString();
    const previousState = storage.state.get(target.id);

    const { nextStatus, consecutiveFailures, incidentEvent } = evaluateTransition({
      currentStatus: previousState.status,
      consecutiveFailures: previousState.consecutive_failures,
      checkResult,
      warningThresholdMs: target.warning_threshold_ms,
    });

    const statePatch = {
      status: nextStatus,
      consecutiveFailures,
      lastCheckedAt: now,
      lastHttpStatus: checkResult.httpStatus,
      lastResponseTimeMs: checkResult.responseTimeMs,
      lastError: checkResult.error,
    };

    if (incidentEvent === 'open') {
      statePatch.incidentStartAt = now;
      statePatch.recoveredAt = null;
      storage.incidents.open(target.id, now, checkResult.error);
      emitter.emit('incident-detected', { target, at: now, reason: checkResult.error });
    } else if (incidentEvent === 'close') {
      statePatch.recoveredAt = now;
      const openIncident = storage.incidents.findOpenByTarget(target.id);
      if (openIncident) storage.incidents.close(openIncident.id, now);
      emitter.emit('incident-recovered', {
        target,
        at: now,
        httpStatus: checkResult.httpStatus,
        incident: openIncident,
      });
    }

    storage.state.update(target.id, statePatch);

    storage.history.insert({
      targetId: target.id,
      checkedAt: now,
      httpStatus: checkResult.httpStatus,
      responseTimeMs: checkResult.responseTimeMs,
      result: toHistoryResult(nextStatus),
      error: checkResult.error,
    });

    if (nextStatus !== previousState.status) {
      emitter.emit('state-changed', { target, from: previousState.status, to: nextStatus });
    }

    return { checkResult, nextStatus };
  }

  function scheduleTarget(target) {
    unscheduleTarget(target.id);
    const intervalMs = (target.interval_sec ?? 60) * 1000;
    const timer = setInterval(() => {
      runCheck(target).catch((err) => emitter.emit('error', err));
    }, intervalMs);
    timer.unref?.();
    timers.set(target.id, timer);
  }

  function unscheduleTarget(targetId) {
    const timer = timers.get(targetId);
    if (timer) {
      clearInterval(timer);
      timers.delete(targetId);
    }
  }

  function start() {
    const targets = storage.targets.findAll().filter((t) => t.enabled);
    for (const target of targets) {
      scheduleTarget(target);
      runCheck(target).catch((err) => emitter.emit('error', err));
    }
  }

  function stop() {
    for (const timer of timers.values()) clearInterval(timer);
    timers.clear();
  }

  return {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    start,
    stop,
    runCheck,
    scheduleTarget,
    unscheduleTarget,
  };
}
