// 主界面：左边填标题、选尺寸和模板、换背景图，右边实时预览全部封面，一键批量导出 PNG。
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, FolderOpen, ImagePlus, Trash2, X } from 'lucide-react';
import type { CustomTool } from '../kit/types';
import { defaultOutputDir, ensureDir, openFolder, pickFiles, pickFolder, settingsStore } from '../kit/platform';
import { useDroppedFiles } from '../kit/parts';
import { IMAGE_EXTS, MAX_TITLES, SIZES, isImagePath, mimeOf, parseSizeIds, parseTitles, type CoverText, type SizeSpec } from './core';
import { TEMPLATES, canvasPng, decodeImage, drawCover, templateById, type Img, type Template } from './render';
import { PREFS_KEY, exportCovers, readPrefs, type Prefs } from './flow';
import { SAMPLE, SAMPLE_TAG } from './sample';
import './tool.css';

type Ctx = Parameters<CustomTool['Main']>[0]['ctx'];
const TOOL_NAME = '封面工坊';
const DEFAULTS: Prefs = { titles: SAMPLE, sizes: SIZES.map((s) => s.id).join(','), template: TEMPLATES[0].id, tag: SAMPLE_TAG, signature: '@你的账号名', bgPath: '', outDir: '' };
/** 预览缩略图的高度（像素） */
const THUMB_H = 88;
const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p;

interface CoverProps { text: CoverText; size: SizeSpec; t: Template; tag: string; signature: string; img: Img | null; height: number }

function CoverCanvas({ text, size, t, tag, signature, img, height }: CoverProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    // 按显示尺寸 × 屏幕倍率画，缩略图更清晰也更快
    const scale = Math.min(1, (height * (devicePixelRatio || 1)) / size.h);
    drawCover(ref.current, text, size, t, { tag, signature, img }, scale);
  }, [text, size, t, tag, signature, img, height]);
  return <canvas ref={ref} style={{ height, aspectRatio: `${size.w} / ${size.h}` }} aria-label={`${text.title} · ${size.name}`} />;
}

