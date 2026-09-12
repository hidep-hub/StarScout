import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotificationPlan } from '../src/notifications.js';

function downEvent(name, targetOverrides = {}) {
  return { type: 'down', target: { name, url: 'https://example.com', lastError: 'Timeout', ...targetOverrides } };
}

function recoveredEvent(name, targetOverrides = {}) {
  return {
    type: 'recovered',
    target: { name, lastHttpStatus: 200, ...targetOverrides },
    downtimeMs: 60000,
  };
}

function warningEvent(name, targetOverrides = {}) {
  return {
    type: 'warning',
    target: { name, url: 'https://example.com', lastResponseTimeMs: 3000, ...targetOverrides },
  };
}

test('buildNotificationPlan returns nothing for an empty batch', () => {
  assert.deepEqual(buildNotificationPlan([]), []);
});

test('buildNotificationPlan builds one notification per event when under the threshold', () => {
  const plan = buildNotificationPlan([downEvent('A'), recoveredEvent('B')]);
  assert.equal(plan.length, 2);
  assert.match(plan[0].title, /A is DOWN/);
  assert.match(plan[1].title, /B recovered/);
});

test('buildNotificationPlan collapses into a single summary once the threshold is exceeded', () => {
  const events = [downEvent('A'), downEvent('B'), warningEvent('C'), recoveredEvent('D')];
  const plan = buildNotificationPlan(events, { threshold: 3 });

  assert.equal(plan.length, 1);
  assert.match(plan[0].title, /4件の状態変化/);
  assert.match(plan[0].body, /DOWN: 2件/);
  assert.match(plan[0].body, /RECOVERED: 1件/);
  assert.match(plan[0].body, /SLOW: 1件/);
});

test('buildNotificationPlan truncates the listed target names for large batches', () => {
  const events = Array.from({ length: 40 }, (_, i) => downEvent(`site-${i}`));
  const plan = buildNotificationPlan(events, { threshold: 3 });

  assert.equal(plan.length, 1);
  assert.match(plan[0].title, /40件の状態変化/);
  assert.match(plan[0].body, /他35件/);
});

test('buildNotificationPlan respects a custom threshold', () => {
  const events = [downEvent('A'), downEvent('B')];
  assert.equal(buildNotificationPlan(events, { threshold: 1 }).length, 1);
  assert.equal(buildNotificationPlan(events, { threshold: 5 }).length, 2);
});

test('buildNotificationPlan with threshold: Infinity always sends individual notifications (SS-028 "always individual" mode)', () => {
  const events = Array.from({ length: 40 }, (_, i) => downEvent(`site-${i}`));
  const plan = buildNotificationPlan(events, { threshold: Infinity });
  assert.equal(plan.length, 40);
});

test('buildNotificationPlan with globalMode: individual always sends individual notifications, ignoring per-target settings (SS-030)', () => {
  const events = [downEvent('A'), downEvent('B'), downEvent('C'), downEvent('D')];
  const plan = buildNotificationPlan(events, { globalMode: 'individual', threshold: 1 });
  assert.equal(plan.length, 4);
});

test('buildNotificationPlan excludes per-target "always individual" events from aggregation (SS-030)', () => {
  const events = [
    downEvent('noisy-1'),
    downEvent('noisy-2'),
    downEvent('noisy-3'),
    downEvent('noisy-4'),
    downEvent('important-site', { notificationMode: 'individual' }),
  ];
  const plan = buildNotificationPlan(events, { threshold: 3 });

  // important-siteは単独の個別通知、残りのnoisy4件は閾値超えなので1件のサマリにまとまる
  assert.equal(plan.length, 2);
  assert.ok(plan.some((p) => p.title.includes('important-site')));
  assert.ok(plan.some((p) => p.title.includes('4件の状態変化')));
});

test('buildNotificationPlan sends per-target "always individual" events individually even when the aggregatable remainder stays under threshold (SS-030)', () => {
  const events = [downEvent('noisy-1'), downEvent('important-site', { notificationMode: 'individual' })];
  const plan = buildNotificationPlan(events, { threshold: 3 });

  assert.equal(plan.length, 2);
  assert.ok(plan.some((p) => p.title.includes('noisy-1')));
  assert.ok(plan.some((p) => p.title.includes('important-site')));
});
