import { describe, expect, it } from 'vitest';
import { SIZES, parseSizeIds, parseTitles } from './core';
import { exportCovers, readPrefs, type Prefs } from './flow';
import { SAMPLE } from './sample';

function fakeIO() {
  const files = new Map<string, Uint8Array>();
  const dirs: string[] = [];
  return {
    files, dirs,
    join: async (...p: string[]) => p.join('/'),
    writeFile: async (p: string, d: Uint8Array) => void files.set(p, d),
    ensureDir: async (p: string) => void dirs.push(p),
  };
}

describe('批量导出', () => {
  it('示例标题 × 全部尺寸 → 新文件夹里按顺序写出 20 张 PNG，并报告进度', async () => {
    const texts = parseTitles(SAMPLE);
    const io = fakeIO();
    const drawn: string[] = [];
    const prog: number[] = [];
    const r = await exportCovers(io, '/下载/封面工坊', new Date(2026, 9, 23, 15, 30, 0), texts, SIZES, async (t, s) => {
      drawn.push(`${t.title}@${s.id}`);
      return new Uint8Array([137, 80, 78, 71, drawn.length]);
    }, (d) => prog.push(d));
    expect(r.dir).toBe('/下载/封面工坊/封面-20261023-153000');
    expect(io.dirs).toEqual([r.dir]);
    expect(texts).toHaveLength(4);
    expect(r.files).toHaveLength(20);
    expect(r.files.slice(0, 5).map((f) => f.split('/').pop())).toEqual([
      '01-上班族 15 分钟早餐-公众号头图.png', '01-上班族 15 分钟早餐-公众号方图.png', '01-上班族 15 分钟早餐-横版视频.png',
      '01-上班族 15 分钟早餐-竖版视频.png', '01-上班族 15 分钟早餐-竖屏视频.png',
    ]);
    expect(drawn[5]).toBe('新手第一次露营，这 8 样别忘带@mp');
    expect(io.files.get(r.files[19])![4]).toBe(20);
    expect(prog).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it('没有保存位置、没有标题、没有尺寸时报错，不写文件', async () => {
    const io = fakeIO();
    const draw = async () => new Uint8Array();
    await expect(exportCovers(io, '', new Date(), parseTitles('a'), SIZES, draw)).rejects.toThrow('保存位置');
    await expect(exportCovers(io, '/x', new Date(), [], SIZES, draw)).rejects.toThrow('标题');
    await expect(exportCovers(io, '/x', new Date(), parseTitles('a'), parseSizeIds(''), draw)).rejects.toThrow('尺寸');
    expect(io.files.size).toBe(0);
    expect(io.dirs).toEqual([]);
  });
});

describe('偏好设置', () => {
  const fb: Prefs = { titles: '示例', sizes: 'mp,mp1', template: 'pop', tag: '', signature: '', bgPath: '', outDir: '' };
  it('缺字段、类型不对时用默认值', () => {
    expect(readPrefs(null, fb)).toEqual(fb);
    expect(readPrefs({ template: 'night', tag: 3, bgPath: '/a.jpg' }, fb)).toEqual({ ...fb, template: 'night', bgPath: '/a.jpg' });
  });
  it('尺寸去掉不认识的；全都不认识时用默认', () => {
    expect(readPrefs({ sizes: 'v916,abc' }, fb).sizes).toBe('v916');
    expect(readPrefs({ sizes: 'abc' }, fb).sizes).toBe('mp,mp1');
  });
});
