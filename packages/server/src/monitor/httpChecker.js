import { isStatusExpected } from './statusPattern.js';

// FR-004: HTTPステータス確認 + タイムアウト/接続エラー/DNSエラー/その他通信エラーの識別
export async function checkTarget(target) {
  const controller = new AbortController();
  const timeoutMs = (target.timeout_sec ?? 5) * 1000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    const responseTimeMs = Math.round(performance.now() - startedAt);
    const success = isStatusExpected(response.status, target.expected_status_pattern ?? '2xx');

    return {
      success,
      httpStatus: response.status,
      responseTimeMs,
      error: success ? null : `HTTP ${response.status}`,
    };
  } catch (err) {
    const responseTimeMs = Math.round(performance.now() - startedAt);
    return { success: false, httpStatus: null, responseTimeMs, error: classifyError(err) };
  } finally {
    clearTimeout(timer);
  }
}

function classifyError(err) {
  if (err.name === 'AbortError') return 'Timeout';

  const code = err.cause?.code ?? err.code;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS Error';
  if (code) return `Connection Error (${code})`;
  return 'Connection Error';
}
