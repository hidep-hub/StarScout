import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTransition } from '../src/monitor/stateMachine.js';

function ok(responseTimeMs = 100) {
  return { success: true, httpStatus: 200, responseTimeMs, error: null };
}

function fail(error = 'Timeout') {
  return { success: false, httpStatus: null, responseTimeMs: null, error };
}

test('UNKNOWN -> NORMAL on first successful check', () => {
  const result = evaluateTransition({
    currentStatus: 'UNKNOWN',
    consecutiveFailures: 0,
    checkResult: ok(),
    warningThresholdMs: 2000,
  });
  assert.deepEqual(result, { nextStatus: 'NORMAL', consecutiveFailures: 0, incidentEvent: null });
});

test('UNKNOWN -> WARNING when first check is slow', () => {
  const result = evaluateTransition({
    currentStatus: 'UNKNOWN',
    consecutiveFailures: 0,
    checkResult: ok(3000),
    warningThresholdMs: 2000,
  });
  assert.equal(result.nextStatus, 'WARNING');
});

test('UNKNOWN -> DOWN on first failed check (no 2-strike rule for UNKNOWN)', () => {
  const result = evaluateTransition({
    currentStatus: 'UNKNOWN',
    consecutiveFailures: 0,
    checkResult: fail(),
    warningThresholdMs: 2000,
  });
  assert.deepEqual(result, { nextStatus: 'DOWN', consecutiveFailures: 1, incidentEvent: 'open' });
});

test('NORMAL stays NORMAL on single failure (2-strike rule)', () => {
  const result = evaluateTransition({
    currentStatus: 'NORMAL',
    consecutiveFailures: 0,
    checkResult: fail(),
    warningThresholdMs: 2000,
  });
  assert.deepEqual(result, { nextStatus: 'NORMAL', consecutiveFailures: 1, incidentEvent: null });
});

test('NORMAL -> DOWN on second consecutive failure', () => {
  const result = evaluateTransition({
    currentStatus: 'NORMAL',
    consecutiveFailures: 1,
    checkResult: fail(),
    warningThresholdMs: 2000,
  });
  assert.deepEqual(result, { nextStatus: 'DOWN', consecutiveFailures: 2, incidentEvent: 'open' });
});

test('NORMAL -> WARNING when response is slow', () => {
  const result = evaluateTransition({
    currentStatus: 'NORMAL',
    consecutiveFailures: 0,
    checkResult: ok(2500),
    warningThresholdMs: 2000,
  });
  assert.deepEqual(result, { nextStatus: 'WARNING', consecutiveFailures: 0, incidentEvent: null });
});

test('WARNING -> NORMAL when back within threshold', () => {
  const result = evaluateTransition({
    currentStatus: 'WARNING',
    consecutiveFailures: 0,
    checkResult: ok(100),
    warningThresholdMs: 2000,
  });
  assert.equal(result.nextStatus, 'NORMAL');
});

test('WARNING -> DOWN on second consecutive failure', () => {
  const result = evaluateTransition({
    currentStatus: 'WARNING',
    consecutiveFailures: 1,
    checkResult: fail(),
    warningThresholdMs: 2000,
  });
  assert.deepEqual(result, { nextStatus: 'DOWN', consecutiveFailures: 2, incidentEvent: 'open' });
});

test('DOWN -> RECOVERED on successful check, closes incident', () => {
  const result = evaluateTransition({
    currentStatus: 'DOWN',
    consecutiveFailures: 3,
    checkResult: ok(),
    warningThresholdMs: 2000,
  });
  assert.deepEqual(result, { nextStatus: 'RECOVERED', consecutiveFailures: 0, incidentEvent: 'close' });
});

test('DOWN stays DOWN on continued failure', () => {
  const result = evaluateTransition({
    currentStatus: 'DOWN',
    consecutiveFailures: 3,
    checkResult: fail(),
    warningThresholdMs: 2000,
  });
  assert.deepEqual(result, { nextStatus: 'DOWN', consecutiveFailures: 4, incidentEvent: null });
});

test('RECOVERED -> NORMAL on confirming successful check', () => {
  const result = evaluateTransition({
    currentStatus: 'RECOVERED',
    consecutiveFailures: 0,
    checkResult: ok(),
    warningThresholdMs: 2000,
  });
  assert.deepEqual(result, { nextStatus: 'NORMAL', consecutiveFailures: 0, incidentEvent: null });
});

test('RECOVERED -> DOWN opens a new incident on renewed failure', () => {
  const result = evaluateTransition({
    currentStatus: 'RECOVERED',
    consecutiveFailures: 0,
    checkResult: fail(),
    warningThresholdMs: 2000,
  });
  assert.deepEqual(result, { nextStatus: 'DOWN', consecutiveFailures: 1, incidentEvent: 'open' });
});
