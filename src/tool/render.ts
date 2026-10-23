// 封面模板与画布绘制：用页面里的 canvas（兼容 macOS 系统网页引擎与 Windows WebView2），不用 OffscreenCanvas。
// 模板配色是画进图片里的，所以这里写死颜色。
import { TITLE_LH, SUB_LH, coverCrop, layoutCover, shapeOf, type Box, type CoverLayout, type CoverText, type MeasureAt, type Shape, type SizeSpec } from './core';

const SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Microsoft YaHei UI","Noto Sans CJK SC","Source Han Sans SC",sans-serif';
const SERIF = '"Songti SC","STSong","SimSun","Noto Serif CJK SC","Source Han Serif SC",serif';

type G = CanvasRenderingContext2D;
export type Img = HTMLImageElement | ImageBitmap;

export interface Template {
  id: string;
  name: string;
  font: 'sans' | 'serif';
  /** 模板按钮上的两个代表色 */
  swatch: [string, string];
  colors: { title: string; sub: string; tagBg: string; tagText: string; sig: string };
  /** 标题加发光（深色背景用） */
  glow?: string;
  /** 文字区 */
  box(w: number, h: number, shape: Shape, img: boolean): Box;
  /** 画背景与装饰（有背景图时 img 不为空） */
  paint(g: G, w: number, h: number, shape: Shape, img: Img | null, box: Box): void;
  /** 文字画完后的点缀（例如标题下的短横线） */
  deco?(g: G, l: CoverLayout, u: number): void;
}

const pad = (w: number, h: number) => Math.round(Math.min(w, h) * 0.08);

function drawImg(g: G, img: Img, x: number, y: number, w: number, h: number) {
  const c = coverCrop(img.width, img.height, w, h);
  g.drawImage(img, c.sx, c.sy, c.sw, c.sh, x, y, w, h);
}

function rrect(g: G, x: number, y: number, w: number, h: number, r: number, fill: string, shadow?: string) {
  g.save();
  if (shadow) {
    g.shadowColor = shadow;
    g.shadowBlur = Math.min(w, h) * 0.08;
    g.shadowOffsetY = Math.min(w, h) * 0.02;
  }
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
  g.restore();
}