export function Main({ ctx }: { ctx?: Ctx }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string; dir?: string } | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [defaultDir, setDefaultDir] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const st = await settingsStore();
        setPrefs(readPrefs(await st.get(PREFS_KEY), DEFAULTS));
      } catch { /* 预览页或首次打开：用默认值 */ }
      try { setDefaultDir((await defaultOutputDir(TOOL_NAME)) || ''); } catch { /* 预览页没有本机路径 */ }
      loaded.current = true;
    })();
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const id = setTimeout(async () => {
      try { await (await settingsStore()).set(PREFS_KEY, prefs); } catch { /* 预览页不保存 */ }
    }, 500);
    return () => clearTimeout(id);
  }, [prefs]);

  // 背景图路径变了就重新读图；读不到（文件被删、改名）时清掉，提示一次
  useEffect(() => {
    let alive = true;
    if (!prefs.bgPath || !ctx) { setImg(null); return; }
    (async () => {
      try {
        const im = await decodeImage(await ctx.readFile(prefs.bgPath), mimeOf(prefs.bgPath));
        if (alive) setImg(im);
      } catch (e) {
        if (!alive) return;
        setImg(null);
        setPrefs((o) => ({ ...o, bgPath: '' }));
        setMsg({ kind: 'err', text: `背景图读取失败：${e instanceof Error ? e.message : String(e)}` });
      }
    })();
    return () => { alive = false; };
  }, [prefs.bgPath, ctx]);

  const set = (p: Partial<Prefs>) => setPrefs((o) => ({ ...o, ...p }));
  const titlesText = useDeferredValue(prefs.titles);
  const allTexts = useMemo(() => parseTitles(titlesText), [titlesText]);
  const texts = allTexts.slice(0, MAX_TITLES);
  const sizes = parseSizeIds(prefs.sizes);
  const t = templateById(prefs.template);
  const outDir = prefs.outDir || defaultDir;
  const flat = texts.flatMap((text, ti) => sizes.map((size) => ({ text, size, ti })));
  const total = flat.length;

  const toggleSize = (id: string) => {
    const on = new Set(sizes.map((s) => s.id));
    if (on.has(id)) on.delete(id);
    else on.add(id);
    set({ sizes: SIZES.filter((s) => on.has(s.id)).map((s) => s.id).join(',') });
  };

  async function importTitles(path: string) {
    if (!ctx) return;
    try {
      const txt = (await ctx.readText(path)).replace(/^﻿/, '');
      set({ titles: txt.trim() });
      setMsg({ kind: 'ok', text: `已从 ${fileName(path)} 读入 ${parseTitles(txt).length} 个标题` });
    } catch (e) {
      setMsg({ kind: 'err', text: `读取失败：${e instanceof Error ? e.message : String(e)}` });
    }
  }

  // 拖进窗口：图片当背景，txt 当标题列表
  const hover = useDroppedFiles((paths) => {
    const pic = paths.find(isImagePath);
    const txt = paths.find((p) => /\.txt$/i.test(p));
    if (pic) set({ bgPath: pic });
    if (txt) importTitles(txt);
    if (!pic && !txt) setMsg({ kind: 'err', text: '只支持拖入图片（当背景）或 .txt 标题列表' });
  });

  useEffect(() => {
    if (zoom == null) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(null);
      else if (e.key === 'ArrowRight') setZoom((z) => Math.min(total - 1, (z ?? 0) + 1));
      else if (e.key === 'ArrowLeft') setZoom((z) => Math.max(0, (z ?? 0) - 1));
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [zoom, total]);

  async function runExport() {
    if (!ctx) return setMsg({ kind: 'err', text: '预览模式下不能导出' });
    setBusy(`正在导出 0 / ${total}`);
    setMsg(null);
    try {
      const canvas = document.createElement('canvas');
      const r = await exportCovers({ join: ctx.join, writeFile: ctx.writeFile, ensureDir }, outDir, new Date(), texts, sizes, async (text, size) => {
        drawCover(canvas, text, size, t, { tag: prefs.tag, signature: prefs.signature, img }, 1);
        return canvasPng(canvas);
      }, (d, n) => setBusy(`正在导出 ${d} / ${n}`));
      setMsg({ kind: 'ok', text: `已导出 ${r.files.length} 张 PNG 到 ${r.dir}`, dir: r.dir });
    } catch (e) {
      setMsg({ kind: 'err', text: `导出失败：${e instanceof Error ? e.message : String(e)}` });
    }
    setBusy('');
  }

  const cur = zoom != null ? flat[zoom] : null;
  return (
    <div className={`cs${hover ? ' cs-hover' : ''}`}>
      <section className="cs-top k-panel">
        <div className="k-field cs-titles">
          <div className="cs-row">
            <label className="k-label" htmlFor="cs-titles">标题列表（每行一个）</label>
            <span className="b-sp" />
            <button className="k-link" disabled={!ctx} onClick={async () => { const [p] = await pickFiles(['txt'], '文本').catch(() => []); if (p) importTitles(p); }}><FileText size={13} />从 txt 导入</button>
          </div>
          <textarea id="cs-titles" className="k-input k-textarea cs-text" value={prefs.titles} spellCheck={false} onChange={(e) => set({ titles: e.target.value })} placeholder={'主标题 | 副标题（可不写）\n第二个封面的标题'} />
          <span className="k-help">每行生成一组封面；「|」后面是副标题。一次最多 {MAX_TITLES} 个标题，字多会自动缩小、换行。</span>
          {allTexts.length > MAX_TITLES && <span className="k-help cs-warn">共 {allTexts.length} 行，只处理前 {MAX_TITLES} 个</span>}
        </div>
        <div className="cs-ctrl">
          <div className="k-field">
            <span className="k-label">模板</span>
            <div className="cs-tpls" role="radiogroup" aria-label="模板">
              {TEMPLATES.map((x) => (
                <button key={x.id} role="radio" aria-checked={x.id === t.id} className={`cs-tpl${x.id === t.id ? ' on' : ''}`} onClick={() => set({ template: x.id })}>
                  <i className="cs-sw" style={{ background: `linear-gradient(135deg, ${x.swatch[0]} 50%, ${x.swatch[1]} 50%)` }} />
                  <span>{x.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="k-field">
            <span className="k-label">尺寸（可多选）</span>
            <div className="cs-chips" role="group" aria-label="尺寸">
              {SIZES.map((s) => {
                const on = sizes.some((x) => x.id === s.id);
                return (
                  <button key={s.id} role="checkbox" aria-checked={on} className={`k-chip${on ? ' on' : ''}`} onClick={() => toggleSize(s.id)}>
                    <i className="cs-ratio" style={{ aspectRatio: `${s.w} / ${s.h}` }} />{s.name}<span className="k-muted k-num">{s.ratio}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="cs-three">
            <div className="k-field">
              <span className="k-label">背景图（可选）</span>
              <div className="cs-row">
                <button className="k-btn" title="铺满并居中裁剪，模板会自动加色块或蒙层保证文字看得清；也可以直接把图片拖进窗口" disabled={!ctx} onClick={async () => { const [p] = await pickFiles(IMAGE_EXTS, '图片').catch(() => []); if (p) set({ bgPath: p }); }}><ImagePlus size={15} />{prefs.bgPath ? '换一张' : '选择图片'}</button>
                {prefs.bgPath && <span className="k-ellipsis k-muted" title={prefs.bgPath}>{fileName(prefs.bgPath)}</span>}
                {prefs.bgPath && <button className="k-icon-btn" aria-label="去掉背景图" title="去掉背景图" onClick={() => set({ bgPath: '' })}><Trash2 size={14} /></button>}
              </div>
            </div>
            <div className="k-field">
              <label className="k-label" htmlFor="cs-tag">角标（可留空）</label>
              <input id="cs-tag" className="k-input" value={prefs.tag} maxLength={16} placeholder="例如：第 12 期" onChange={(e) => set({ tag: e.target.value })} />
            </div>
            <div className="k-field">
              <label className="k-label" htmlFor="cs-sig">署名（可留空）</label>
              <input id="cs-sig" className="k-input" value={prefs.signature} maxLength={30} onChange={(e) => set({ signature: e.target.value })} />
            </div>
          </div>
        </div>
      </section>

      <section className="cs-view">
        <div className="cs-bar">
          <b>封面矩阵</b>
          <span className="k-muted k-num">{texts.length} 个标题 × {sizes.length} 个尺寸 = {total} 张</span>
          <span className="b-sp" />
          <button className="k-btn cs-dir" title={outDir || '选择保存位置'} onClick={async () => { const p = await pickFolder().catch(() => null); if (p) set({ outDir: p }); }}>
            <FolderOpen size={15} /><span className="k-ellipsis">{outDir ? `保存到 ${outDir}` : '选择保存位置'}</span>
          </button>
          <button className="k-btn primary" disabled={!!busy || !total} onClick={runExport}><Download size={15} />{busy || `导出 ${total} 张 PNG`}</button>
        </div>
        {msg && (
          <div className={`k-notice ${msg.kind}`} role={msg.kind === 'err' ? 'alert' : 'status'}>
            <span>{msg.text}</span>
            {msg.dir && <button className="k-link" onClick={() => openFolder(msg.dir!)}>打开文件夹</button>}
            <button className="k-icon-btn" aria-label="关闭提示" onClick={() => setMsg(null)}><X size={14} /></button>
          </div>
        )}
        {!total && <div className="cs-empty k-panel k-muted">{texts.length ? '至少选一个尺寸' : '在上面填上标题，这里会实时出封面'}</div>}
        {total > 0 && (
          <div className="cs-scroll k-panel">
            <div className="cs-matrix" style={{ gridTemplateColumns: `minmax(120px, 190px) repeat(${sizes.length}, max-content)` }}>
              <span />
              {sizes.map((size) => <span key={size.id} className="cs-colh"><b>{size.name}</b><span className="k-muted k-num">{size.ratio}</span></span>)}
              {texts.map((text, ti) => (
                <div key={ti} className="cs-rowwrap">
                  <div className="cs-rowh"><span className="cs-no k-num">{String(ti + 1).padStart(2, '0')}</span><span className="cs-rt"><b>{text.title.replace(/\n/g, ' ')}</b>{text.sub && <small className="k-muted">{text.sub}</small>}</span></div>
                  {sizes.map((size) => (
                    <button key={size.id} className="cs-thumb" title={`${size.name} ${size.ratio} · ${size.w}×${size.h}，点击放大`} onClick={() => setZoom(flat.findIndex((f) => f.ti === ti && f.size.id === size.id))}>
                      <CoverCanvas text={text} size={size} t={t} tag={prefs.tag} signature={prefs.signature} img={img} height={THUMB_H} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {cur && zoom != null && (
        <div className="cs-zoom" role="dialog" aria-label="放大预览" onClick={() => setZoom(null)}>
          <div className="cs-zoom-box k-panel" onClick={(e) => e.stopPropagation()}>
            <div className="cs-zoom-img">
              <CoverCanvas text={cur.text} size={cur.size} t={t} tag={prefs.tag} signature={prefs.signature} img={img} height={Math.min(innerHeight * 0.66, cur.size.h, (innerWidth * 0.82 * cur.size.h) / cur.size.w)} />
            </div>
            <div className="cs-zoom-bar">
              <button className="k-btn" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}><ChevronLeft size={15} />上一张</button>
              <span className="k-muted k-num">{zoom + 1} / {total} · {cur.size.name} {cur.size.w}×{cur.size.h}</span>
              <button className="k-btn" disabled={zoom === total - 1} onClick={() => setZoom(zoom + 1)}>下一张<ChevronRight size={15} /></button>
              <button className="k-btn" onClick={() => setZoom(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
