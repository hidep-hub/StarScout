const POLL_INTERVAL_MS = 5000;

const el = {
  countNormal: document.getElementById('count-normal'),
  countWarning: document.getElementById('count-warning'),
  countDown: document.getElementById('count-down'),
  countUnknown: document.getElementById('count-unknown'),
  rows: document.getElementById('target-rows'),
  form: document.getElementById('target-form'),
  toggleFormBtn: document.getElementById('toggle-form-btn'),
  cancelFormBtn: document.getElementById('cancel-form-btn'),
  submitFormBtn: document.getElementById('submit-form-btn'),
  detailModal: document.getElementById('detail-modal'),
  detailTitle: document.getElementById('detail-title'),
  detailCloseBtn: document.getElementById('detail-close-btn'),
  periodTabs: document.getElementById('period-tabs'),
  statAvgResponse: document.getElementById('stat-avg-response'),
  statUptime: document.getElementById('stat-uptime'),
  statIncidentCount: document.getElementById('stat-incident-count'),
  statDowntime: document.getElementById('stat-downtime'),
  responseChart: document.getElementById('response-chart'),
  detailInitialTitle: document.getElementById('detail-initial-title'),
  detailCurrentTitle: document.getElementById('detail-current-title'),
  detailTitleChangedBadge: document.getElementById('detail-title-changed-badge'),
  detailKeywordRow: document.getElementById('detail-keyword-row'),
  detailKeywordStatus: document.getElementById('detail-keyword-status'),
};

let targetsCache = [];
let editingId = null;
let detailTargetId = null;
let detailPeriod = '24h';

function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ja-JP', { hour12: false });
}

function statusLabel(status) {
  return status === 'RECOVERED' ? 'RECOVERED' : status;
}

function renderTargets(targets) {
  targetsCache = targets;

  if (targets.length === 0) {
    el.rows.innerHTML = '<tr><td colspan="8" class="empty">監視対象がまだ登録されていません</td></tr>';
    return;
  }

  el.rows.innerHTML = targets
    .map((t) => `
      <tr>
        <td><span class="status-badge ${t.status.toLowerCase()}">${statusLabel(t.status)}</span></td>
        <td>
          ${escapeHtml(t.name)}
          ${t.titleChangedAt ? '<span class="badge-changed" title="ページタイトルが変わりました">タイトル変更</span>' : ''}
        </td>
        <td><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">${escapeHtml(t.url)}</a></td>
        <td>${t.lastHttpStatus ?? '-'}</td>
        <td>${t.lastResponseTimeMs != null ? `${t.lastResponseTimeMs} ms` : '-'}</td>
        <td>${formatDateTime(t.lastCheckedAt)}</td>
        <td>${formatDateTime(t.incidentStartAt)}</td>
        <td>
          <button class="row-detail" data-id="${t.id}">詳細</button>
          <button class="row-edit" data-id="${t.id}">編集</button>
          <button class="row-delete" data-id="${t.id}">削除</button>
        </td>
      </tr>
    `)
    .join('');

  el.rows.querySelectorAll('.row-detail').forEach((btn) => {
    btn.addEventListener('click', () => openDetail(btn.dataset.id));
  });
  el.rows.querySelectorAll('.row-edit').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(btn.dataset.id));
  });
  el.rows.querySelectorAll('.row-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteTarget(btn.dataset.id));
  });
}

function formatDurationSec(sec) {
  if (sec == null) return '-';
  if (sec < 60) return `${sec}秒`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`;
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  return `${hours}時間${minutes}分`;
}

// 応答時間の推移をSVG折れ線グラフとして描画する(チャートライブラリ非依存)
function buildResponseChartSvg(historyRows) {
  const width = 600;
  const height = 160;
  const paddingX = 8;
  const paddingY = 12;

  const rows = [...historyRows].reverse(); // APIはchecked_at降順のため、古い→新しい順に並べ替える
  const validValues = rows.map((r) => r.response_time_ms).filter((v) => v != null);

  if (validValues.length === 0) {
    return '<p class="chart-empty">表示できるデータがありません</p>';
  }

  const maxValue = Math.max(...validValues, 1);
  const stepX = rows.length > 1 ? (width - paddingX * 2) / (rows.length - 1) : 0;

  const points = rows.map((r, i) => {
    if (r.response_time_ms == null) return null;
    const x = paddingX + stepX * i;
    const y = height - paddingY - (r.response_time_ms / maxValue) * (height - paddingY * 2);
    return [x, y];
  });

  // DOWN等で応答時間がnullの箇所は線を途切れさせるため、連続区間ごとにpolylineを分ける
  const segments = [];
  let current = [];
  points.forEach((p) => {
    if (p == null) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push(p);
    }
  });
  if (current.length > 0) segments.push(current);

  const polylines = segments
    .map(
      (seg) =>
        `<polyline points="${seg.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" class="chart-line" />`,
    )
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="response-chart-svg" preserveAspectRatio="none">
      <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" class="chart-baseline" />
      ${polylines}
    </svg>
    <p class="chart-meta">最大 ${maxValue} ms(直近${rows.length}件)</p>
  `;
}

