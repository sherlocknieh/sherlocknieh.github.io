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
  ROOT_KEY,
  defaultCollapsed,
  groupKey,
  sectionKey,
  type GraphEntry,
  type GroupId,
} from '../lib/graph';

export interface GraphProfile {
  name: string;
}

/** 根、分组、分类共用同一套卡片数据, kind 只影响样式与文案 */
interface CardData extends Record<string, unknown> {
  kind: 'root' | 'group' | 'section';
  /** 根节点填 'root', 分类节点再带 section */
  group: 'root' | GroupId;
  section?: string;
  label: string;
  hint?: string;
  count: number;
  active: boolean;
  open: boolean;
}

interface LeafData extends Record<string, unknown> {
  kind: 'leaf';
  label: string;
  href: string;
  meta?: string;
  external?: boolean;
}

type FlowNode = Node<CardData | LeafData>;

/** 聚焦目标: 根、分组或分类, 只影响取景, 不影响展开状态 */
type Focus = { group: 'root'; section?: undefined } | { group: GroupId; section?: string };

const sameFocus = (a: Focus | null, b: Focus | null) =>
  a === b || (!!a && !!b && a.group === b.group && a.section === b.section);

/** 节点卡片通过 context 改画布状态, 避免把回调塞进可序列化的 data 里 */
const GraphInteraction = createContext<{
  focus: (group: 'root' | GroupId, section?: string) => void;
  toggle: (group: 'root' | GroupId, section?: string) => void;
}>({ focus: () => {}, toggle: () => {} });

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

