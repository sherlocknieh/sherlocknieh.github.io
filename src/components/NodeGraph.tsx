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
  Controls,
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
  rectOf,
  unionRect,
  type GraphModel,
  type Rect,
} from '../lib/graph-layout';
import type { GroupId } from '../lib/graph';

export interface GraphProfile {
  name: string;
  role: string;
  avatar: string;
}

interface RootData extends Record<string, unknown> {
  kind: 'root';
  label: string;
  subtitle: string;
  avatar: string;
}

interface GroupData extends Record<string, unknown> {
  kind: 'group';
  id: GroupId;
  label: string;
  hint: string;
  count: number;
  active: boolean;
}

interface LeafData extends Record<string, unknown> {
  kind: 'leaf';
  label: string;
  href: string;
  meta?: string;
  external?: boolean;
  revealed: boolean;
}

type FlowNode = Node<RootData | GroupData | LeafData>;

/** 节点卡片通过 context 改画布状态, 避免把回调塞进可序列化的 data 里 */
const GraphInteraction = createContext<{
  toggleGroup: (id: GroupId) => void;
  reset: () => void;
}>({ toggleGroup: () => {}, reset: () => {} });

const groupNodeId = (id: GroupId) => `group-${id}`;

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

const PlusMinusIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
    <path d="M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    {!open && (
      <path d="M8 3.5v9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    )}
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
  const { reset } = useContext(GraphInteraction);

  return (
    <button type="button" className="node-card node-card--root" onClick={reset} title="回到总览">
      <Handle type="source" position={Position.Right} className="node-handle" isConnectable={false} />
      <img className="node-avatar" src={d.avatar} alt="" width={52} height={52} />
      <span className="node-name">{d.label}</span>
      <span className="node-role">{d.subtitle}</span>
    </button>
  );
}

function GroupNode({ data }: NodeProps) {
  const d = data as unknown as GroupData;
  const { toggleGroup } = useContext(GraphInteraction);

  return (
    <button
      type="button"
      className={`node-card node-card--group${d.active ? ' is-active' : ''}`}
      onClick={() => toggleGroup(d.id)}
      aria-expanded={d.active}
      title={d.hint}
    >
      <Handle type="target" position={Position.Left} className="node-handle" isConnectable={false} />
      <span className="node-group-label">{d.label}</span>
      <span className="node-badge">{d.count}</span>
      <span className="node-toggle">
        <PlusMinusIcon open={d.active} />
      </span>
      <Handle type="source" position={Position.Right} className="node-handle" isConnectable={false} />
    </button>
  );
}

