import { deflateSync } from 'node:zlib';

// FR-011: 状態を表す色付きの丸アイコンを追加依存なし(node:zlib)でPNG生成する。
const STATUS_COLORS = {
  NORMAL: [34, 197, 94],
  WARNING: [234, 179, 8],
  DOWN: [239, 68, 68],
  UNKNOWN: [100, 116, 139],
};

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// size x size のRGBA円形アイコンをPNGバイナリとして生成する
export function createDotIconPng(size, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  const center = (size - 1) / 2;
  const radius = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // フィルタタイプ: none
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const inside = Math.sqrt(dx * dx + dy * dy) <= radius;
      const idx = rowStart + 1 + x * 4;
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = inside ? 255 : 0;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function createStatusIconPng(status, size = 32) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.UNKNOWN;
  return createDotIconPng(size, color);
}

// 複数の監視対象の状態から、Tray全体アイコンに使う代表状態を1つ決める。
// 深刻度: DOWN > WARNING > UNKNOWN > NORMAL
export function aggregateStatus(targets) {
  if (targets.some((t) => t.status === 'DOWN')) return 'DOWN';
  if (targets.some((t) => t.status === 'WARNING')) return 'WARNING';
  if (targets.length > 0 && targets.some((t) => t.status === 'UNKNOWN')) return 'UNKNOWN';
  return 'NORMAL';
}