/** 一张卡片同时服务根、分组与分类: 根没有入边, 其余节点都挂在父节点右侧 */
function CardNode({ data }: NodeProps) {
  const d = data as unknown as CardData;
  const { focus, toggle } = useContext(GraphInteraction);
  const isRoot = d.kind === 'root';
  const unit = isRoot ? '个分组' : '个子节点';

  return (
    <div className={`node-card node-card--${d.kind}${d.active ? ' is-active' : ''}`} title={d.hint}>
      {!isRoot && (
        <Handle type="target" position={Position.Left} className="node-handle" isConnectable={false} />
      )}
      <button
        type="button"
        className="node-main"
        onClick={() => focus(d.group, d.section)}
        title={isRoot ? '聚焦根节点' : undefined}
      >
        <span className="node-group-label">{d.label}</span>
      </button>
      {/* 计数与展开按钮合为一体: 收起时显示子节点数, 展开后变成收起图标 */}
      <button
        type="button"
        className={`node-toggle${d.open ? ' is-open' : ''}`}
        aria-expanded={d.open}
        aria-label={`${d.open ? '收起' : '展开'} ${d.count} ${unit}`}
        title={d.open ? '收起' : `展开 ${d.count} ${isRoot ? '个分组' : '项'}`}
        onClick={() => toggle(d.group, d.section)}
      >
        {d.open ? <MinusIcon /> : <span className="node-count">{d.count}</span>}
      </button>
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

const nodeTypes = { root: CardNode, category: CardNode, leaf: LeafNode };

function GraphCanvas({ entries, profile }: { entries: GraphEntry[]; profile: GraphProfile }) {
  const [focus, setFocus] = useState<Focus | null>(null);
  const [resizeTick, setResizeTick] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);
  const prevFocus = useRef<Focus | null>(null);
  const animRef = useRef<number | null>(null);
  const { getViewport, setViewport } = useReactFlow();

  // 默认展开到二级: 根与分组可见, 分类和条目都收起; 根收起状态与它们共用 collapsed
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(defaultCollapsed);
  const rootOpen = !collapsed.has(ROOT_KEY);

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
   * 收起前记下被点节点此刻的屏幕位置: 布局会随总高度重排, 只有相机跟着它走,
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

  /** 聚焦是幂等的: 重复点击保持选中, 取消选中只走总览按钮或空白处; 聚焦同时展开该节点这一支 */
  const focusNode = useCallback((group: 'root' | GroupId, section?: string) => {
    if (group === 'root') {
      setFocus({ group: 'root' });
      setCollapsed((current) => {
        if (!current.has(ROOT_KEY)) return current;
        const next = new Set(current);
        next.delete(ROOT_KEY);
        return next;
      });
      return;
    }

    setFocus(section ? { group, section } : { group });
    setCollapsed((current) => {
      const keys = section ? [groupKey(group), sectionKey(group, section)] : [groupKey(group)];
      if (keys.every((key) => !current.has(key))) return current;
      const next = new Set(current);
      for (const key of keys) next.delete(key);
      return next;
    });
  }, []);

  /**
   * 展开即聚焦, 收起则把取景退回上一级: 分类回到所属分组, 分组或根回到总览,
   * 焦点在别处时保持不动. 没有焦点变化时靠 pin 保留缩放与位置.
   */
  const toggleNode = useCallback(
    (group: 'root' | GroupId, section?: string) => {
      if (group === 'root') {
        pinRef.current = null;
        if (rootOpen) setFocus(null);
        else setFocus({ group: 'root' });
        setCollapsed((current) => {
          const next = new Set(current);
          if (next.has(ROOT_KEY)) next.delete(ROOT_KEY);
          else next.add(ROOT_KEY);
          return next;
        });
        return;
      }

      const key = section ? sectionKey(group, section) : groupKey(group);
      if (collapsed.has(key)) {
        // 展开即聚焦: 取景正好框住这个节点和刚露出的子节点
        setFocus(section ? { group, section } : { group });
      } else {
        pinNode(section ? sectionNodeId(group, section) : groupNodeId(group));
        setFocus((current) => {
          if (current?.group !== group) return current;
          if (!section) return null;
          return current.section === section ? { group } : current;
        });
      }
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [collapsed, pinNode, rootOpen],
  );

  const reset = useCallback(() => {
    setFocus(null);
    setCollapsed(defaultCollapsed());
  }, []);

  /**
   * 一次遍历同时产出渲染用的 nodes/edges 与取景范围.
   * 可见性只在这里判断, 避免渲染、连线和取景各写一份规则而漂移.
   */
  const view = useMemo(() => {
    const nodes: FlowNode[] = [];
    const edges: Edge[] = [];
    const frameIds: string[] = [];

    const rootRect = rects.get('root')!;
    nodes.push({
      id: 'root',
      type: 'root',
      position: { x: rootRect.x, y: rootRect.y },
      style: { width: rootRect.width, height: rootRect.height },
      data: {
        kind: 'root',
        group: 'root',
        label: profile.name,
        count: model.groups.length,
        active: focus?.group === 'root',
        open: rootOpen,
      },
      draggable: false,
    });

    // 根收起时整棵树只剩根, 取景也只框它
    if (!rootOpen) return { nodes, edges, frameIds: ['root'] };

    // 总览或聚焦根时根参与取景; 聚焦某一支时不框祖先, 否则这一支会被缩得很小
    const showRoot = !focus || focus.group === 'root';
    if (showRoot) frameIds.push('root');

    const pushLeaf = (leaf: LaidOutLeaf, source: string, highlighted: boolean, framed: boolean) => {
      const rect = rects.get(leaf.entry.id)!;
      nodes.push({
        id: leaf.entry.id,
        type: 'leaf',
        position: { x: rect.x, y: rect.y },
        style: { width: rect.width, height: rect.height },
        data: {
          kind: 'leaf',
          label: leaf.entry.label,
          href: leaf.entry.href,
          meta: leaf.entry.meta,
          external: leaf.entry.external,
        },
        draggable: false,
      });
      edges.push({
        id: `edge-${leaf.entry.id}`,
        source,
        target: leaf.entry.id,
        className: highlighted ? 'is-revealed' : undefined,
      });
      if (framed) frameIds.push(leaf.entry.id);
    };

    for (const group of model.groups) {
      const gid = group.meta.id;
      const id = groupNodeId(gid);
      const rect = rects.get(id)!;
      const groupActive = focus?.group === gid;
      const groupOpen = !collapsed.has(groupKey(gid));
      // 聚焦某一支时其余分支照常渲染, 只是不参与取景
      const inBranch = !focus || focus.group === 'root' || focus.group === gid;
      const groupFramed = inBranch && (showRoot || !focus?.section);
      // 计数只算直接子节点: 有分类时是分类数, 否则是直接挂的条目数
      const childCount = group.sections.length > 0 ? group.sections.length : group.leaves.length;

      nodes.push({
        id,
        type: 'category',
        position: { x: rect.x, y: rect.y },
        style: { width: rect.width, height: rect.height },
        data: {
          kind: 'group',
          group: gid,
          label: group.meta.label,
          hint: group.meta.hint,
          count: childCount,
          active: groupActive,
          open: groupOpen,
        },
        draggable: false,
      });

      edges.push({ id: `edge-root-${gid}`, source: 'root', target: id });
      if (groupFramed) frameIds.push(id);
      // 分组收起时分类与条目都不渲染
      if (!groupOpen) continue;

      for (const section of group.sections) {
        const sid = sectionNodeId(gid, section.meta.id);
        const sectionRect = rects.get(sid)!;
        const sectionActive = groupActive && focus?.section === section.meta.id;
        const sectionOpen = !collapsed.has(sectionKey(gid, section.meta.id));
        const sectionFramed = inBranch && (!focus?.section || focus.section === section.meta.id);

        nodes.push({
          id: sid,
          type: 'category',
          position: { x: sectionRect.x, y: sectionRect.y },
          style: { width: sectionRect.width, height: sectionRect.height },
          data: {
            kind: 'section',
            group: gid,
            section: section.meta.id,
            label: section.meta.label,
            hint: `${group.meta.label} · ${section.meta.label}`,
            count: section.leaves.length,
            active: sectionActive,
            open: sectionOpen,
          },
          draggable: false,
        });

        edges.push({ id: `edge-${sid}`, source: id, target: sid });
        if (sectionFramed) frameIds.push(sid);
        // 分类收起时只留分类节点本身
        if (!sectionOpen) continue;
        for (const leaf of section.leaves) pushLeaf(leaf, sid, sectionActive, sectionFramed);
      }

      for (const leaf of group.leaves) pushLeaf(leaf, id, groupActive, groupFramed);
    }

    return { nodes, edges, frameIds };
  }, [collapsed, focus, model, profile, rects, rootOpen]);

  const { nodes, edges, frameIds } = view;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const visible = frameIds
      .map((id) => rects.get(id))
      .filter((rect): rect is Rect => rect !== undefined);
    if (visible.length === 0) return;

    const box = unionRect(visible);
    const margin = 40;
    const fitZoom = Math.min(
      (width - margin * 2) / Math.max(box.width, 1),
      (height - margin * 2) / Math.max(box.height, 1),
      1.1,
    );

    // 取景范围就是焦点节点及其子节点, 整体居中铺满; 聚焦时允许比总览更小的缩放, 优先让整支进视野
    const minZoom = focus ? 0.2 : 0.55;
    const zoom = Math.max(fitZoom, minZoom);
    const fits = fitZoom >= minZoom;

    // 聚焦(含收起后退回上层)要重新取景; 只增减子节点时保留缩放, 由 pin 把被点节点钉在原处
    const focusChanged = !sameFocus(prevFocus.current, focus);
    prevFocus.current = focus;
    const pin = focusChanged ? null : pinRef.current;
    pinRef.current = null;
    const pinned = pin ? rects.get(pin.id) : undefined;
    const current = pinned ? getViewport() : null;

    let viewport;
    if (pin && pinned && current) {
      // 只平移不缩放: 始终保留当前缩放, 被点节点停在原屏幕位置, 超出的内容靠拖动查看
      viewport = {
        x: pin.x - (pinned.x + pinned.width / 2) * current.zoom,
        y: pin.y - (pinned.y + pinned.height / 2) * current.zoom,
        zoom: current.zoom,
      };
    } else {
      viewport = {
        x: width / 2 - (box.x + box.width / 2) * zoom,
        y: fits ? height / 2 - (box.y + box.height / 2) * zoom : margin - box.y * zoom,
        zoom,
      };
    }

    // 视口过渡自己算: React Flow 的 duration 走 d3 的 smooth zoom, 远距离平移时会先缩小再放大,
    // 这里改成屏幕中心的世界坐标线性插值 + 缩放对数插值, 缩放只朝目标方向单调变化
    const animate = didInit.current && document.visibilityState === 'visible';
    didInit.current = true;
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    if (!animate) {
      animRef.current = null;
      void setViewport(viewport, { duration: 0 });
      return;
    }

    // 后台标签页里 requestAnimationFrame 会被暂停, 所以只在页面可见时才走这段
    const start = getViewport();
    const centerOf = (vp: { x: number; y: number; zoom: number }) => ({
      x: (width / 2 - vp.x) / vp.zoom,
      y: (height / 2 - vp.y) / vp.zoom,
    });
    const from = centerOf(start);
    const to = centerOf(viewport);
    const logFrom = Math.log(start.zoom);
    const logTo = Math.log(viewport.zoom);
    const started = performance.now();
    const duration = 520;

    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      const zoom = Math.exp(logFrom + (logTo - logFrom) * eased);
      const cx = from.x + (to.x - from.x) * eased;
      const cy = from.y + (to.y - from.y) * eased;
      void setViewport(
        { x: width / 2 - cx * zoom, y: height / 2 - cy * zoom, zoom },
        { duration: 0 },
      );
      animRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    animRef.current = requestAnimationFrame(step);
  }, [focus, frameIds, getViewport, rects, resizeTick, setViewport]);

  // 用户主动拖拽或滚轮缩放时中断取景过渡, 避免相机和手势互相拉扯
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const interrupt = () => {
      if (animRef.current === null) return;
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };
    canvas.addEventListener('pointerdown', interrupt);
    canvas.addEventListener('wheel', interrupt, { passive: true });
    return () => {
      canvas.removeEventListener('pointerdown', interrupt);
      canvas.removeEventListener('wheel', interrupt);
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // 画布尺寸变化后重新取景, 避免节点被裁到视野外
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setResizeTick((tick) => tick + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <GraphInteraction.Provider value={{ focus: focusNode, toggle: toggleNode }}>
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
