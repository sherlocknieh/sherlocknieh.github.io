import { GROUPS, type GraphEntry, type GraphGroupMeta } from './graph';

/** 节点尺寸是布局与渲染的唯一来源, 样式层不再重复声明宽高 */
export const NODE_SIZE = {
  root: { width: 132, height: 84 },
  category: { width: 208, height: 64 },
  leaf: { width: 268, height: 60 },
} as const;

const AXIS = {
  rootX: 0,
  categoryX: 350,
  leafX: 690,
  categoryGapY: 132,
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

export interface LaidOutGroup {
  meta: GraphGroupMeta;
  center: Point;
  leaves: LaidOutLeaf[];
}

export interface GraphModel {
  root: Point;
  groups: LaidOutGroup[];
}

/**
 * 把内容条目折算成固定的树状坐标: 根在左, 分组纵向排列, 叶子再向右展开.
 * 坐标只由分组数量和叶子数量决定, 因此新增内容不会让已有节点跳动.
 * 没有条目的分组不参与布局.
 */
export function buildGraph(entries: GraphEntry[]): GraphModel {
  const used = GROUPS.filter((meta) => entries.some((entry) => entry.group === meta.id));
  const lastIndex = (used.length - 1) / 2;

  const groups = used.map((meta, index) => {
    const center: Point = {
      x: AXIS.categoryX,
      y: (index - lastIndex) * AXIS.categoryGapY,
    };
    const groupEntries = entries.filter((entry) => entry.group === meta.id);
    const firstLeaf = (groupEntries.length - 1) / 2;

    const leaves = groupEntries.map((entry, leafIndex) => ({
      entry,
      center: {
        x: AXIS.leafX,
        y: center.y + (leafIndex - firstLeaf) * AXIS.leafGapY,
      },
    }));

    return { meta, center, leaves };
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
