// SS-011: 実際に監視対象を落とさなくても、Toast通知がどんな見た目になるかを
// 実感できるようにするためのテスト通知シナリオ。
// DOWN検知 -> (数秒後)RECOVERED を連続再生し、一連の流れを体験できるようにする。
const DUMMY_TARGET = {
  name: 'テスト通知',
  url: 'https://example.com',
  lastError: 'Timeout',
  lastHttpStatus: 200,
  lastResponseTimeMs: 120,
};

const RECOVER_AFTER_MS = 3000;

export function buildTestNotificationScenario() {
  return [
    { delayMs: 0, event: { type: 'down', target: DUMMY_TARGET } },
    { delayMs: RECOVER_AFTER_MS, event: { type: 'recovered', target: DUMMY_TARGET, downtimeMs: RECOVER_AFTER_MS } },
  ];
}

// scenarioの各ステップをdelayMs通りにonEventへ流す。テスト用にsetTimeout実装を差し替え可能にする。
export function playTestNotificationScenario(onEvent, { setTimeoutFn = setTimeout } = {}) {
  for (const step of buildTestNotificationScenario()) {
    setTimeoutFn(() => onEvent(step.event), step.delayMs);
  }
}
