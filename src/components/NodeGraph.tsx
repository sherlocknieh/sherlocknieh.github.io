import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Background,
  BackgroundVariant,
  Handle,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  NODE_SIZE,
  buildGraph,
  rectOf,
  unionRect,
  type LaidOutLeaf,
  type Rect,
} from '../lib/graph-layout';
import {
  defaultCollapsed,
  groupKey,
  sectionKey,
  type GraphEntry,
  type GroupId,
} from '../lib/graph';

export interface GraphProfile {
  name: string;
}

interface RootData extends Record<string, unknown> {
  kind: 'root';
  label: string;
  /** 根节点收起时整棵树只剩它自己 */
  open: boolean;
  count: number;
}

interface GroupData extends Record<string, unknown> {
  kind: 'group' | 'section';
  /** 分组 id 或分类 id */
  id: string;
  /** 分类所属的分组, 分组节点填自身 id */
  owner: GroupId;
  label: string;
  hint: string;
  count: number;
  active: boolean;
  /** 是否还有可展开的条目, 没有条目的节点不显示展开按钮 */
  expandable: boolean;
  /** 条目当前是否展开 */
  open: boolean;
}

interface LeafData extends Record<string, unknown> {
  kind: 'leaf';
  label: string;
  href: string;
  meta?: string;
  external?: boolean;
}

type FlowNode = Node<RootData | GroupData | LeafData>;

/** 聚焦目标: 分组或分组下的分类, 只影响取景, 不影响展开状态 */
type Focus = { group: GroupId; section?: string };

/** 节点卡片通过 context 改画布状态, 避免把回调塞进可序列化的 data 里 */
const GraphInteraction = createContext<{
  focusGroup: (id: GroupId) => void;
  focusSection: (group: GroupId, section: string) => void;
  toggleGroup: (id: GroupId) => void;
  toggleSection: (group: GroupId, section: string) => void;
  toggleRoot: () => void;
  reset: () => void;
}>({
  focusGroup: () => {},
  focusSection: () => {},
  toggleGroup: () => {},
  toggleSection: () => {},
  toggleRoot: () => {},
  reset: () => {},
});

const groupNodeId = (id: GroupId) => `group-${id}`;
const sectionNodeId = (group: GroupId, section: string) => `section-${group}-${section}`;

const ExternalIcon = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" focusable="false">
    <path
      d="M6 3.5h6.5V10M12.5 3.5 6.5 9.5M10 12.5H4.5a1 1 0 0 1-1-1V6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MinusIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
    <path d="M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const ResetIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
    <path
      d="M3 8a5 5 0 1 0 1.7-3.7M3 2.5V5.5h3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function RootNode({ data }: NodeProps) {
  const d = data as unknown as RootData;
  const { reset, toggleRoot } = useContext(GraphInteraction);

  return (
    <div className="node-card node-card--group">
      <Handle type="source" position={Position.Right} className="node-handle" isConnectable={false} />
      <button type="button" className="node-main" onClick={reset} title="回到总览">
        <span className="node-group-label">{d.label}</span>
      </button>
      <button
        type="button"
        className={`node-toggle${d.open ? ' is-open' : ''}`}
        aria-expanded={d.open}
        aria-label={d.open ? `收起 ${d.count} 个分组` : `展开 ${d.count} 个分组`}
        title={d.open ? '收起' : `展开 ${d.count} 个分组`}
        onClick={toggleRoot}
      >
        {d.open ? <MinusIcon /> : <span className="node-count">{d.count}</span>}
      </button>
    </div>
  );
}

