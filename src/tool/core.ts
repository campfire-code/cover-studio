// 纯函数：标题解析、尺寸、排版（换行与字号自适应）、背景裁剪、导出文件名。
// 不依赖画布和本机能力，测量文字宽度的函数由外面传进来，便于单元测试。

/** 给定字号，返回测量一段文字宽度的函数 */
export type MeasureAt = (size: number) => (text: string) => number;

// ---------- 尺寸 ----------

export type Shape = 'wide' | 'square' | 'tall';
export interface SizeSpec {
  id: string;
  /** 界面和文件名里显示的名字 */
  name: string;
  ratio: string;
  w: number;
  h: number;
}

/** 内置尺寸：比例按用途设定，像素是本工具选的导出大小（足够清晰，平台会自动缩放） */
export const SIZES: SizeSpec[] = [
  { id: 'mp', name: '公众号头图', ratio: '2.35:1', w: 1880, h: 800 },
  { id: 'mp1', name: '公众号方图', ratio: '1:1', w: 1080, h: 1080 },
  { id: 'h169', name: '横版视频', ratio: '16:9', w: 1920, h: 1080 },
  { id: 'v34', name: '竖版视频', ratio: '3:4', w: 1080, h: 1440 },
  { id: 'v916', name: '竖屏视频', ratio: '9:16', w: 1080, h: 1920 },
];

export const sizeById = (id: string) => SIZES.find((s) => s.id === id);

/** 「mp,v34」→ 尺寸列表，按内置顺序、去掉不认识的 */
export function parseSizeIds(v: string): SizeSpec[] {
  const want = new Set(v.split(',').map((s) => s.trim()).filter(Boolean));
  return SIZES.filter((s) => want.has(s.id));
}

export function shapeOf(w: number, h: number): Shape {
  const r = w / h;
  return r >= 1.3 ? 'wide' : r > 0.85 ? 'square' : 'tall';
}

// ---------- 标题列表 ----------

export interface CoverText {
  title: string;
  sub: string;
}

/** 一次最多做多少个标题 */
export const MAX_TITLES = 50;

/**
 * 每行一个封面。行里的第一个「|」或「｜」后面是副标题（可不写）。
 * 空行、只有分隔符的行跳过；标题里写「\n」（反斜杠加 n）可以手动换行。
 */
export function parseTitles(text: string): CoverText[] {
  const out: CoverText[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.*?)\s*[|｜]\s*(.*)$/);
    const title = (m ? m[1] : line).trim().replace(/\\n/g, '\n');
    const sub = (m ? m[2] : '').trim().replace(/\\n/g, '\n');
    if (!title && !sub) continue;
    out.push({ title: title || sub, sub: title ? sub : '' });
  }
  return out;
}

// ---------- 换行 ----------

const NO_START = new Set([...'，。、；：？！）》」』】〉’”…—～·,.;:?!)]}%‰']);
const NO_END = new Set([...'（《「『【〈‘“([{']);

/** 切成不可再分的小块：汉字、标点、emoji 各算一块，连续的英文字母 / 数字（连同后面的空格）算一块 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const re = /[A-Za-z0-9@#&_'’\-+./:%]+\s*|\s+|\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*|[\s\S]/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[0]);
  return out;
}

/**
 * 按宽度换行：中文逐字断开，英文单词不拆（单词比整行还宽时才按字母拆），
 * 标点避头尾；preferSpace 时在行后半段的空格处断开，避免把「15 分钟」拆成「15 分 / 钟」。
 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, preferSpace = false): string[] {
  const tokens: string[] = [];
  for (const t of tokenize(text)) {
    if (t.length > 1 && measure(t.trimEnd()) > maxWidth) tokens.push(...Array.from(t));
    else tokens.push(t);
  }
  const lines: string[][] = [];
  let cur: string[] = [];
  const width = (ts: string[]) => measure(ts.join('').trimEnd());
  for (const t of tokens) {
    if (!cur.length && /^\s+$/.test(t)) continue;
    if (!cur.length || width([...cur, t]) <= maxWidth) {
      cur.push(t);
      continue;
    }
    if (/^\s+$/.test(t)) {
      lines.push(cur);
      cur = [];
      continue;
    }
    let carry: string[] = [];
    if (NO_START.has(t.trim()[0] ?? '') && cur.length > 1) carry = [cur.pop()!];
    while (cur.length > 1 && NO_END.has(cur[cur.length - 1].trim().slice(-1))) carry.unshift(cur.pop()!);
    if (preferSpace && !carry.length) {
      let sp = cur.length - 2;
      while (sp >= cur.length / 2 && !/\s$/.test(cur[sp])) sp--;
      if (sp >= cur.length / 2) carry = cur.splice(sp + 1);
    }
    lines.push(cur);
    cur = [...carry, t];
  }
  if (cur.length) lines.push(cur);
  return lines.map((ts) => ts.join('').trimEnd()).filter((l, _i, a) => l !== '' || a.length === 1);
}

/** 在字号范围内找能放进 maxLines 行的最大字号；最小字号仍放不下时截断，最后一行末尾加「…」 */
export function fitLines(text: string, width: number, maxLines: number, maxSize: number, minSize: number, measureAt: MeasureAt): { size: number; lines: string[] } {
  if (!text.trim()) return { size: maxSize, lines: [] };
  const step = Math.max(2, Math.round(maxSize / 40));
  for (let s = maxSize; s >= minSize; s -= step) {
    const lines = text.split('\n').flatMap((t) => wrapText(t, width, measureAt(s), true));
    if (lines.length <= maxLines) return { size: s, lines };
  }
  const m = measureAt(minSize);
  const lines = text.split('\n').flatMap((t) => wrapText(t, width, m)).slice(0, maxLines);
  let last = lines[maxLines - 1];
  while (last && m(last + '…') > width) last = Array.from(last).slice(0, -1).join('');
  lines[maxLines - 1] = (last ?? '') + '…';
  return { size: minSize, lines };
}

