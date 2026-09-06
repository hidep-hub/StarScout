// FR-012: タスクトレイTooltipの文字列を組み立てる
export function buildTooltip(targets) {
  const downTargets = targets.filter((t) => t.status === 'DOWN');

  if (downTargets.length === 0) {
    return 'StarScout\n✅ All systems normal';
  }

  const lines = [
    'StarScout',
    `\u{1F534} ${downTargets.length} sites DOWN`,
    '',
    ...downTargets.map((t) => `${t.name}  ${t.lastError ?? (t.lastHttpStatus ? `HTTP ${t.lastHttpStatus}` : '')}`),
  ];

  return lines.join('\n');
}
