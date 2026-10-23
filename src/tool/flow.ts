// 导出流程与偏好设置：不直接依赖画布和 Tauri，读写都从外面传进来，方便用内存假文件系统测试。
import { SIZES, exportFolderName, fileNames, type CoverText, type SizeSpec } from './core';

export interface ExportIO {
  join(...parts: string[]): Promise<string>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  ensureDir(path: string): Promise<void>;
}

/**
 * 在 baseDir 下新建「封面-日期时间」文件夹，按「标题 × 尺寸」逐张画出并保存 PNG。
 * render 一次只画一张，画完立即写盘，几十张也不会占太多内存。
 */
export async function exportCovers(
  io: ExportIO, baseDir: string, now: Date, texts: CoverText[], sizes: SizeSpec[],
  render: (text: CoverText, size: SizeSpec) => Promise<Uint8Array>, progress?: (done: number, total: number) => void,
): Promise<{ dir: string; files: string[] }> {
  if (!baseDir) throw new Error('还没有选择保存位置');
  if (!texts.length) throw new Error('还没有填标题');
  if (!sizes.length) throw new Error('至少选一个尺寸');
  const dir = await io.join(baseDir, exportFolderName(now));
  await io.ensureDir(dir);
  const names = fileNames(texts, sizes);
  const files: string[] = [];
  let k = 0;
  for (const t of texts) {
    for (const s of sizes) {
      const p = await io.join(dir, names[k]);
      await io.writeFile(p, await render(t, s));
      files.push(p);
      progress?.(++k, names.length);
    }
  }
  return { dir, files };
}

export interface Prefs {
  titles: string;
  sizes: string;
  template: string;
  tag: string;
  signature: string;
  bgPath: string;
  outDir: string;
}
export const PREFS_KEY = 'c18.prefs';

/** 读出的偏好可能缺字段或类型不对（旧版本、手改过），逐项兜底；尺寸里不认识的去掉，全不认识时用默认 */
export function readPrefs(raw: unknown, fallback: Prefs): Prefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (k: keyof Prefs) => (typeof o[k] === 'string' ? (o[k] as string) : fallback[k]);
  const sizes = s('sizes').split(',').filter((id) => SIZES.some((x) => x.id === id)).join(',');
  return { titles: s('titles'), sizes: sizes || fallback.sizes, template: s('template'), tag: s('tag'), signature: s('signature'), bgPath: s('bgPath'), outDir: s('outDir') };
}
