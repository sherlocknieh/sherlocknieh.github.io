/**
 * 节点图的概念模型: 分组是稳定的三个入口维度, 叶子是内容集合里的条目.
 * 分组维度写死在这里, 内容只负责声明自己属于哪个分组.
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

export interface GraphEntry {
  /** 全局唯一, 用作画布节点 id */
  id: string;
  group: GroupId;
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
