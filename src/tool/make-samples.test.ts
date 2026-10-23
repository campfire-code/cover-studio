// 生成 samples/ 里的示例文件（只在设置了 MAKE_SAMPLES=1 时运行）。背景图是用代码画的渐变和圆点，不含任何他人作品。
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { SAMPLE } from './sample';

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** 写一张 RGB 的 PNG：pixel(x, y) 返回 [r, g, b] */
function png(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * (w * 3 + 1) + 1 + x * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

it.runIf(process.env.MAKE_SAMPLES === '1')('生成示例文件', () => {
  writeFileSync('samples/示例-标题列表.txt', SAMPLE + '\n');
  // 横图 1600×1000：暖色渐变 + 几个柔光圆
  const dots: [number, number, number][] = [[0.75, 0.3, 260], [0.35, 0.65, 180], [0.9, 0.8, 140]];
  writeFileSync('samples/示例背景-暖色渐变.png', png(1600, 1000, (x, y) => {
    const t = (x / 1600) * 0.6 + (y / 1000) * 0.4;
    let r = 250 - t * 60, g = 190 - t * 90, b = 120 + t * 40;
    for (const [cx, cy, rad] of dots) {
      const d = Math.hypot(x - cx * 1600, y - cy * 1000) / rad;
      if (d < 1) { const k = (1 - d * d) * 0.35; r += (255 - r) * k; g += (245 - g) * k; b += (230 - b) * k; }
    }
    return [Math.round(r), Math.round(g), Math.round(b)];
  }));
  // 超长标题和很多行：验证自动缩小与 50 个上限
  const many = Array.from({ length: 55 }, (_, i) => `示例标题第 ${i + 1} 个 | 副标题`).join('\n');
  writeFileSync('samples/示例-55个标题.txt', many + '\n');
});
