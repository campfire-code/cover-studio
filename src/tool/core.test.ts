import { describe, expect, it } from 'vitest';
import {
  SIZES, coverCrop, exportFolderName, fileNames, fitLines, isImagePath, layoutCover, mimeOf, parseSizeIds, parseTitles, shapeOf, tokenize, wrapText,
  type Box, type MeasureAt,
} from './core';

/** 等宽测量：中文占 1 个字号宽，英文数字占半个 */
const mono: MeasureAt = (size) => (s) => Array.from(s).reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? size : size / 2), 0);
const m = { title: mono, body: mono };

describe('标题列表', () => {
  it('每行一个，| 或 ｜ 后面是副标题，跳过空行', () => {
    expect(parseTitles('早餐清单 | 一周不重样\n\n  露营装备｜8 样别忘带  \n旧衣改造')).toEqual([
      { title: '早餐清单', sub: '一周不重样' },
      { title: '露营装备', sub: '8 样别忘带' },
      { title: '旧衣改造', sub: '' },
    ]);
  });
  it('只有分隔符跳过；只有副标题时当标题；\\n 手动换行；只按第一个分隔符拆', () => {
    expect(parseTitles('|\n | 只有副标题\n第一行\\n第二行 | a|b')).toEqual([
      { title: '只有副标题', sub: '' },
      { title: '第一行\n第二行', sub: 'a|b' },
    ]);
  });
  it('Windows 换行也能识别', () => {
    expect(parseTitles('一\r\n二\r\n')).toHaveLength(2);
  });
});

describe('尺寸', () => {
  it('五种比例的像素和比例一致', () => {
    const ratio = (r: string) => { const [a, b] = r.split(':').map(Number); return a / b; };
    for (const s of SIZES) expect(Math.abs(s.w / s.h - ratio(s.ratio))).toBeLessThan(0.005);
    expect(SIZES.map((s) => s.ratio)).toEqual(['2.35:1', '1:1', '16:9', '3:4', '9:16']);
  });
  it('按内置顺序解析，忽略不认识的', () => {
    expect(parseSizeIds('v916, mp,xx').map((s) => s.id)).toEqual(['mp', 'v916']);
    expect(parseSizeIds('')).toEqual([]);
  });
  it('形状判断', () => {
    expect([shapeOf(1880, 800), shapeOf(1920, 1080), shapeOf(1080, 1080), shapeOf(1080, 1440), shapeOf(1080, 1920)]).toEqual(['wide', 'wide', 'square', 'tall', 'tall']);
  });
});

describe('换行', () => {
  it('英文单词和数字不拆开，emoji 算一块', () => {
    expect(tokenize('15 分钟 OK👍🏻')).toEqual(['15 ', '分', '钟', ' ', 'OK', '👍', '🏻']);
    expect(wrapText('用 Photoshop 做图', 7 * 10, mono(10))).toEqual(['用 Photoshop', '做图']);
  });
  it('标点不出现在行首', () => {
    const lines = wrapText('一二三四，五六', 40, mono(10));
    expect(lines[0]).toBe('一二三');
    expect(lines[1]).toBe('四，五六');
  });
  it('放得下时用最大字号，放不下逐步缩小，最小字号仍放不下就截断加省略号', () => {
    expect(fitLines('十个字十个字十个字十', 1000, 1, 100, 50, mono)).toEqual({ size: 100, lines: ['十个字十个字十个字十'] });
    const r = fitLines('十个字十个字十个字十', 600, 1, 100, 50, mono);
    expect(r.size).toBeLessThanOrEqual(60);
    expect(r.lines).toHaveLength(1);
    const cut = fitLines('很长很长很长很长很长很长很长很长很长很长', 200, 2, 40, 40, mono);
    expect(cut.lines).toHaveLength(2);
    expect(cut.lines[1].endsWith('…')).toBe(true);
  });
});

