// 工具声明：封面工坊（自定义界面：左边填标题、选尺寸和模板，右边实时预览，一键批量导出 PNG）。
import { Images as ImagesAsIcon } from 'lucide-react';
import { createElement } from 'react';
import type { CustomTool } from '../kit/types';
import { Main } from './Main';

const tool: CustomTool = {
  id: 'c18',
  name: '封面工坊',
  tagline: '一行一个标题，按公众号头图（2.35:1、1:1）和视频封面（16:9、3:4、9:16）批量出图，7 套模板实时预览，可换背景图，一键导出全部 PNG。',
  icon: ImagesAsIcon,
  category: '内容生产',
  type: 'media',
  mode: 'custom',
  mainLabel: '做封面',
  params: [],
  // 预览页的 ctx 是假的（读写不落盘），Main 里对 ctx 判空
  Main: ({ ctx }) => createElement(Main, { ctx }),
};

export default tool;