function GroupNode({ data }: NodeProps) {
  const d = data as unknown as GroupData;
  const { focusGroup, focusSection, toggleGroup, toggleSection } = useContext(GraphInteraction);
  const isSection = d.kind === 'section';

  return (
    <div className={`node-card node-card--${d.kind}${d.active ? ' is-active' : ''}`} title={d.hint}>
      <Handle type="target" position={Position.Left} className="node-handle" isConnectable={false} />
      <button
        type="button"
        className="node-main"
        onClick={() => (isSection ? focusSection(d.owner, d.id) : focusGroup(d.owner))}
      >
        <span className="node-group-label">{d.label}</span>
      </button>
      {d.expandable && (
        // 计数与展开按钮合为一体: 收起时显示子节点数, 展开后变成收起图标
        <button
          type="button"
          className={`node-toggle${d.open ? ' is-open' : ''}`}
          aria-expanded={d.open}
          aria-label={d.open ? `收起 ${d.count} 个子节点` : `展开 ${d.count} 个子节点`}
          title={d.open ? '收起' : `展开 ${d.count} 项`}
          onClick={() => (isSection ? toggleSection(d.owner, d.id) : toggleGroup(d.owner))}
        >
          {d.open ? <MinusIcon /> : <span className="node-count">{d.count}</span>}
        </button>
      )}
      <Handle type="source" position={Position.Right} className="node-handle" isConnectable={false} />
    </div>
  );
}

function LeafNode({ data }: NodeProps) {
  const d = data as unknown as LeafData;

  return (
    <div className="node-card node-card--leaf">
      <Handle type="target" position={Position.Left} className="node-handle" isConnectable={false} />
      <a
        className="node-link"
        href={d.href}
        target={d.external ? '_blank' : undefined}
        rel={d.external ? 'noopener noreferrer' : undefined}
      >
        <span className="node-leaf-label">{d.label}</span>
        <span className="node-leaf-meta">
          {d.meta}
          {d.external && <ExternalIcon />}
        </span>
      </a>
    </div>
  );
}

const nodeTypes = { root: RootNode, category: GroupNode, leaf: LeafNode };