describe('封面排版', () => {
  const box = (w: number, h: number, over: Partial<Box> = {}): Box => ({ x: 80, y: 80, w: w - 160, h: h - 160, align: 'left', valign: 'middle', ...over });
  const inside = (l: ReturnType<typeof layoutCover>, b: Box) => {
    const end = l.sub.lines.length ? l.sub.y + l.sub.lines.length * l.sub.size * 1.4 : l.title.y + l.title.lines.length * l.title.size * 1.22;
    return (l.tag?.y ?? l.title.y) >= b.y - 0.5 && end <= b.y + b.h + 0.5;
  };
  it('每个尺寸的文字都在文字区内，横版标题不超过 2 行、竖版不超过 4 行', () => {
    const text = { title: '新手第一次露营，这 8 样东西千万别忘带，清单可以直接保存', sub: '从帐篷到头灯，一次说清楚' };
    for (const s of SIZES) {
      const b = box(s.w, s.h);
      const l = layoutCover(text, '第 12 期', '@示例账号', s.w, s.h, b, m);
      expect(inside(l, b)).toBe(true);
      expect(l.title.lines.length).toBeLessThanOrEqual(shapeOf(s.w, s.h) === 'wide' ? 2 : shapeOf(s.w, s.h) === 'square' ? 3 : 4);
      expect(l.title.lines.join('').endsWith('…') || l.title.lines.join('').replace(/\s/g, '') === text.title.replace(/\s/g, '')).toBe(true);
      expect(l.sig!.y).toBeLessThanOrEqual(b.y + b.h);
      expect(l.sig!.y).toBeGreaterThan(l.sub.y);
    }
  });
  it('短标题用大字号；副标题比标题小；没有副标题、角标、署名时都为空', () => {
    const l = layoutCover({ title: '早餐', sub: '' }, '', '', 1080, 1440, box(1080, 1440), m);
    expect(l.title.size).toBe(Math.round(1080 * 0.15));
    expect(l.sub.lines).toEqual([]);
    expect(l.tag).toBeNull();
    expect(l.sig).toBeNull();
    const l2 = layoutCover({ title: '早餐', sub: '一周不重样' }, '', '', 1080, 1440, box(1080, 1440), m);
    expect(l2.sub.size).toBeLessThan(l2.title.size);
  });
  it('文字区很矮时整体缩小，仍然放得下', () => {
    const b = box(1880, 800, { h: 160 });
    const l = layoutCover({ title: '一个比较长的标题需要两行才能放下的那种', sub: '副标题也有一行' }, '角标', '', 1880, 800, b, m);
    expect(inside(l, b)).toBe(true);
  });
  it('上 / 中 / 下对齐', () => {
    const t = { title: '标题', sub: '' };
    const top = layoutCover(t, '', '', 1080, 1080, box(1080, 1080, { valign: 'top' }), m);
    const mid = layoutCover(t, '', '', 1080, 1080, box(1080, 1080), m);
    const bot = layoutCover(t, '', '', 1080, 1080, box(1080, 1080, { valign: 'bottom' }), m);
    expect(top.title.y).toBe(80);
    expect(mid.title.y).toBeGreaterThan(top.title.y);
    expect(bot.title.y + bot.title.size * 1.22).toBeCloseTo(1000, 5);
  });
});

describe('背景图裁剪', () => {
  it('横图放进竖版：裁左右，居中', () => {
    expect(coverCrop(2000, 1000, 1080, 1920)).toEqual({ sx: 718.75, sy: 0, sw: 562.5, sh: 1000 });
  });
  it('竖图放进横版：裁上下，居中', () => {
    const c = coverCrop(1000, 2000, 1880, 800);
    expect(c.sx).toBe(0);
    expect(c.sw).toBe(1000);
    expect(c.sh).toBeCloseTo(1000 * 800 / 1880, 6);
    expect(c.sy).toBeCloseTo((2000 - c.sh) / 2, 6);
  });
  it('尺寸为 0 报错', () => {
    expect(() => coverCrop(0, 10, 10, 10)).toThrow('背景图');
  });
  it('图片扩展名和类型', () => {
    expect(isImagePath('/a/b.JPG')).toBe(true);
    expect(isImagePath('/a/b.txt')).toBe(false);
    expect(mimeOf('x.jpeg')).toBe('image/jpeg');
    expect(mimeOf('x.webp')).toBe('image/webp');
  });
});

describe('导出文件名', () => {
  it('标题在前尺寸在后，去掉不能用的字符和 emoji', () => {
    const names = fileNames([{ title: '早餐: 15/分钟🍳', sub: '' }, { title: '???', sub: '' }], [SIZES[0], SIZES[4]]);
    expect(names).toEqual(['01-早餐 15分钟-公众号头图.png', '01-早餐 15分钟-竖屏视频.png', '02-封面-公众号头图.png', '02-封面-竖屏视频.png']);
  });
  it('文件夹名带日期时间', () => {
    expect(exportFolderName(new Date(2026, 9, 23, 9, 5, 7))).toBe('封面-20261023-090507');
  });
});
