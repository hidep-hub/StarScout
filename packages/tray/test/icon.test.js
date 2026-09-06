import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDotIconPng, aggregateStatus } from '../src/icon.js';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test('createDotIconPng produces a valid PNG signature and IHDR size', () => {
  const png = createDotIconPng(16, [255, 0, 0]);
  assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE));

  // IHDRチャンク: length(4) + 'IHDR'(4) + width(4) + height(4) + ...
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(width, 16);
  assert.equal(height, 16);
});

test('aggregateStatus prioritizes DOWN > WARNING > UNKNOWN > NORMAL', () => {
  assert.equal(aggregateStatus([{ status: 'NORMAL' }, { status: 'DOWN' }]), 'DOWN');
  assert.equal(aggregateStatus([{ status: 'NORMAL' }, { status: 'WARNING' }]), 'WARNING');
  assert.equal(aggregateStatus([{ status: 'NORMAL' }, { status: 'UNKNOWN' }]), 'UNKNOWN');
  assert.equal(aggregateStatus([{ status: 'NORMAL' }, { status: 'RECOVERED' }]), 'NORMAL');
  assert.equal(aggregateStatus([]), 'NORMAL');
});