function GraphCanvas({ entries, profile }: { entries: GraphEntry[]; profile: GraphProfile }) {
  // 节点始终全部展开, 点击只改变取景焦点
  const [focus, setFocus] = useState<Focus | null>(null);
  const [resizeTick, setResizeTick] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);
  const prevFocus = useRef<Focus | null>(null);
  const { getViewport, setViewport } = useReactFlow();

  // 默认展开到三级: 根 → 分组 → 分类, 分类下的条目默认收起, 由节点上的按钮展开
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(defaultCollapsed);
  // 根节点收起时整棵树只剩根, 与分组收起互不影响
  const [rootOpen, setRootOpen] = useState(true);

  const model = useMemo(() => buildGraph(entries, collapsed), [entries, collapsed]);

  /** 全部节点的画布矩形, 视口计算只依赖它, 不读浏览器测量值 */
  const rects = useMemo(() => {
    const map = new Map<string, Rect>();
    map.set('root', rectOf(model.root, NODE_SIZE.root));
    for (const group of model.groups) {
      map.set(groupNodeId(group.meta.id), rectOf(group.center, NODE_SIZE.category));
      for (const leaf of group.leaves) {
        map.set(leaf.entry.id, rectOf(leaf.center, NODE_SIZE.leaf));
      }
      for (const section of group.sections) {
        map.set(
          sectionNodeId(group.meta.id, section.meta.id),
          rectOf(section.center, NODE_SIZE.section),
        );
        for (const leaf of section.leaves) {
          map.set(leaf.entry.id, rectOf(leaf.center, NODE_SIZE.leaf));
        }
      }
    }
    return map;
  }, [model]);

  /**
   * 收起/展开前记下被点节点此刻的屏幕位置: 布局会随总高度重排, 只有相机跟着它走,
   * 视觉上才是"点哪个节点就从那个节点收拢", 而不是整棵树连相机一起挪
   */
  const pinRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const pinNode = useCallback(
    (id: string) => {
      const rect = rects.get(id);
      const viewport = getViewport();
      pinRef.current = rect
        ? {
            id,
            x: (rect.x + rect.width / 2) * viewport.zoom + viewport.x,
            y: (rect.y + rect.height / 2) * viewport.zoom + viewport.y,
          }
        : null;
    },
    [getViewport, rects],
  );

  /** 聚焦是幂等的: 重复点击同一节点保持选中, 取消选中只走总览按钮或空白处 */
  const focusGroup = useCallback((id: GroupId) => {
    setFocus({ group: id });
    // 聚焦时自动展开这一支, 否则聚焦后看不到内容
    setCollapsed((current) => {
      if (!current.has(groupKey(id))) return current;
      const next = new Set(current);
      next.delete(groupKey(id));
      return next;
    });
  }, []);

  const focusSection = useCallback((group: GroupId, section: string) => {
    setFocus({ group, section });
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete(groupKey(group));
      next.delete(sectionKey(group, section));
      return next;
    });
  }, []);

  /** 分组只控制分类是否可见, 分类自身的条目展开状态保持不变 */
  const toggleGroup = useCallback(
    (id: GroupId) => {
      pinNode(groupNodeId(id));
      // 收起时取景退回上一级: 正看着这个分组就回到根节点, 聚焦别处则保持不动
      if (!collapsed.has(groupKey(id))) {
        setFocus((current) => (current?.group === id ? null : current));
      }
      setCollapsed((current) => {
        const next = new Set(current);
        const key = groupKey(id);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [collapsed, pinNode],
  );

  const toggleSection = useCallback(
    (group: GroupId, section: string) => {
      pinNode(sectionNodeId(group, section));
      // 收起分类时取景退回到所属分组
      if (!collapsed.has(sectionKey(group, section))) {
        setFocus((current) =>
          current?.group === group && current.section === section ? { group } : current,
        );
      }
      setCollapsed((current) => {
        const next = new Set(current);
        const key = sectionKey(group, section);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [collapsed, pinNode],
  );

  const toggleRoot = useCallback(() => {
    if (rootOpen) {
      // 收起后整棵树只剩根: 焦点没有意义, 视野也回到中央, 不钉住被点位置
      pinRef.current = null;
      setFocus(null);
    } else {
      pinNode('root');
    }
    setRootOpen((open) => !open);
  }, [pinNode, rootOpen]);

  const reset = useCallback(() => {
    setFocus(null);
    setCollapsed(defaultCollapsed());
    setRootOpen(true);
  }, []);

  /** 取景范围: 无焦点时是整棵树, 聚焦分组时是该分组这一支, 聚焦分类时再收窄到该分类 */
  const visibleIds = useMemo(() => {
    const ids = ['root'];
    if (!rootOpen) return ids;
    for (const group of model.groups) {
      const gid = group.meta.id;
      if (focus && focus.group !== gid) continue;
      ids.push(groupNodeId(gid));
      if (collapsed.has(groupKey(gid))) continue;
      for (const leaf of group.leaves) ids.push(leaf.entry.id);
      for (const section of group.sections) {
        if (focus?.section && focus.section !== section.meta.id) continue;
        ids.push(sectionNodeId(gid, section.meta.id));
        if (collapsed.has(sectionKey(gid, section.meta.id))) continue;
        for (const leaf of section.leaves) ids.push(leaf.entry.id);
      }
    }
    return ids;
  }, [collapsed, focus, model, rootOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const visible = visibleIds
      .map((id) => rects.get(id))
      .filter((rect): rect is Rect => rect !== undefined);
    if (visible.length === 0) return;

    const box = unionRect(visible);
    const margin = 40;
    const rawFit = Math.min(
      (width - margin * 2) / Math.max(box.width, 1),
      (height - margin * 2) / Math.max(box.height, 1),
    );

    // 整棵树装得下就完整取景; 装不下时锁定最小缩放并从树顶开始显示, 其余靠拖拽查看
    const fitZoom = Math.min(rawFit, 1.1);
    const zoom = Math.max(fitZoom, 0.55);
    const fits = fitZoom >= 0.55;

    // 聚焦(含收起后退回上层)要重新取景; 只增减子节点时保留缩放, 由 pin 把被点节点钉在原处
    const focusChanged = prevFocus.current !== focus;
    prevFocus.current = focus;
    const pin = focusChanged ? null : pinRef.current;
    pinRef.current = null;
    const pinned = pin ? rects.get(pin.id) : undefined;
    const current = pinned ? getViewport() : null;

    // 聚焦时把焦点节点放在垂直居中、水平偏左的位置, 右侧留给展开出来的内容
    const anchorId = focus
      ? focus.section
        ? sectionNodeId(focus.group, focus.section)
        : groupNodeId(focus.group)
      : null;
    const anchor = anchorId ? rects.get(anchorId) : undefined;

    let viewport;
    if (pin && pinned && current && current.zoom <= rawFit) {
      // 剩余内容在现有缩放下装得下: 缩放不动, 只平移让被点节点停在原屏幕位置
      viewport = {
        x: pin.x - (pinned.x + pinned.width / 2) * current.zoom,
        y: pin.y - (pinned.y + pinned.height / 2) * current.zoom,
        zoom: current.zoom,
      };
    } else if (anchor) {
      // 焦点节点固定在水平 32%、垂直居中; 缩放按它左侧残留、右侧内容与高度收紧, 保证边缘不被裁
      const anchorCx = anchor.x + anchor.width / 2;
      const anchorCy = anchor.y + anchor.height / 2;
      const anchorZoom = Math.max(
        Math.min(
          (width * 0.32) / Math.max(anchorCx - box.x, 1),
          (width * 0.68) / Math.max(box.x + box.width - anchorCx, 1),
          (height - margin * 2) / Math.max(box.height, 1),
          1.1,
        ),
        0.55,
      );
      viewport = {
        x: width * 0.32 - anchorCx * anchorZoom,
        y: height / 2 - anchorCy * anchorZoom,
        zoom: anchorZoom,
      };
    } else {
      viewport = {
        x: width / 2 - (box.x + box.width / 2) * zoom,
        y: fits ? height / 2 - (box.y + box.height / 2) * zoom : margin - box.y * zoom,
        zoom,
      };
    }

    // 首次取景直接定位, 此后的聚焦/缩放变化用动画过渡, 让平移过程可见
    // 后台标签页里动画会被暂停, 此时退化为瞬时定位, 否则画布会停在默认位置
    const animate = didInit.current && document.visibilityState === 'visible';
    didInit.current = true;
    void setViewport(viewport, { duration: animate ? 520 : 0 });
  }, [focus, getViewport, rects, resizeTick, setViewport, visibleIds]);

  // 画布尺寸变化后重新取景, 避免节点被裁到视野外
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setResizeTick((tick) => tick + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const nodes = useMemo<FlowNode[]>(() => {
    const rootRect = rects.get('root')!;
    const list: FlowNode[] = [
      {
        id: 'root',
        type: 'root',
        position: { x: rootRect.x, y: rootRect.y },
        style: { width: rootRect.width, height: rootRect.height },
        data: {
          kind: 'root',
          label: profile.name,
          open: rootOpen,
          count: model.groups.length,
        },
        draggable: false,
      },
    ];

    /** 叶子常驻可点, 焦点只影响高亮 */
    const pushLeaf = (leaf: LaidOutLeaf, highlighted: boolean) => {
      const leafRect = rects.get(leaf.entry.id)!;
      list.push({
        id: leaf.entry.id,
        type: 'leaf',
        position: { x: leafRect.x, y: leafRect.y },
        style: {
          width: leafRect.width,
          height: leafRect.height,
        },
        data: {
          kind: 'leaf',
          label: leaf.entry.label,
          href: leaf.entry.href,
          meta: leaf.entry.meta,
          external: leaf.entry.external,
        },
        className: highlighted ? 'is-revealed' : undefined,
        draggable: false,
      });
    };

    for (const group of rootOpen ? model.groups : []) {
      const gid = group.meta.id;
      const id = groupNodeId(gid);
      const rect = rects.get(id)!;
      const active = focus?.group === gid;
      // 计数只算直接子节点: 有分类时是分类数, 否则是直接挂的条目数
      const childCount = group.sections.length > 0 ? group.sections.length : group.leaves.length;
      // 分组展开表示它的分类可见, 收起时整组只留一个节点
      const groupOpen = !collapsed.has(groupKey(gid));

      list.push({
        id,
        type: 'category',
        position: { x: rect.x, y: rect.y },
        style: { width: rect.width, height: rect.height },
        data: {
          kind: 'group',
          id: gid,
          owner: gid,
          label: group.meta.label,
          hint: group.meta.hint,
          count: childCount,
          active,
          expandable: childCount > 0,
          open: groupOpen,
        },
        draggable: false,
      });

      // 分组收起时分类节点一并隐藏
      if (!groupOpen) continue;

      for (const section of group.sections) {
        const sid = sectionNodeId(gid, section.meta.id);
        const sectionRect = rects.get(sid)!;
        const sectionActive = active && focus?.section === section.meta.id;
        const sectionOpen = !collapsed.has(sectionKey(gid, section.meta.id));

        list.push({
          id: sid,
          type: 'category',
          position: { x: sectionRect.x, y: sectionRect.y },
          style: { width: sectionRect.width, height: sectionRect.height },
          data: {
            kind: 'section',
            id: section.meta.id,
            owner: gid,
            label: section.meta.label,
            hint: `${group.meta.label} · ${section.meta.label}`,
            count: section.leaves.length,
            active: sectionActive,
            expandable: section.leaves.length > 0,
            open: sectionOpen,
          },
          draggable: false,
        });

        // 分类下的条目属于第四级, 只在展开该分类时出现
        if (!sectionOpen) continue;
        for (const leaf of section.leaves) pushLeaf(leaf, sectionActive);
      }

      for (const leaf of group.leaves) pushLeaf(leaf, active);
    }

    return list;
  }, [collapsed, focus, model, profile, rects, rootOpen]);

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];

    const pushLeafEdge = (source: string, entryId: string, highlighted: boolean) => {
      list.push({
        id: `edge-${entryId}`,
        source,
        target: entryId,
        className: highlighted ? 'is-revealed' : undefined,
      });
    };

    for (const group of rootOpen ? model.groups : []) {
      const gid = group.meta.id;
      const active = focus?.group === gid;

      list.push({
        id: `edge-root-${gid}`,
        source: 'root',
        target: groupNodeId(gid),
      });

      if (collapsed.has(groupKey(gid))) continue;

      for (const section of group.sections) {
        const sid = sectionNodeId(gid, section.meta.id);
        list.push({
          id: `edge-${sid}`,
          source: groupNodeId(gid),
          target: sid,
        });

        const sectionActive = active && focus?.section === section.meta.id;
        if (collapsed.has(sectionKey(gid, section.meta.id))) continue;
        for (const leaf of section.leaves) pushLeafEdge(sid, leaf.entry.id, sectionActive);
      }

      for (const leaf of group.leaves) pushLeafEdge(groupNodeId(gid), leaf.entry.id, active);
    }

    return list;
  }, [collapsed, focus, model, rootOpen]);

  return (
    <GraphInteraction.Provider
      value={{ focusGroup, focusSection, toggleGroup, toggleSection, toggleRoot, reset }}
    >
      <div className="graph-shell">
        <div className="graph-canvas" ref={canvasRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            colorMode="dark"
            nodesDraggable={false}
            nodesConnectable={false}
            zoomOnDoubleClick={false}
            minZoom={0.2}
            maxZoom={1.6}
            onPaneClick={reset}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
            {focus && (
              <Panel position="top-right">
                <button type="button" className="graph-reset" onClick={reset}>
                  <ResetIcon />
                  总览
                </button>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>
    </GraphInteraction.Provider>
  );
}

export default function NodeGraph(props: { entries: GraphEntry[]; profile: GraphProfile }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas entries={props.entries} profile={props.profile} />
    </ReactFlowProvider>
  );
}