function LeafNode({ data }: NodeProps) {
  const d = data as unknown as LeafData;

  return (
    <div className="node-card node-card--leaf" inert={!d.revealed}>
      <Handle type="target" position={Position.Left} className="node-handle" isConnectable={false} />
      <a
        className="node-link"
        href={d.href}
        target={d.external ? '_blank' : undefined}
        rel={d.external ? 'noopener noreferrer' : undefined}
        tabIndex={d.revealed ? 0 : -1}
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

function GraphCanvas({ model, profile }: { model: GraphModel; profile: GraphProfile }) {
  const [focused, setFocused] = useState<GroupId | null>(null);
  const [resizeTick, setResizeTick] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);
  const { setViewport } = useReactFlow();

  const toggleGroup = useCallback((id: GroupId) => {
    setFocused((current) => (current === id ? null : id));
  }, []);

  const reset = useCallback(() => setFocused(null), []);

  /** 全部节点的画布矩形, 视口计算只依赖它, 不读浏览器测量值 */
  const rects = useMemo(() => {
    const map = new Map<string, Rect>();
    map.set('root', rectOf(model.root, NODE_SIZE.root));
    for (const group of model.groups) {
      map.set(groupNodeId(group.meta.id), rectOf(group.center, NODE_SIZE.category));
      for (const leaf of group.leaves) {
        map.set(leaf.entry.id, rectOf(leaf.center, NODE_SIZE.leaf));
      }
    }
    return map;
  }, [model]);

  /** 总览只看根与分组; 聚焦时把该分组的全部叶子纳入视野 */
  const visibleIds = useMemo(() => {
    if (focused) {
      const group = model.groups.find((item) => item.meta.id === focused);
      return [groupNodeId(focused), ...(group?.leaves.map((leaf) => leaf.entry.id) ?? [])];
    }
    return ['root', ...model.groups.map((group) => groupNodeId(group.meta.id))];
  }, [focused, model]);

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
    const margin = 56;
    const zoom = Math.min(
      (width - margin * 2) / Math.max(box.width, 1),
      (height - margin * 2) / Math.max(box.height, 1),
      1.1,
    );

    void setViewport(
      {
        x: width / 2 - (box.x + box.width / 2) * zoom,
        y: height / 2 - (box.y + box.height / 2) * zoom,
        zoom,
      },
      { duration: didInit.current ? 520 : 0 },
    );
    didInit.current = true;
  }, [rects, resizeTick, setViewport, visibleIds]);

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
          subtitle: profile.role,
          avatar: profile.avatar,
        },
        draggable: false,
      },
    ];

    for (const group of model.groups) {
      const id = groupNodeId(group.meta.id);
      const rect = rects.get(id)!;
      const active = focused === group.meta.id;

      list.push({
        id,
        type: 'category',
        position: { x: rect.x, y: rect.y },
        style: { width: rect.width, height: rect.height },
        data: {
          kind: 'group',
          id: group.meta.id,
          label: group.meta.label,
          hint: group.meta.hint,
          count: group.leaves.length,
          active,
        },
        className: focused && !active ? 'is-dimmed' : undefined,
        draggable: false,
      });

      for (const leaf of group.leaves) {
        const leafRect = rects.get(leaf.entry.id)!;
        list.push({
          id: leaf.entry.id,
          type: 'leaf',
          position: { x: leafRect.x, y: leafRect.y },
          style: {
            width: leafRect.width,
            height: leafRect.height,
            // 折叠时必须用行内样式关掉命中测试: React Flow 会给可选中节点写 pointer-events: all
            pointerEvents: active ? 'all' : 'none',
          },
          data: {
            kind: 'leaf',
            label: leaf.entry.label,
            href: leaf.entry.href,
            meta: leaf.entry.meta,
            external: leaf.entry.external,
            revealed: active,
          },
          className: active ? 'is-revealed' : 'is-collapsed',
          draggable: false,
        });
      }
    }

    return list;
  }, [focused, model, profile, rects]);

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];
    for (const group of model.groups) {
      const active = focused === group.meta.id;
      list.push({
        id: `edge-root-${group.meta.id}`,
        source: 'root',
        target: groupNodeId(group.meta.id),
        className: focused && !active ? 'is-dimmed' : undefined,
      });
      for (const leaf of group.leaves) {
        list.push({
          id: `edge-${leaf.entry.id}`,
          source: groupNodeId(group.meta.id),
          target: leaf.entry.id,
          className: active ? 'is-revealed' : 'is-collapsed',
        });
      }
    }
    return list;
  }, [focused, model]);

  return (
    <GraphInteraction.Provider value={{ toggleGroup, reset }}>
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
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
            <Controls showInteractive={false} position="bottom-right" />
            {focused && (
              <Panel position="top-right">
                <button type="button" className="graph-reset" onClick={reset}>
                  <ResetIcon />
                  总览
                </button>
              </Panel>
            )}
            <Panel position="bottom-left" className="graph-hint">
              点击分组展开 · 拖动平移 · 滚轮缩放
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </GraphInteraction.Provider>
  );
}

export default function NodeGraph(props: { model: GraphModel; profile: GraphProfile }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas model={props.model} profile={props.profile} />
    </ReactFlowProvider>
  );
}
