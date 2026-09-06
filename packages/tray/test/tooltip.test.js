import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTooltip } from '../src/tooltip.js';

test('buildTooltip reports all-normal when nothing is DOWN', () => {
  const tooltip = buildTooltip([{ status: 'NORMAL' }, { status: 'WARNING' }]);
  assert.equal(tooltip, 'StarScout\n✅ All systems normal');
});

test('buildTooltip lists DOWN targets with their reason', () => {
  const tooltip = buildTooltip([
    { status: 'NORMAL', name: 'OK Service' },
    { status: 'DOWN', name: '社内ポータル', lastError: 'HTTP 500' },
    { status: 'DOWN', name: 'Web API', lastError: 'Timeout' },
  ]);

  assert.match(tooltip, /2 sites DOWN/);
  assert.match(tooltip, /社内ポータル\s+HTTP 500/);
  assert.match(tooltip, /Web API\s+Timeout/);
});
