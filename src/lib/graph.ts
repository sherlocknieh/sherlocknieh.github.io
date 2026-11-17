/**
 * 节点图的概念模型: 分组是根节点下的一级类别, 分类是分组内部的主题切分, 叶子是内容集合里的条目.
 * 维度与分类的标签写死在这里, 内容只负责声明自己属于哪个分组和分类.
 */

export const GROUP_IDS = ['apps', 'lab', 'tools', 'writing', 'about'] as const;

export type GroupId = (typeof GROUP_IDS)[number];

/** 节点图标名, 具体图形映射在 src/lib/icons.tsx */
export const ICON_NAMES = [
  'compass',
  'app-window',
  'puzzle',
  'flask',
  'pen',
  'user',
  'blocks',
  'scroll',
  'code',
  'monitor',
  'wrench',
  'file-pen',
  'brain',
  'sparkles',
  'wand',
  'bot',
  'mouse',
  'clapperboard',
  'notebook',
  'qr',
  'mouse-click',
  'search',
  'terminal',
  'subtitles',
  'swap',
  'globe',
  'calendar',
  'checklist',
  'tv',
  'chart',
  'chart-line',
  'graduation',
  'sigma',
  'file',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export interface GraphGroupMeta {
  id: GroupId;
  label: string;
  hint: string;
  icon: IconName;
}

export const GROUPS: readonly GraphGroupMeta[] = [
  { id: 'apps', label: '在线APP', hint: '能直接打开用的东西', icon: 'app-window' },
  { id: 'tools', label: '插件&工具', hint: '装进浏览器和系统里的小东西', icon: 'puzzle' },
  { id: 'lab', label: '学习与实验', hint: '课程、练习与折腾', icon: 'flask' },
  { id: 'writing', label: '写作', hint: '写过的东西', icon: 'pen' },
  { id: 'about', label: '关于', hint: '关于我', icon: 'user' },
];

/** 分类只用于在分组内部收拢同主题条目, 顺序即画布上的纵向顺序 */
export interface GraphSectionMeta {
  id: string;
  label: string;
  /** 分类归属的分组, 决定它挂在哪个分组节点下 */
  group: GroupId;
  icon: IconName;
}

export const SECTIONS: readonly GraphSectionMeta[] = [
  { id: 'extensions', label: '浏览器插件', group: 'tools', icon: 'blocks' },
  { id: 'userscripts', label: '油猴脚本', group: 'tools', icon: 'scroll' },
  { id: 'vscode', label: 'VSCode插件', group: 'tools', icon: 'code' },
  { id: 'desktop', label: '桌面工具', group: 'tools', icon: 'monitor' },
  { id: 'devtools', label: '开发工具', group: 'tools', icon: 'wrench' },
];

export const SECTION_IDS = SECTIONS.map((section) => section.id);

/** 叶子展开后的详情节点: 相关链接或页面截图 */
export type GraphDetail =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'shot'; label: string; src: string };

export interface GraphEntry {
  /** 全局唯一, 用作画布节点 id */
  id: string;
  group: GroupId;
  /** 分组内的主题分类, 缺省时直接挂在分组下 */
  section?: string;
  label: string;
  href: string;
  meta?: string;
  external?: boolean;
  icon: IconName;
  /** 展开叶子后显示的下一层节点, 为空时叶子不显示展开按钮 */
  details: GraphDetail[];
}

/** 收起状态的键: 分组用自身 id 表示收起它直接挂的条目, 分类用 `分组/分类` 表示收起它的条目 */
export const groupKey = (id: GroupId) => id;
export const sectionKey = (group: GroupId, section: string) => `${group}/${section}`;
export const leafKey = (id: string) => `leaf/${id}`;

/** 根节点收起时整棵树只剩根; 和分组、分类、叶子共用同一个 collapsed 集合 */
export const ROOT_KEY = 'root';

/** 默认只展开到二级: 根与分组可见, 分类、条目及其详情都收起 */
export function defaultCollapsed(entries: readonly GraphEntry[] = []): Set<string> {
  return new Set([
    ...GROUPS.map((group) => groupKey(group.id)),
    ...SECTIONS.map((section) => sectionKey(section.group, section.id)),
    ...entries.map((entry) => leafKey(entry.id)),
  ]);
}

export function sectionById(id: string): GraphSectionMeta {
  const found = SECTIONS.find((section) => section.id === id);
  if (!found) throw new Error(`未知的节点分类: ${id}`);
  return found;
}
