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
import type { GraphEntry, GroupId } from '../lib/graph';

export interface GraphProfile {
  name: string;
  role: string;
}

interface RootData extends Record<string, unknown> {
  kind: 'root';
  label: string;
  subtitle: string;
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

/** 聚焦状态: 只选分组时展示分类, 再选分类时展示该分类的叶子 */
type Focus = { group: GroupId; section?: string };

/** 节点卡片通过 context 改画布状态, 避免把回调塞进可序列化的 data 里 */
const GraphInteraction = createContext<{
  toggleGroup: (id: GroupId) => void;
  toggleSection: (group: GroupId, section: string) => void;
  reset: () => void;
}>({ toggleGroup: () => {}, toggleSection: () => {}, reset: () => {} });

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
      <span className="node-name">{d.label}</span>
      <span className="node-role">{d.subtitle}</span>
    </button>
  );
}

function GroupNode({ data }: NodeProps) {
  const d = data as unknown as GroupData;
  const { toggleGroup, toggleSection } = useContext(GraphInteraction);
  const isSection = d.kind === 'section';

  return (
    <button
      type="button"
      className={`node-card node-card--${d.kind}${d.active ? ' is-active' : ''}`}
      onClick={() => (isSection ? toggleSection(d.owner, d.id) : toggleGroup(d.owner))}
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

function GraphCanvas({ entries, profile }: { entries: GraphEntry[]; profile: GraphProfile }) {
  const [focus, setFocus] = useState<Focus | null>(null);
  const [resizeTick, setResizeTick] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);
  const { setViewport } = useReactFlow();

  // 只有当前聚焦的分支展开, 其余分组收成一个节点, 总览因此始终紧凑
  const model = useMemo(
    () => buildGraph(entries, focus ? { group: focus.group, section: focus.section } : undefined),
    [entries, focus],
  );

  const toggleGroup = useCallback((id: GroupId) => {
    setFocus((current) => (current?.group === id && !current.section ? null : { group: id }));
  }, []);

  const toggleSection = useCallback((group: GroupId, section: string) => {
    setFocus((current) =>
      current?.group === group && current.section === section ? { group } : { group, section },
    );
  }, []);

  const reset = useCallback(() => setFocus(null), []);

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

  /** 总览只看根与分组; 聚焦分组看分类, 再聚焦分类才看它的叶子 */
  const visibleIds = useMemo(() => {
    if (!focus) return ['root', ...model.groups.map((group) => groupNodeId(group.meta.id))];

    const group = model.groups.find((item) => item.meta.id === focus.group);
    if (!group) return ['root'];

    const groupId = groupNodeId(focus.group);
    if (!focus.section) {
      return [
        groupId,
        ...group.sections.map((section) => sectionNodeId(focus.group, section.meta.id)),
        ...group.leaves.map((leaf) => leaf.entry.id),
      ];
    }

    const section = group.sections.find((item) => item.meta.id === focus.section);
    return [
      groupId,
      sectionNodeId(focus.group, focus.section),
      ...(section?.leaves.map((leaf) => leaf.entry.id) ?? []),
    ];
  }, [focus, model]);

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
        },
        draggable: false,
      },
    ];

    /** 叶子在被当前聚焦路径展开时才能点击, 折叠态直接退出命中测试 */
    const pushLeaf = (leaf: LaidOutLeaf, revealed: boolean) => {
      const leafRect = rects.get(leaf.entry.id)!;
      list.push({
        id: leaf.entry.id,
        type: 'leaf',
        position: { x: leafRect.x, y: leafRect.y },
        style: {
          width: leafRect.width,
          height: leafRect.height,
          // 折叠时必须用行内样式关掉命中测试: React Flow 会给可选中节点写 pointer-events: all
          pointerEvents: revealed ? 'all' : 'none',
        },
        data: {
          kind: 'leaf',
          label: leaf.entry.label,
          href: leaf.entry.href,
          meta: leaf.entry.meta,
          external: leaf.entry.external,
          revealed,
        },
        className: revealed ? 'is-revealed' : 'is-collapsed',
        draggable: false,
      });
    };

    for (const group of model.groups) {
      const gid = group.meta.id;
      const id = groupNodeId(gid);
      const rect = rects.get(id)!;
      const active = focus?.group === gid;
      const dimmed = focus !== null && !active;
      const leafCount =
        group.leaves.length +
        group.sections.reduce((sum, section) => sum + section.leaves.length, 0);

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
          count: leafCount,
          active,
        },
        className: dimmed ? 'is-dimmed' : undefined,
        draggable: false,
      });

      for (const section of group.sections) {
        const sid = sectionNodeId(gid, section.meta.id);
        const sectionRect = rects.get(sid)!;
        const sectionActive = active && focus?.section === section.meta.id;

        list.push({
          id: sid,
          type: 'category',
          position: { x: sectionRect.x, y: sectionRect.y },
          style: {
            width: sectionRect.width,
            height: sectionRect.height,
            pointerEvents: active ? 'all' : 'none',
          },
          data: {
            kind: 'section',
            id: section.meta.id,
            owner: gid,
            label: section.meta.label,
            hint: `${group.meta.label} · ${section.meta.label}`,
            count: section.leaves.length,
            active: sectionActive,
          },
          className: active ? 'is-revealed' : 'is-collapsed',
          draggable: false,
        });

        for (const leaf of section.leaves) pushLeaf(leaf, sectionActive);
      }

      for (const leaf of group.leaves) pushLeaf(leaf, active);
    }

    return list;
  }, [focus, model, profile, rects]);

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];

    const pushLeafEdge = (source: string, entryId: string, revealed: boolean) => {
      list.push({
        id: `edge-${entryId}`,
        source,
        target: entryId,
        className: revealed ? 'is-revealed' : 'is-collapsed',
      });
    };

    for (const group of model.groups) {
      const gid = group.meta.id;
      const active = focus?.group === gid;
      const dimmed = focus !== null && !active;

      list.push({
        id: `edge-root-${gid}`,
        source: 'root',
        target: groupNodeId(gid),
        className: dimmed ? 'is-dimmed' : undefined,
      });

      for (const section of group.sections) {
        const sid = sectionNodeId(gid, section.meta.id);
        list.push({
          id: `edge-${sid}`,
          source: groupNodeId(gid),
          target: sid,
          className: active ? 'is-revealed' : 'is-collapsed',
        });

        const sectionActive = active && focus?.section === section.meta.id;
        for (const leaf of section.leaves) pushLeafEdge(sid, leaf.entry.id, sectionActive);
      }

      for (const leaf of group.leaves) pushLeafEdge(groupNodeId(gid), leaf.entry.id, active);
    }

    return list;
  }, [focus, model]);

  return (
    <GraphInteraction.Provider value={{ toggleGroup, toggleSection, reset }}>
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
