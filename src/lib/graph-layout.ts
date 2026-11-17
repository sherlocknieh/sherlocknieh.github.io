import {
  GROUPS,
  SECTIONS,
  groupKey,
  leafKey,
  sectionById,
  sectionKey,
  type GraphDetail,
  type GraphEntry,
  type GraphGroupMeta,
  type GraphSectionMeta,
  type GroupId,
} from './graph';

/** 节点尺寸是布局与渲染的唯一来源, 样式层不再重复声明宽高 */
export const NODE_SIZE = {
  root: { width: 208, height: 64 },
  category: { width: 208, height: 64 },
  section: { width: 188, height: 56 },
  leaf: { width: 268, height: 60 },
  detail: { width: 280, height: 72 },
} as const;

const AXIS = {
  rootX: 0,
  groupX: 350,
  /** 分组下有分类时, 分类与叶子依次右移一列 */
  sectionX: 690,
  leafX: 1030,
  /** 分组没有分类时, 叶子直接贴在分组右侧 */
  directLeafX: 690,
  /** 叶子展开后的详情列, 跟随叶子所在列右移一级 */
  detailX: 1370,
  directDetailX: 1030,
  /** 纵向间距按节点高度取比例: 分组大一级, 空档也略大 */
  groupGapY: 44,
  sectionGapY: 20,
  leafGapY: 74,
  detailGapY: 84,
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export interface LaidOutDetail {
  detail: GraphDetail;
  /** 详情节点中心坐标 */
  center: Point;
}

export interface LaidOutLeaf {
  entry: GraphEntry;
  /** 节点中心坐标 */
  center: Point;
  /** 叶子展开后的详情节点, 收起时为空 */
  details: LaidOutDetail[];
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

/** n 个节点纵向堆叠占用的高度 */
const stackHeight = (count: number, gap: number, nodeHeight: number) =>
  count === 0 ? 0 : (count - 1) * gap + nodeHeight;

/** 相邻叶子块之间的空隙: leafGapY 是单叶子的中心距, 减掉叶高就是块间距 */
const LEAF_GAP = AXIS.leafGapY - NODE_SIZE.leaf.height;

/** 详情列 n 个节点的总高度 */
const detailSpan = (count: number) =>
  stackHeight(count, AXIS.detailGapY, NODE_SIZE.detail.height);

const isLeafOpen = (id: string, collapsed: ReadonlySet<string>) =>
  !collapsed.has(leafKey(id));

/** 叶子块的高度: 展开详情时容纳详情列, 收起时只占叶子节点本身 */
const leafBlockHeight = (entry: GraphEntry, collapsed: ReadonlySet<string>) =>
  entry.details.length > 0 && isLeafOpen(entry.id, collapsed)
    ? Math.max(NODE_SIZE.leaf.height, detailSpan(entry.details.length))
    : NODE_SIZE.leaf.height;

/** 一组叶子按块纵向堆叠的总高度 */
const leavesSpan = (entries: GraphEntry[], collapsed: ReadonlySet<string>) =>
  entries.reduce((sum, entry) => sum + leafBlockHeight(entry, collapsed), 0) +
  LEAF_GAP * Math.max(entries.length - 1, 0);

const leavesOf = (entries: GraphEntry[], section?: string) =>
  entries.filter((entry) => entry.section === section);

/** 分组内实际出现的分类, 按 SECTIONS 的声明顺序排列 */
function sectionsOf(group: GroupId, entries: GraphEntry[]): GraphSectionMeta[] {
  const used = new Set(entries.map((entry) => entry.section).filter((id): id is string => !!id));
  // 未知分类在构建期报错, 避免条目悄悄从画布上消失
  for (const id of used) sectionById(id);
  return SECTIONS.filter((section) => section.group === group && used.has(section.id));
}

/** 分类块的高度: 展开时容纳叶子块, 收起时只占分类节点的高度 */
const sectionBlockHeight = (
  leaves: GraphEntry[],
  revealed: boolean,
  collapsed: ReadonlySet<string>,
) =>
  revealed
    ? Math.max(leavesSpan(leaves, collapsed), NODE_SIZE.section.height)
    : NODE_SIZE.section.height;

/** 分类的条目是否展开: 分组收起时整组收起, 否则看分类自身是否收起 */
const isSectionOpen = (group: GroupId, section: string, collapsed: ReadonlySet<string>) =>
  !collapsed.has(groupKey(group)) && !collapsed.has(sectionKey(group, section));

/** 分组的完整内容高度, 分类块与间距纵向堆叠 */
function groupContentHeight(
  group: GroupId,
  entries: GraphEntry[],
  collapsed: ReadonlySet<string>,
): number {
  // 分组收起时只占一个节点的高度, 分类与条目都不占位
  if (collapsed.has(groupKey(group))) return NODE_SIZE.category.height;

  const sections = sectionsOf(group, entries);
  if (sections.length === 0) {
    return Math.max(leavesSpan(entries, collapsed), NODE_SIZE.category.height);
  }

  const total =
    sections.reduce(
      (sum, section) =>
        sum +
        sectionBlockHeight(
          leavesOf(entries, section.id),
          isSectionOpen(group, section.id, collapsed),
          collapsed,
        ),
      0,
    ) +
    AXIS.sectionGapY * (sections.length - 1);
  return Math.max(total, NODE_SIZE.category.height);
}

/** 一个叶子及其展开后的详情列, 整体在自己的块里垂直居中 */
function buildLeaf(
  entry: GraphEntry,
  top: number,
  x: number,
  detailX: number,
  collapsed: ReadonlySet<string>,
): LaidOutLeaf {
  const height = leafBlockHeight(entry, collapsed);
  const span = detailSpan(entry.details.length);
  const detailTop = top + (height - span) / 2;
  const open = entry.details.length > 0 && isLeafOpen(entry.id, collapsed);

  return {
    entry,
    center: { x, y: top + height / 2 },
    details: open
      ? entry.details.map((detail, index) => ({
          detail,
          center: {
            x: detailX,
            y: detailTop + NODE_SIZE.detail.height / 2 + index * AXIS.detailGapY,
          },
        }))
      : [],
  };
}

/** 叶子按块纵向堆叠: 展开详情时块变高, 相邻叶子自然让位 */
function buildLeaves(
  entries: GraphEntry[],
  top: number,
  x: number,
  detailX: number,
  collapsed: ReadonlySet<string>,
): LaidOutLeaf[] {
  let cursor = top;
  return entries.map((entry) => {
    const leaf = buildLeaf(entry, cursor, x, detailX, collapsed);
    cursor += leafBlockHeight(entry, collapsed) + LEAF_GAP;
    return leaf;
  });
}

function buildSection(
  meta: GraphSectionMeta,
  entries: GraphEntry[],
  top: number,
  revealed: boolean,
  collapsed: ReadonlySet<string>,
): LaidOutSection {
  const height = sectionBlockHeight(entries, revealed, collapsed);
  const leafTop = top + (height - leavesSpan(entries, collapsed)) / 2;

  return {
    meta,
    center: { x: AXIS.sectionX, y: top + height / 2 },
    leaves: buildLeaves(entries, leafTop, AXIS.leafX, AXIS.detailX, collapsed),
  };
}

function buildGroup(
  meta: GraphGroupMeta,
  entries: GraphEntry[],
  top: number,
  height: number,
  collapsed: ReadonlySet<string>,
): LaidOutGroup {
  const center: Point = { x: AXIS.groupX, y: top + height / 2 };
  const sections = sectionsOf(meta.id, entries);

  if (sections.length === 0) {
    const leafTop = top + (height - leavesSpan(entries, collapsed)) / 2;
    return {
      meta,
      center,
      leaves: buildLeaves(entries, leafTop, AXIS.directLeafX, AXIS.directDetailX, collapsed),
      sections: [],
    };
  }

  let cursor = top;
  const laidOut = sections.map((section) => {
    const sectionRevealed = isSectionOpen(meta.id, section.id, collapsed);
    const laid = buildSection(
      section,
      leavesOf(entries, section.id),
      cursor,
      sectionRevealed,
      collapsed,
    );
    cursor +=
      sectionBlockHeight(leavesOf(entries, section.id), sectionRevealed, collapsed) +
      AXIS.sectionGapY;
    return laid;
  });

  return { meta, center, leaves: [], sections: laidOut };
}

/**
 * 把内容条目折算成树状坐标: 根在左, 分组、分类、叶子依次向右展开.
 * 默认展开到分类这一级, 分类下的条目由 collapsed 决定是否占位;
 * 展开的块按内容高度占位, 块与块纵向堆叠, 分类与叶子因此永远不会互相重叠.
 * 没有条目的分组不参与布局.
 */
export function buildGraph(entries: GraphEntry[], collapsed: ReadonlySet<string>): GraphModel {
  const blocks = GROUPS.filter((meta) => entries.some((entry) => entry.group === meta.id)).map(
    (meta) => {
      const groupEntries = entries.filter((entry) => entry.group === meta.id);
      return {
        meta,
        entries: groupEntries,
        height: groupContentHeight(meta.id, groupEntries, collapsed),
      };
    },
  );

  const total =
    blocks.reduce((sum, block) => sum + block.height, 0) +
    AXIS.groupGapY * Math.max(blocks.length - 1, 0);

  let cursor = -total / 2;
  const groups = blocks.map((block) => {
    const laid = buildGroup(block.meta, block.entries, cursor, block.height, collapsed);
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