// ---------- 封面排版 ----------

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  align: 'left' | 'center';
  valign: 'top' | 'middle' | 'bottom';
}

export const TITLE_LH = 1.22;
export const SUB_LH = 1.4;

export interface TextBlock {
  size: number;
  lines: string[];
  /** 第一行的顶部 y */
  y: number;
}
export interface CoverLayout {
  box: Box;
  /** 角标（例如「第 12 期」）：有内容时在标题上方 */
  tag: { text: string; size: number; y: number } | null;
  title: TextBlock;
  sub: TextBlock;
  /** 署名（例如账号名）：在文字区最下方；y 是这一行的中线 */
  sig: { text: string; size: number; y: number } | null;
}

/** 各形状的标题最多几行、最大字号（相对短边）、副标题最多几行 */
const RULES: Record<Shape, { lines: number; max: number; subLines: number }> = {
  wide: { lines: 2, max: 0.2, subLines: 1 },
  square: { lines: 3, max: 0.14, subLines: 2 },
  tall: { lines: 4, max: 0.15, subLines: 2 },
};

/**
 * 在文字区里排版：标题尽量大（不超过规定行数），副标题约为标题的 0.4 倍，
 * 整块高度超出文字区时整体缩小，最后按上 / 中 / 下对齐摆放。
 */
export function layoutCover(text: CoverText, tag: string, sig: string, w: number, h: number, box0: Box, m: { title: MeasureAt; body: MeasureAt }): CoverLayout {
  const shape = shapeOf(w, h);
  const r = RULES[shape];
  const u = Math.min(w, h);
  const sigText = sig.trim().slice(0, 30);
  const sigSize = Math.round(u * 0.03);
  // 署名占文字区最下面一行，标题等排在剩下的空间里
  const box = sigText ? { ...box0, h: box0.h - sigSize * 2.2 } : box0;
  let maxTitle = Math.round(u * r.max);
  for (let round = 0; round < 8; round++) {
    const title = fitLines(text.title, box.w, r.lines, maxTitle, Math.round(maxTitle * 0.5), m.title);
    const subMax = Math.round(Math.min(Math.max(title.size * 0.42, u * 0.034), u * 0.06));
    const sub = fitLines(text.sub, box.w, r.subLines, subMax, Math.round(subMax * 0.7), m.body);
    const tagSize = Math.round(Math.max(u * 0.03, Math.min(title.size * 0.36, u * 0.045)));
    const tagH = tag.trim() ? tagSize * 1.9 + title.size * 0.35 : 0;
    const titleH = title.lines.length * title.size * TITLE_LH;
    const gap = sub.lines.length ? title.size * 0.42 : 0;
    const subH = sub.lines.length * sub.size * SUB_LH;
    const total = tagH + titleH + gap + subH;
    if (total > box.h && round < 7) {
      maxTitle = Math.round(maxTitle * Math.max(0.6, (box.h / total) * 0.98));
      continue;
    }
    const top = box.valign === 'top' ? box.y : box.valign === 'bottom' ? box.y + box.h - total : box.y + (box.h - total) / 2;
    return {
      box: box0,
      tag: tag.trim() ? { text: tag.trim().slice(0, 16), size: tagSize, y: top } : null,
      title: { ...title, y: top + tagH },
      sub: { ...sub, y: top + tagH + titleH + gap },
      sig: sigText ? { text: sigText, size: sigSize, y: box0.y + box0.h - sigSize * 0.6 } : null,
    };
  }
  throw new Error('排版失败');
}

// ---------- 背景图 ----------

/** 背景图按「铺满并居中裁剪」放进画布：返回要从原图截取的区域 */
export function coverCrop(iw: number, ih: number, w: number, h: number): { sx: number; sy: number; sw: number; sh: number } {
  if (iw <= 0 || ih <= 0) throw new Error('背景图尺寸不对');
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'];
export const isImagePath = (p: string) => IMAGE_EXTS.includes((p.split('.').pop() ?? '').toLowerCase());
export const mimeOf = (p: string) => {
  const ext = (p.split('.').pop() ?? '').toLowerCase();
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext || 'png'}`;
};

// ---------- 导出 ----------

const safe = (s: string, n: number) => s.replace(/[\\/:*?"<>|\n\r\t.]/g, '').replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/\s+/g, ' ').trim().slice(0, n);

/** 导出文件名：「01-标题-公众号头图.png」，按标题在前、尺寸在后的顺序 */
export function fileNames(texts: CoverText[], sizes: SizeSpec[]): string[] {
  const width = Math.max(2, String(texts.length).length);
  return texts.flatMap((t, i) => sizes.map((s) => `${String(i + 1).padStart(width, '0')}-${safe(t.title, 20) || '封面'}-${safe(s.name, 12).replace(/\s/g, '')}.png`));
}

/** 导出子文件夹名：封面-20261023-153000 */
export function exportFolderName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `封面-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
