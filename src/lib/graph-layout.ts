import {
  GROUPS,
  SECTIONS,
  sectionById,
  type GraphEntry,
  type GraphGroupMeta,
  type GraphSectionMeta,
  type GroupId,
} from './graph';

/** 节点尺寸是布局与渲染的唯一来源, 样式层不再重复声明宽高 */
export const NODE_SIZE = {
  root: { width: 132, height: 84 },
  category: { width: 208, height: 64 },
  section: { width: 188, height: 56 },
  leaf: { width: 268, height: 60 },
} as const;

const AXIS = {
  rootX: 0,
  groupX: 350,
  /** 分组下有分类时, 分类与叶子依次右移一列 */
  sectionX: 690,
  leafX: 1030,
  /** 分组没有分类时, 叶子直接贴在分组右侧 */
  directLeafX: 690,
  groupGapY: 132,
  sectionGapY: 96,
  leafGapY: 78,
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export interface LaidOutLeaf {
  entry: GraphEntry;
  /** 节点中心坐标 */
  center: Point;
}

export interface LaidOutSection {
  meta: GraphSectionMeta;
  center: Point;
  leaves: LaidOutLeaf[];
}

export interface LaidOutGroup {
  meta: GraphGroupMeta;
  center: Point;
  /** 直接挂在分组下的叶子, 与 sections 互斥 */
  leaves: LaidOutLeaf[];
  sections: LaidOutSection[];
}

export interface GraphModel {
  root: Point;
  groups: LaidOutGroup[];
}

/** 画布的展开状态: 聚焦分组时露出分类, 聚焦分类时再露出叶子 */
export interface GraphExpansion {
  group: GroupId;
  section?: string;
}

/** n 个节点纵向堆叠占用的高度 */
const stackHeight = (count: number, gap: number, nodeHeight: number) =>
  count === 0 ? 0 : (count - 1) * gap + nodeHeight;

const leafSpan = (count: number) => stackHeight(count, AXIS.leafGapY, NODE_SIZE.leaf.height);

const leavesOf = (entries: GraphEntry[], section?: string) =>
  entries.filter((entry) => entry.section === section);

/** 分组内实际出现的分类, 按 SECTIONS 的声明顺序排列 */
function sectionsOf(entries: GraphEntry[]): GraphSectionMeta[] {
  const used = new Set(entries.map((entry) => entry.section).filter((id): id is string => !!id));
  // 未知分类在构建期报错, 避免条目悄悄从画布上消失
  for (const id of used) sectionById(id);
  return SECTIONS.filter((section) => used.has(section.id));
}

/** 分类块展开时容纳叶子, 收起时只占分类节点的高度 */
const sectionBlockHeight = (count: number, expanded: boolean) =>
  expanded ? Math.max(leafSpan(count), NODE_SIZE.section.height) : NODE_SIZE.section.height;

/** 分组的完整内容高度, 只有展开的分组才按它占位 */
function groupContentHeight(entries: GraphEntry[], expandedSection?: string): number {
  const sections = sectionsOf(entries);
  if (sections.length === 0) {
    return Math.max(leafSpan(entries.length), NODE_SIZE.category.height);
  }

  const total =
    sections.reduce(
      (sum, section) =>
        sum +
        sectionBlockHeight(leavesOf(entries, section.id).length, section.id === expandedSection),
      0,
    ) +
    AXIS.sectionGapY * (sections.length - 1);
  return Math.max(total, NODE_SIZE.category.height);
}

function buildSection(
  meta: GraphSectionMeta,
  entries: GraphEntry[],
  top: number,
  expanded: boolean,
): LaidOutSection {
  const height = sectionBlockHeight(entries.length, expanded);
  const leafTop = top + (height - leafSpan(entries.length)) / 2;

  return {
    meta,
    center: { x: AXIS.sectionX, y: top + height / 2 },
    leaves: entries.map((entry, index) => ({
      entry,
      center: { x: AXIS.leafX, y: leafTop + NODE_SIZE.leaf.height / 2 + index * AXIS.leafGapY },
    })),
  };
}

function buildGroup(
  meta: GraphGroupMeta,
  entries: GraphEntry[],
  top: number,
  height: number,
  expandedSection?: string,
): LaidOutGroup {
  const center: Point = { x: AXIS.groupX, y: top + height / 2 };
  const leafTop = top + (height - leafSpan(entries.length)) / 2;
  const sections = sectionsOf(entries);

  if (sections.length === 0) {
    return {
      meta,
      center,
      leaves: entries.map((entry, index) => ({
        entry,
        center: {
          x: AXIS.directLeafX,
          y: leafTop + NODE_SIZE.leaf.height / 2 + index * AXIS.leafGapY,
        },
      })),
      sections: [],
    };
  }

  let cursor = top;
  const laidOut = sections.map((section) => {
    const laid = buildSection(
      section,
      leavesOf(entries, section.id),
      cursor,
      section.id === expandedSection,
    );
    cursor += sectionBlockHeight(leavesOf(entries, section.id).length, section.id === expandedSection);
    cursor += AXIS.sectionGapY;
    return laid;
  });

  return { meta, center, leaves: [], sections: laidOut };
}

/**
 * 把内容条目折算成树状坐标: 根在左, 分组、分类、叶子依次向右展开.
 * 未展开的分组只占一个节点的高度, 因此总览不会被大量条目撑散; 展开的分组按内容高度占位,
 * 块与块纵向堆叠, 分类与叶子因此永远不会互相重叠. 没有条目的分组不参与布局.
 */
export function buildGraph(entries: GraphEntry[], expansion?: GraphExpansion): GraphModel {
  const blocks = GROUPS.filter((meta) => entries.some((entry) => entry.group === meta.id)).map(
    (meta) => {
      const groupEntries = entries.filter((entry) => entry.group === meta.id);
      const expanded = expansion?.group === meta.id;
      return {
        meta,
        entries: groupEntries,
        expanded,
        height: expanded
          ? groupContentHeight(groupEntries, expansion?.section)
          : NODE_SIZE.category.height,
      };
    },
  );

  const total =
    blocks.reduce((sum, block) => sum + block.height, 0) +
    AXIS.groupGapY * Math.max(blocks.length - 1, 0);

  let cursor = -total / 2;
  const groups = blocks.map((block) => {
    const laid = buildGroup(
      block.meta,
      block.entries,
      cursor,
      block.height,
      block.expanded ? expansion?.section : undefined,
    );
    cursor += block.height + AXIS.groupGapY;
    return laid;
  });

  return { root: { x: AXIS.rootX, y: 0 }, groups };
}

/** 中心坐标换算成画布使用的左上角坐标 */
export function rectOf(center: Point, size: { width: number; height: number }): Rect {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

/** 取若干矩形的外包矩形, 供视口计算使用 */
export function unionRect(rects: Rect[]): Rect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