async function loadDetail() {
  if (detailTargetId == null) return;

  el.responseChart.innerHTML = '<p class="chart-empty">読み込み中...</p>';

  const [stats, history] = await Promise.all([
    fetch(`/api/targets/${detailTargetId}/stats?period=${detailPeriod}`).then((res) => res.json()),
    fetch(`/api/targets/${detailTargetId}/history?limit=200`).then((res) => res.json()),
  ]);

  el.statAvgResponse.textContent = stats.avgResponseTimeMs != null ? `${stats.avgResponseTimeMs} ms` : '-';
  el.statUptime.textContent = `${stats.uptimePercent.toFixed(2)}%`;
  el.statIncidentCount.textContent = `${stats.incidentCount}件`;
  el.statDowntime.textContent = formatDurationSec(stats.totalDowntimeSec);
  el.responseChart.innerHTML = buildResponseChartSvg(history);
}

function renderContentSection(target) {
  el.detailInitialTitle.textContent = target.initialPageTitle ?? '(未取得)';
  el.detailCurrentTitle.textContent = target.lastPageTitle ?? '(未取得)';
  el.detailTitleChangedBadge.hidden = !target.titleChangedAt;

  el.detailKeywordRow.hidden = !target.keyword;
  if (target.keyword) {
    const matched = target.lastError !== 'Keyword Not Found';
    el.detailKeywordStatus.textContent = `"${target.keyword}" ${matched ? '検出' : '未検出'}`;
  }
}

function openDetail(id) {
  const target = targetsCache.find((t) => String(t.id) === String(id));
  if (!target) return;

  detailTargetId = target.id;
  detailPeriod = '24h';
  el.detailTitle.textContent = `詳細: ${target.name}`;
  el.periodTabs.querySelectorAll('.period-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.period === detailPeriod);
  });
  renderContentSection(target);
  el.detailModal.hidden = false;
  loadDetail();
}

function closeDetail() {
  detailTargetId = null;
  el.detailModal.hidden = true;
}

el.detailCloseBtn.addEventListener('click', closeDetail);
el.detailModal.addEventListener('click', (event) => {
  if (event.target === el.detailModal) closeDetail();
});
el.periodTabs.querySelectorAll('.period-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    detailPeriod = btn.dataset.period;
    el.periodTabs.querySelectorAll('.period-tab').forEach((b) => b.classList.toggle('active', b === btn));
    loadDetail();
  });
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function refresh() {
  const res = await fetch('/api/status');
  const data = await res.json();

  el.countNormal.textContent = data.summary.normal;
  el.countWarning.textContent = data.summary.warning;
  el.countDown.textContent = data.summary.down;
  el.countUnknown.textContent = data.summary.unknown;

  renderTargets(data.targets);
}

async function deleteTarget(id) {
  if (!confirm('この監視対象を削除しますか?')) return;
  await fetch(`/api/targets/${id}`, { method: 'DELETE' });
  if (String(editingId) === String(id)) resetForm();
  refresh();
}

function startEdit(id) {
  const target = targetsCache.find((t) => String(t.id) === String(id));
  if (!target) return;

  editingId = target.id;
  el.form.elements.name.value = target.name;
  el.form.elements.url.value = target.url;
  // /api/status のtarget項目には監視設定の詳細(interval/timeout等)が含まれないため、
  // 個別取得APIから現在値を補完する
  fetch(`/api/targets/${target.id}`)
    .then((res) => res.json())
    .then((full) => {
      el.form.elements.intervalSec.value = full.interval_sec;
      el.form.elements.timeoutSec.value = full.timeout_sec;
      el.form.elements.expectedStatusPattern.value = full.expected_status_pattern;
      el.form.elements.warningThresholdMs.value = full.warning_threshold_ms;
      el.form.elements.warningNotifyEnabled.checked = !!full.warning_notify_enabled;
      el.form.elements.keyword.value = full.keyword ?? '';
    });

  el.submitFormBtn.textContent = '更新';
  el.form.hidden = false;
  el.form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetForm() {
  editingId = null;
  el.form.reset();
  el.form.hidden = true;
  el.submitFormBtn.textContent = '登録';
}

el.toggleFormBtn.addEventListener('click', () => {
  if (!el.form.hidden) {
    resetForm();
    return;
  }
  editingId = null;
  el.submitFormBtn.textContent = '登録';
  el.form.hidden = false;
});

el.cancelFormBtn.addEventListener('click', resetForm);

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(el.form);

  const payload = {
    name: formData.get('name'),
    url: formData.get('url'),
    intervalSec: Number(formData.get('intervalSec')),
    timeoutSec: Number(formData.get('timeoutSec')),
    expectedStatusPattern: formData.get('expectedStatusPattern'),
    warningThresholdMs: Number(formData.get('warningThresholdMs')),
    warningNotifyEnabled: formData.get('warningNotifyEnabled') === 'on',
    keyword: formData.get('keyword') || null,
  };

  const url = editingId ? `/api/targets/${editingId}` : '/api/targets';
  const method = editingId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    resetForm();
    refresh();
  } else {
    const err = await res.json();
    alert(`保存に失敗しました: ${err.error ?? 'unknown error'}`);
  }
});

refresh();
setInterval(refresh, POLL_INTERVAL_MS);
