import { isStatusExpected } from './statusPattern.js';
import { extractPageTitle } from './pageTitle.js';

// FR-004: HTTPステータス確認 + タイムアウト/接続エラー/DNSエラー/その他通信エラーの識別
// Phase2: Page Title変更検知・Keywordチェック(応答本文の読み取りが必要な場合のみbodyを読む)
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
    let success = isStatusExpected(response.status, target.expected_status_pattern ?? '2xx');
    let error = success ? null : `HTTP ${response.status}`;
    let pageTitle = null;

    const needsBody = success && (Boolean(target.keyword) || target.initial_page_title != null);
    if (needsBody) {
      const html = await response.text();
      pageTitle = extractPageTitle(html);

      if (target.keyword && !html.includes(target.keyword)) {
        success = false;
        error = 'Keyword Not Found';
      }
    }

    return { success, httpStatus: response.status, responseTimeMs, error, pageTitle };
  } catch (err) {
    const responseTimeMs = Math.round(performance.now() - startedAt);
    return { success: false, httpStatus: null, responseTimeMs, error: classifyError(err), pageTitle: null };
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