function circle(g: G, x: number, y: number, r: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** 标题下方的短横线 */
function underline(color: string) {
  return (g: G, l: CoverLayout, u: number) => {
    if (!l.title.lines.length) return;
    const bw = u * 0.1;
    const y = l.title.y + l.title.lines.length * l.title.size * TITLE_LH + l.title.size * 0.08;
    const x = l.box.align === 'center' ? l.box.x + (l.box.w - bw) / 2 : l.box.x;
    g.fillStyle = color;
    g.fillRect(x, y, bw, Math.max(4, u * 0.012));
  };
}

export const TEMPLATES: Template[] = [
  {
    id: 'pop', name: '醒目黄黑', font: 'sans', swatch: ['#FFD43B', '#111111'],
    colors: { title: '#111111', sub: '#3A3A3A', tagBg: '#111111', tagText: '#FFD43B', sig: '#5A4A10' },
    box(w, h, shape, img) {
      const p = pad(w, h);
      if (shape === 'wide') return { x: p, y: p, w: w * (img ? 0.5 : 0.6), h: h - p * 2, align: 'left', valign: 'middle' };
      if (img) return { x: p, y: h * (shape === 'tall' ? 0.5 : 0.42), w: w - p * 2, h: h * (shape === 'tall' ? 0.5 : 0.58) - p, align: 'left', valign: 'middle' };
      return { x: p, y: p, w: w - p * 2, h: h - p * 2, align: 'left', valign: 'middle' };
    },
    paint(g, w, h, _shape, img, box) {
      const u = Math.min(w, h);
      if (img) {
        drawImg(g, img, 0, 0, w, h);
        const e = pad(w, h) * 0.45;
        rrect(g, box.x - e, box.y - e, box.w + e * 2, box.h + e * 2, u * 0.03, '#FFD43B', 'rgba(0,0,0,.25)');
        return;
      }
      g.fillStyle = '#FFD43B';
      g.fillRect(0, 0, w, h);
      g.save();
      g.strokeStyle = 'rgba(0,0,0,.07)';
      g.lineWidth = u * 0.02;
      for (let i = -h; i < w; i += u * 0.07) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
      g.restore();
      g.fillStyle = '#FFD43B';
      g.fillRect(box.x - u * 0.03, box.y, box.w + u * 0.06, box.h);
      circle(g, w - u * 0.12, h - u * 0.12, u * 0.06, '#111111');
    },
    deco: underline('#111111'),
  },
  {
    id: 'night', name: '霓虹夜色', font: 'sans', swatch: ['#2A1660', '#FF5FA2'],
    colors: { title: '#FFFFFF', sub: '#E6D8FF', tagBg: '#FF5FA2', tagText: '#FFFFFF', sig: '#C9B6F2' },
    glow: 'rgba(255,95,162,.55)',
    box(w, h, shape) {
      const p = pad(w, h);
      if (shape === 'wide') return { x: p, y: p, w: w * 0.62, h: h - p * 2, align: 'left', valign: 'middle' };
      return { x: p, y: p, w: w - p * 2, h: h - p * 2, align: 'center', valign: 'middle' };
    },
    paint(g, w, h, shape, img) {
      const u = Math.min(w, h);
      if (img) {
        drawImg(g, img, 0, 0, w, h);
        const gr = shape === 'wide' ? g.createLinearGradient(0, 0, w, 0) : g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, 'rgba(22,10,58,.82)');
        gr.addColorStop(1, 'rgba(22,10,58,.45)');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        return;
      }
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#160A3A');
      gr.addColorStop(0.55, '#3A1C71');
      gr.addColorStop(1, '#B4487A');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      const glow = (x: number, y: number, r: number, c: string) => {
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, c);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg;
        g.fillRect(0, 0, w, h);
      };
      glow(w * 0.88, h * 0.15, u * 0.6, 'rgba(255,95,162,.45)');
      glow(w * 0.1, h * 0.95, u * 0.5, 'rgba(90,200,255,.30)');
      g.strokeStyle = 'rgba(255,255,255,.08)';
      g.lineWidth = 1.5;
      for (let y = h * 0.62; y < h; y += u * 0.04) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    },
  },
  {
    id: 'paper', name: '杂志衬线', font: 'serif', swatch: ['#F4EFE6', '#B4442E'],
    colors: { title: '#1F1B16', sub: '#6B6257', tagBg: 'transparent', tagText: '#B4442E', sig: '#8C8274' },
    box(w, h, shape, img) {
      const p = pad(w, h);
      if (img && shape === 'wide') return { x: p, y: p, w: w * 0.5 - p, h: h - p * 2, align: 'left', valign: 'middle' };
      if (img) return { x: p, y: h * 0.5 + p * 0.3, w: w - p * 2, h: h * 0.5 - p * 1.3, align: 'left', valign: 'middle' };
      return { x: p * 1.4, y: p * 1.2, w: w - p * 2.8, h: h - p * 2.4, align: 'center', valign: 'middle' };
    },
    paint(g, w, h, shape, img) {
      const u = Math.min(w, h);
      const p = pad(w, h);
      g.fillStyle = '#F4EFE6';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#1F1B16';
      g.fillRect(p * 0.5, p * 0.5, w - p, Math.max(3, u * 0.006));
      g.fillRect(p * 0.5, h - p * 0.5 - Math.max(3, u * 0.006), w - p, Math.max(3, u * 0.006));
      g.fillRect(p * 0.5, h - p * 0.5 - u * 0.022, w - p, Math.max(1.5, u * 0.002));
      if (img) {
        const [x, y, iw, ih] = shape === 'wide' ? [w * 0.5 + p * 0.2, p, w * 0.5 - p * 1.2, h - p * 2] : [p, p, w - p * 2, h * 0.5 - p];
        drawImg(g, img, x, y, iw, ih);
        g.strokeStyle = '#1F1B16';
        g.lineWidth = Math.max(2, u * 0.003);
        g.strokeRect(x, y, iw, ih);
      }
    },
    deco: underline('#B4442E'),
  },
  {
    id: 'split', name: '撞色分栏', font: 'sans', swatch: ['#0E7C66', '#F3E9D2'],
    colors: { title: '#FFFFFF', sub: '#D5F0E8', tagBg: '#F28C28', tagText: '#FFFFFF', sig: '#A9DCCF' },
    box(w, h, shape) {
      const p = pad(w, h);
      if (shape === 'wide') return { x: p, y: p, w: w * 0.56 - p * 2, h: h - p * 2, align: 'left', valign: 'middle' };
      const top = h * (shape === 'tall' ? 0.52 : 0.46);
      return { x: p, y: top + p, w: w - p * 2, h: h - top - p * 2, align: 'left', valign: 'middle' };
    },
    paint(g, w, h, shape, img) {
      const u = Math.min(w, h);
      const wide = shape === 'wide';
      const top = h * (shape === 'tall' ? 0.52 : 0.46);
      // 另一半：背景图或装饰
      const [ox, oy, ow, oh] = wide ? [w * 0.56, 0, w * 0.44, h] : [0, 0, w, top];
      if (img) drawImg(g, img, ox, oy, ow, oh);
      else {
        g.fillStyle = '#F3E9D2';
        g.fillRect(ox, oy, ow, oh);
        const cx = ox + ow / 2;
        const cy = oy + oh / 2;
        ['#F28C28', '#F3E9D2', '#0E7C66', '#F3E9D2', '#F28C28'].forEach((c, i) => circle(g, cx, cy, Math.min(ow, oh) * (0.36 - i * 0.07), c));
      }
      g.fillStyle = '#0E7C66';
      if (wide) g.fillRect(0, 0, w * 0.56, h);
      else g.fillRect(0, top, w, h - top);
      g.fillStyle = '#F28C28';
      if (wide) g.fillRect(w * 0.56 - u * 0.012, 0, u * 0.012, h);
      else g.fillRect(0, top, w, u * 0.012);
    },
  },
  {
    id: 'photo', name: '大图蒙层', font: 'sans', swatch: ['#355C7D', '#C06C84'],
    colors: { title: '#FFFFFF', sub: '#EDEDED', tagBg: '#FFFFFF', tagText: '#1A1A1A', sig: '#D8D8D8' },
    box(w, h, shape) {
      const p = pad(w, h);
      return { x: p, y: p, w: shape === 'wide' ? w * 0.7 : w - p * 2, h: h - p * 2, align: 'left', valign: 'bottom' };
    },
    paint(g, w, h, shape, img) {
      const u = Math.min(w, h);
      if (img) drawImg(g, img, 0, 0, w, h);
      else {
        const gr = g.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, '#355C7D');
        gr.addColorStop(0.6, '#6C5B7B');
        gr.addColorStop(1, '#C06C84');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        // 柔光圆点
        const dots: [number, number, number, number][] = [[0.78, 0.22, 0.22, 0.28], [0.6, 0.12, 0.1, 0.22], [0.92, 0.5, 0.14, 0.18], [0.3, 0.18, 0.08, 0.16], [0.7, 0.42, 0.06, 0.2]];
        for (const [x, y, r, a] of dots) {
          const rg = g.createRadialGradient(w * x, h * y, 0, w * x, h * y, u * r);
          rg.addColorStop(0, `rgba(255,236,210,${a})`);
          rg.addColorStop(1, 'rgba(255,236,210,0)');
          g.fillStyle = rg;
          g.fillRect(0, 0, w, h);
        }
      }
      const gr = g.createLinearGradient(0, h * (shape === 'wide' ? 0.15 : 0.35), 0, h);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,.78)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      if (shape === 'wide') {
        const gl = g.createLinearGradient(0, 0, w * 0.8, 0);
        gl.addColorStop(0, 'rgba(0,0,0,.45)');
        gl.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gl;
        g.fillRect(0, 0, w, h);
      }
    },
  },
  {
    id: 'mono', name: '极简黑白', font: 'sans', swatch: ['#FFFFFF', '#111111'],
    colors: { title: '#111111', sub: '#555555', tagBg: '#111111', tagText: '#FFFFFF', sig: '#777777' },
    box(w, h) {
      const p = pad(w, h);
      return { x: p * 1.3, y: p * 1.2, w: w - p * 2.6, h: h - p * 2.4, align: 'center', valign: 'middle' };
    },
    paint(g, w, h, _shape, img) {
      const u = Math.min(w, h);
      const p = pad(w, h);
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, w, h);
      if (img) {
        drawImg(g, img, 0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,.84)';
        g.fillRect(0, 0, w, h);
      }
      g.strokeStyle = '#111111';
      g.lineWidth = Math.max(4, u * 0.012);
      g.strokeRect(p * 0.55, p * 0.55, w - p * 1.1, h - p * 1.1);
      const s = u * 0.03;
      g.fillStyle = '#111111';
      g.fillRect(p * 0.55 - s / 2, p * 0.55 - s / 2, s, s);
      g.fillRect(w - p * 0.55 - s / 2, h - p * 0.55 - s / 2, s, s);
    },
    deco: underline('#111111'),
  },
  {
    id: 'memo', name: '便签手账', font: 'sans', swatch: ['#FFE68A', '#E8772E'],
    colors: { title: '#3A2E1E', sub: '#6E5B40', tagBg: '#E8772E', tagText: '#FFFFFF', sig: '#8E7A5A' },
    box(w, h, shape) {
      const p = pad(w, h);
      if (shape === 'wide') return { x: w * 0.2, y: p * 1.5, w: w * 0.6, h: h - p * 3, align: 'center', valign: 'middle' };
      return { x: p * 1.6, y: h * 0.22, w: w - p * 3.2, h: h * 0.56, align: 'center', valign: 'middle' };
    },
    paint(g, w, h, _shape, img, box) {
      const u = Math.min(w, h);
      if (img) drawImg(g, img, 0, 0, w, h);
      else {
        g.fillStyle = '#FFFDF6';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(80,140,200,.16)';
        g.lineWidth = 1.5;
        const step = u * 0.05;
        for (let x = step; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
        for (let y = step; y < h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      }
      const e = u * 0.06;
      g.save();
      g.translate(box.x + box.w / 2, box.y + box.h / 2);
      g.rotate(-0.025);
      rrect(g, -box.w / 2 - e, -box.h / 2 - e, box.w + e * 2, box.h + e * 2, u * 0.01, '#FFE68A', 'rgba(60,40,0,.28)');
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.fillRect(-u * 0.12, -box.h / 2 - e - u * 0.025, u * 0.24, u * 0.06);
      g.restore();
    },
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

const family = (t: Template) => (t.font === 'serif' ? SERIF : SANS);
const titleFont = (t: Template, size: number) => `${t.font === 'serif' ? 700 : 800} ${size}px ${family(t)}`;
const bodyFont = (t: Template, size: number) => `${t.font === 'serif' ? 400 : 500} ${size}px ${family(t)}`;

let measureCtx: G | null = null;
function measurer(font: (size: number) => string): MeasureAt {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  const g = measureCtx;
  return (size) => {
    const f = font(size);
    return (s) => {
      g.font = f;
      return g.measureText(s).width;
    };
  };
}

export interface DrawOpts {
  tag: string;
  signature: string;
  img: Img | null;
}

/** 在 canvas 上画一张封面。scale=1 时 canvas 为导出尺寸；缩略图用较小的 scale */
export function drawCover(canvas: HTMLCanvasElement, text: CoverText, size: SizeSpec, t: Template, o: DrawOpts, scale = 1) {
  const { w, h } = size;
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;
  const g = canvas.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cw, ch);
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const shape = shapeOf(w, h);
  const u = Math.min(w, h);
  const box = t.box(w, h, shape, !!o.img);
  t.paint(g, w, h, shape, o.img, box);
  const l = layoutCover(text, o.tag, o.signature, w, h, box, { title: measurer((s) => titleFont(t, s)), body: measurer((s) => bodyFont(t, s)) });
  const c = t.colors;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const xFor = (width: number) => (box.align === 'center' ? box.x + (box.w - width) / 2 : box.x);

  if (l.tag) {
    const s = l.tag.size;
    g.font = `700 ${s}px ${family(t)}`;
    const tw = g.measureText(l.tag.text).width;
    const pill = c.tagBg !== 'transparent';
    const bw = tw + (pill ? s * 1.4 : 0);
    const x = xFor(bw);
    if (pill) rrect(g, x, l.tag.y, bw, s * 1.7, s * 0.85, c.tagBg);
    else {
      g.fillStyle = c.tagText;
      g.fillRect(x, l.tag.y + s * 1.7, tw, Math.max(2, s * 0.08));
    }
    g.fillStyle = c.tagText;
    g.fillText(l.tag.text, x + (pill ? s * 0.7 : 0), l.tag.y + s * 0.88);
  }

  g.save();
  if (t.glow) {
    g.shadowColor = t.glow;
    g.shadowBlur = l.title.size * 0.35;
  }
  g.font = titleFont(t, l.title.size);
  g.fillStyle = c.title;
  const tlh = l.title.size * TITLE_LH;
  l.title.lines.forEach((line, i) => g.fillText(line, xFor(g.measureText(line).width), l.title.y + tlh * i + tlh / 2));
  g.restore();

  if (l.sub.lines.length) {
    g.font = bodyFont(t, l.sub.size);
    g.fillStyle = c.sub;
    const slh = l.sub.size * SUB_LH;
    l.sub.lines.forEach((line, i) => g.fillText(line, xFor(g.measureText(line).width), l.sub.y + slh * i + slh / 2));
  }

  t.deco?.(g, l, u);

  if (l.sig) {
    g.font = `500 ${l.sig.size}px ${family(t)}`;
    g.fillStyle = c.sig;
    g.fillText(l.sig.text, xFor(g.measureText(l.sig.text).width), l.sig.y);
  }
}

/** 把画好的 canvas 编成 PNG 字节 */
export async function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('生成图片失败');
  return new Uint8Array(await blob.arrayBuffer());
}

/** 把图片字节解码成可绘制的图片 */
export async function decodeImage(bytes: Uint8Array, mime: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error('图片是空的');
    return img;
  } catch {
    throw new Error('这张背景图打不开，换一张 JPG 或 PNG 试试');
  } finally {
    URL.revokeObjectURL(url);
  }
}
