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
};

let targetsCache = [];
let editingId = null;

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
        <td>${escapeHtml(t.name)}</td>
        <td><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">${escapeHtml(t.url)}</a></td>
        <td>${t.lastHttpStatus ?? '-'}</td>
        <td>${t.lastResponseTimeMs != null ? `${t.lastResponseTimeMs} ms` : '-'}</td>
        <td>${formatDateTime(t.lastCheckedAt)}</td>
        <td>${formatDateTime(t.incidentStartAt)}</td>
        <td>
          <button class="row-edit" data-id="${t.id}">編集</button>
          <button class="row-delete" data-id="${t.id}">削除</button>
        </td>
      </tr>
    `)
    .join('');

  el.rows.querySelectorAll('.row-edit').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(btn.dataset.id));
  });
  el.rows.querySelectorAll('.row-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteTarget(btn.dataset.id));
  });
}

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
