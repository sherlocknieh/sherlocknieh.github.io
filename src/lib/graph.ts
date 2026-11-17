/**
 * 节点图的概念模型: 分组是根节点下的一级类别, 分类是分组内部的主题切分, 叶子是内容集合里的条目.
 * 维度与分类的标签写死在这里, 内容只负责声明自己属于哪个分组和分类.
 */

export const GROUP_IDS = ['apps', 'lab', 'tools', 'writing', 'about'] as const;

export type GroupId = (typeof GROUP_IDS)[number];

export interface GraphGroupMeta {
  id: GroupId;
  label: string;
  hint: string;
}

export const GROUPS: readonly GraphGroupMeta[] = [
  { id: 'apps', label: '在线APP', hint: '能直接打开用的东西' },
  { id: 'tools', label: '插件&工具', hint: '装进浏览器和系统里的小东西' },
  { id: 'lab', label: '学习与实验', hint: '课程、练习与折腾' },
  { id: 'writing', label: '写作', hint: '写过的东西' },
  { id: 'about', label: '关于', hint: '关于我' },
];

/** 分类只用于在分组内部收拢同主题条目, 顺序即画布上的纵向顺序 */
export interface GraphSectionMeta {
  id: string;
  label: string;
  /** 分类归属的分组, 决定它挂在哪个分组节点下 */
  group: GroupId;
}

export const SECTIONS: readonly GraphSectionMeta[] = [
  { id: 'extensions', label: '浏览器插件', group: 'tools' },
  { id: 'userscripts', label: '油猴脚本', group: 'tools' },
  { id: 'vscode', label: 'VSCode插件', group: 'tools' },
  { id: 'desktop', label: '桌面工具', group: 'tools' },
  { id: 'devtools', label: '开发工具', group: 'tools' },
];

export const SECTION_IDS = SECTIONS.map((section) => section.id);

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
}

/** 收起状态的键: 分组用自身 id 表示收起它直接挂的条目, 分类用 `分组/分类` 表示收起它的条目 */
export const groupKey = (id: GroupId) => id;
export const sectionKey = (group: GroupId, section: string) => `${group}/${section}`;

/** 默认收起所有分类的条目: 画布一进来只展开到分类这一级 */
export function defaultCollapsed(): Set<string> {
  return new Set(SECTIONS.map((section) => sectionKey(section.group, section.id)));
}

export function groupById(id: GroupId): GraphGroupMeta {
  const found = GROUPS.find((group) => group.id === id);
  if (!found) throw new Error(`未知的节点分组: ${id}`);
  return found;
}

export function sectionById(id: string): GraphSectionMeta {
  const found = SECTIONS.find((section) => section.id === id);
  if (!found) throw new Error(`未知的节点分类: ${id}`);
  return found;
}
