/**
 * 节点图的概念模型: 分组是稳定的内容形态, 分类是分组内部的主题切分, 叶子是内容集合里的条目.
 * 维度与分类的标签写死在这里, 内容只负责声明自己属于哪个分组和分类.
 */

export const GROUP_IDS = ['projects', 'writing', 'about'] as const;

export type GroupId = (typeof GROUP_IDS)[number];

export interface GraphGroupMeta {
  id: GroupId;
  label: string;
  hint: string;
}

export const GROUPS: readonly GraphGroupMeta[] = [
  { id: 'projects', label: '项目', hint: '做过的东西' },
  { id: 'writing', label: '写作', hint: '写过的东西' },
  { id: 'about', label: '关于', hint: '关于我' },
];

/** 分类只用于在分组内部收拢同主题条目, 顺序即画布上的纵向顺序 */
export interface GraphSectionMeta {
  id: string;
  label: string;
}

export const SECTIONS: readonly GraphSectionMeta[] = [
  { id: 'apps', label: '在线APP' },
  { id: 'extensions', label: '浏览器插件' },
  { id: 'userscripts', label: '油猴脚本' },
  { id: 'devtools', label: '开发工具' },
  { id: 'lab', label: '学习与实验' },
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
