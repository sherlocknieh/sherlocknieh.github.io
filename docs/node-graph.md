# 节点图实现说明（供 agent 查阅）

首页节点图的可读版规格。改节点逻辑前先看这里，不必通读源码；需要改具体实现时再按文末的「改动入口」定位文件。

## 30 秒速览

- 画布是 **根 → 分组 → 分类 → 叶子 → 详情** 的树，由 `@xyflow/react`（React Flow）渲染。
- 所有坐标由布局函数算出，不读 DOM 尺寸，也不手写位置。
- 有两套正交状态：`focus`（取景到哪）和 `collapsed`（哪些子节点收起）。
- **点击空白 / 总览只清空 `focus`，绝不改 `collapsed`**。
- 叶子主体只负责聚焦与展开，**跳转由右侧独立的箭头按钮完成**；详情节点本身是链接。
- 渲染哪些节点、连哪些线、取景框哪些节点，全部由 `GraphCanvas` 里的一个 `view` memo 同时产出，不要在别处另写一份可见性判断。

## 文件地图

| 文件 | 职责 |
| --- | --- |
| `src/pages/index.astro` | 读内容集合 → 生成 `GraphEntry[]`；排序；映射 `links` / `screenshots`；`profile`；无脚本导航 |
| `src/lib/graph.ts` | 分组/分类的静态维度、`GraphEntry` / `GraphDetail` 类型、`collapsed` 键、默认收起状态 |
| `src/lib/graph-layout.ts` | 节点尺寸、列坐标、纵向堆叠、`buildGraph`、`rectOf`、`unionRect` |
| `src/components/NodeGraph.tsx` | 交互状态、`focus`/`toggle`、节点与连线派生、视口取景与动画 |
| `src/styles/graph.css` | 卡片、跳转按钮、详情缩略图、连线、总览按钮样式 |
| `src/content.config.ts` | 内容 schema，校验 `group` / `category` 归属与 `links` / `screenshots` 字段 |
| `src/content/projects/*.md` | 项目条目（外部链接） |
| `src/content/posts/*.md` | 文章条目（站内链接，归入「写作」） |

## 概念模型

```
根 (root)
└── 分组 (group)          一级类别，如「在线APP」「插件&工具」
    ├── 直接叶子 (leaf)    分组没有分类时，条目直接挂在分组下
    └── 分类 (section)     分组内部的主题切分，如「浏览器插件」
        └── 叶子 (leaf)    具体项目或文章
            └── 详情 (detail)
                ├── 链接 (link)
                └── 截图 (shot)
```

- 分组与分类的标签、顺序写死在 `src/lib/graph.ts` 的 `GROUPS` / `SECTIONS`；内容只声明归属。
- **同一个分组内，`leaves` 与 `sections` 互斥**：只要该分组出现了分类，所有条目都必须挂在分类下。布局和取景都依赖这个前提。
- 详情只有一层，不能再展开。
- 没有条目的分组、没有被用到的分类不会出现在画布上。
- 分类必须属于所在分组，`content.config.ts` 在构建期校验；未知分类由 `sectionsOf` 调 `sectionById` 报错。

## 数据来源与排序

`index.astro` 把内容转换成 `GraphEntry`：

| 来源 | `id` | `group` | `section` | `href` | `external` | 详情 |
| --- | --- | --- | --- | --- | --- | --- |
| 项目 | `project-${集合 id}` | frontmatter `group` | frontmatter `category` | frontmatter `href` | `true` | `links` + `screenshots` |
| 文章 | `post-${集合 id}` | 固定 `writing` | 无 | `/posts/${id}` | `false` | `links` + `screenshots` |

- 项目排序：`GROUP_IDS` 顺序 → `SECTION_IDS` 顺序 → frontmatter `order`。
- 文章排序：日期倒序。
- `section` 的顺序即画布纵向顺序；`GROUPS` 的顺序即分组纵向顺序。
- 节点的 `id` 会直接作为 React Flow 节点 id，必须全局唯一；边 id 使用 `edge-${entry.id}`。

### 叶子详情

frontmatter 里两个可选数组：

```yaml
links:
  - label: GitHub 仓库
    href: https://github.com/...
screenshots:
  - label: 首页
    src: /assets/shots/home.png
```

映射规则：

- `links` → `{ kind: 'link', label, href }`
- `screenshots` → `{ kind: 'shot', label, src }`
- 详情顺序固定为 **先 links 后 screenshots**，数组顺序即画布纵向顺序。
- `screenshots.src` 指向 `public/` 下的图片；构建期只校验非空字符串。
- 两个数组都为空时，叶子不显示展开按钮。

## 节点 id 约定

| 类型 | 节点 id | 说明 |
| --- | --- | --- |
| 根 | `root` | 固定 |
| 分组 | `group-${gid}` | 如 `group-tools` |
| 分类 | `section-${gid}-${sid}` | 如 `section-tools-extensions` |
| 叶子 | `entry.id` | 全局唯一 |
| 详情 | `detail-${entry.id}-${index}` | `index` 是详情在 `entry.details` 中的下标 |

## 状态

`GraphCanvas` 只有两份交互状态：

### `focus: Focus | null`

```ts
type Focus =
  | { kind: 'root' }
  | { kind: 'group'; group: GroupId }
  | { kind: 'section'; group: GroupId; section: string }
  | { kind: 'leaf'; id: string; group: GroupId; section?: string };
```

- `null` = 总览。
- `{ kind: 'root' }` = 聚焦根，框住整棵可见树。
- `{ kind: 'group', group }` = 聚焦某个分组。
- `{ kind: 'section', group, section }` = 聚焦某个分类。
- `{ kind: 'leaf', id, ... }` = 聚焦某个叶子；`group` / `section` 只用于收起时退回父级。
- **只影响取景和高亮，不影响哪些节点被渲染。**
- 按值比较（`sameFocus`），重复点同一节点不会重启动画。

### `collapsed: ReadonlySet<string>`

集合里存的是“收起”的键：

| 键 | 含义 |
| --- | --- |
| `ROOT_KEY`（`'root'`） | 根收起，整棵树只剩根 |
| `groupKey(gid)`（分组 id） | 分组收起，分类和直接叶子都不渲染 |
| `sectionKey(gid, sid)`（`gid/sid`） | 分类收起，只留分类节点 |
| `leafKey(id)`（`leaf/<entry.id>`） | 叶子收起，详情节点不渲染 |

- `rootOpen` 是派生值：`!collapsed.has(ROOT_KEY)`，没有独立的 `rootOpen` state。
- 初始值 `defaultCollapsed(entries)`：收起全部分组、分类和叶子，根保持展开 → 默认只看到「根 + 分组」两级。
- 分类实际展开的条件是：分组展开 **且** 分类键不在集合里（`isSectionOpen`）。
- 叶子详情实际展开的条件是：叶子有详情 **且** `leafKey` 不在集合里。
- 收起根不会改动下层键，重新展开根后原来的展开状态还在。

## 交互状态机

### 点击卡片主体 → `focusNode(target)`

| 目标 | 动作 |
| --- | --- |
| 根 | 设 `focus = { kind: 'root' }`，并移除 `ROOT_KEY` |
| 分组 | 设 `focus = { kind: 'group', group }`，并移除该分组的键 |
| 分类 | 设 `focus = { kind: 'section', group, section }`，并移除分组键与分类键 |
| 叶子 | 设 `focus = { kind: 'leaf', id, ... }`，并移除该叶子的键，展开它的详情 |

即 **聚焦同时展开该节点这一支**，否则聚焦后看不到内容。叶子主体不是链接，点击不会跳转。

### 点击叶子右侧箭头 → 跳转

- 叶子卡片右侧的独立 `<a>` 按钮才打开 `entry.href`。
- `external` 为真时新标签打开，否则当前页跳转。
- 详情节点整张卡片都是链接，统一新标签打开。

### 点击右侧计数/减号 → `toggleNode(target)`

| 目标 | 当前收起 | 当前展开 |
| --- | --- | --- |
| 根 | 移除 `ROOT_KEY`，聚焦根 | 加入 `ROOT_KEY`，清空聚焦；不 pin 相机 |
| 分组 | 移除分组键，聚焦该分组 | pin 该分组；若焦点在该分组、其分类或叶子，回到总览；否则保持焦点 |
| 分类 | 移除分类键，聚焦该分类 | pin 该分类；若焦点在它或它的叶子，退回所属分组；否则保持焦点 |
| 叶子 | 移除叶子键，聚焦该叶子 | pin 该叶子；若正聚焦它，退回所属分类或分组；否则保持焦点 |

- **展开即聚焦**；收起时取景退回上一级。
- `pin` 只在焦点没有变化时生效：记住被点节点收起前的屏幕中心，布局重排后保持当前缩放、让它停在原屏幕位置。聚焦变化时走正常重新取景。
- 根收起不 pin，视野直接回到中央。
- 没有详情的叶子不渲染计数/减号按钮。

### 点击空白 / 「总览」按钮 → `backToOverview()`

- 只执行 `setFocus(null)`。
- **不改 `collapsed`**，已展开的分组、分类和叶子详情保持展开。
- 不要在这里重置 `collapsed`（包括调用 `defaultCollapsed(entries)`）。

### 其他

- 拖拽平移、滚轮缩放由 React Flow 处理；用户手势会中断取景动画。
- 画布尺寸变化由 `ResizeObserver` 触发重新取景。

## 派生视图 `view`

`GraphCanvas` 里的单个 `useMemo` 一次遍历同时产出：

```ts
{
  nodes: FlowNode[];   // 交给 React Flow 渲染
  edges: Edge[];       // 交给 React Flow 连线
  frameIds: string[];  // 取景用的节点 id
}
```

**可见性规则只写在这一处。** 不要分别在 nodes、edges、取景里再判断一遍 `rootOpen` / `collapsed`。

### 渲染规则

- 根永远渲染。
- 根收起 → 只渲染根。
- 分组：根展开时全部渲染。
- 分类与直接叶子：仅当所属分组展开时渲染。
- 分类下的叶子：仅当分组和分类都展开时渲染。
- 叶子详情：仅当叶子展开且 `entry.details` 非空时渲染。
- `focus` 只改变高亮（`active`、`is-revealed` 边）和 `frameIds`，**不改变渲染集合**。

### 取景规则 `frameIds`

| 焦点 | 框住的节点 |
| --- | --- |
| 根收起 | 只有根 |
| 总览 / 聚焦根 | 根 + 所有已渲染节点 |
| 聚焦分组 | 该分组 + 它的直接叶子 + 它的分类 + 展开分类下的叶子与详情；不框根和其他分组 |
| 聚焦分类 | 只有该分类 + 它展开的叶子与详情；不框分组和根 |
| 聚焦叶子 | 只有该叶子 + 它展开的详情；不框分组、分类和根 |

刻意不框祖先节点，否则焦点这一支会被祖先撑大而缩得很小。

## 布局

`buildGraph(entries, collapsed)` 返回 `GraphModel`：根坐标 + 分组/分类/叶子/详情的中心坐标。所有尺寸和间距集中在 `graph-layout.ts`。

### 节点尺寸 `NODE_SIZE`

| 类型 | 宽 × 高 |
| --- | --- |
| 根 / 分组 | 208 × 64 |
| 分类 | 188 × 56 |
| 叶子 | 268 × 60 |
| 详情 | 280 × 72 |

- 尺寸是布局与渲染的唯一来源：React Flow 节点的 `style.width/height` 由 `rectOf` 得出。
- **不要在 CSS 里给卡片写死宽高**，卡片只用 `width/height: 100%` 填满节点。

### 列坐标 `AXIS`

| 项 | 值 |
| --- | --- |
| 根 x | 0 |
| 分组 x | 350 |
| 分类 x | 690 |
| 分类下叶子 x | 1030 |
| 无分类时直接叶子 x | 690 |
| 分类下叶子的详情 x | 1370 |
| 直接叶子的详情 x | 1030 |
| 分组间距 | 44 |
| 分类间距 | 20 |
| 叶子间距（中心距） | 74 |
| 详情间距（中心距） | 84 |

### 纵向堆叠

- `stackHeight(n, gap, h) = n === 0 ? 0 : (n - 1) * gap + h`
- 详情列高度：`detailSpan(n) = stackHeight(n, 84, 72)`。
- 叶子块高度：
  - 没有详情或叶子收起 → 叶子节点高（60）
  - 叶子展开 → `max(60, detailSpan(详情数))`
- 叶子块之间留 `LEAF_GAP = 74 - 60 = 14` 的空隙：
  `leavesSpan = 各叶子块高度之和 + 14 × (叶子数 - 1)`。
- 分组内容高度：
  - 分组收起 → 一个分组节点高（64）
  - 无分类 → `max(leavesSpan, 64)`
  - 有分类 → 各分类块高度 + 分类间距，再与 64 取大
- 分类块高度：
  - 分类收起 → 分类节点高（56）
  - 分类展开 → `max(leavesSpan, 56)`
- 叶子和它的详情列在各自的块里垂直居中。
- 整棵树以 y=0 为中心上下排布；根固定在 `(0, 0)`，不参与纵向堆叠。
- 布局始终算出所有可能出现节点的坐标；是否渲染由 `view` 根据 `collapsed` 决定。

## 取景与动画

### 取景范围

1. 从 `frameIds` 取矩形（`rects` 由布局坐标生成，不测量 DOM）。
2. `unionRect` 求包围盒。
3. `margin = 40`。
4. `fitZoom = min((W - 80) / boxW, (H - 80) / boxH, 1.1)`。
5. 最小缩放：聚焦时 `0.2`，总览时 `0.55`。
6. `zoom = max(fitZoom, minZoom)`。
7. 装得下时水平、垂直都居中；装不下时水平居中、顶部贴住 `margin`，其余靠拖拽查看。

React Flow 自身限制 `minZoom=0.2`、`maxZoom=1.6`。

### `pin`

- 只为“展开状态变了但焦点没变”的场景服务，典型是收起一个当前没聚焦的分支。
- 记录被点节点收起前的屏幕中心；布局重排后保持当前缩放，反算视口让该节点回到同一屏幕位置。
- 会保留缩放，即使新内容装不下；这是有意取舍，超出的部分靠拖动查看。
- 聚焦变化时不使用 pin，直接重新取景。

### 过渡

- 自绘 `requestAnimationFrame`，时长 520ms，`easeInOutCubic`。
- 屏幕中心的世界坐标线性插值，缩放按对数插值 → 缩放只朝目标单调变化，不会“先缩小再放大”。
- 首次取景瞬时定位；页面在后台时也瞬时定位。
- 用户 `pointerdown` 或 `wheel` 中断动画。
- 不使用 React Flow 的 `duration` 过渡，原因是 d3 的 smooth zoom 在远距离平移时会先缩小再放大。

## 卡片与样式

- 根、分组、分类共用一个 `CardNode`；叶子用 `LeafNode`；详情用 `DetailNode`。
- `CardData` 字段：`kind`、`target`、`label`、`hint?`、`count`、`active`、`open`。
- 叶子卡片：
  - 主体（`node-main`）只聚焦与展开，不是链接。
  - 右侧箭头按钮（`node-jump`）负责跳转。
  - 有详情时再显示计数/减号按钮。
- 详情卡片：
  - 整卡是 `<a>`，统一新标签打开。
  - 链接用图标占位，截图用 88 × 52 的缩略图；右侧是标题与「链接 / 截图」类型。
- 计数规则：根 = 分组数；分组 = 有分类时的分类数，否则直接叶子数；分类 = 叶子数；叶子 = 详情数。
- 所有已渲染的分组/分类都必然有子节点，因此没有“是否可展开”的判断；叶子按 `details.length > 0` 决定是否显示展开按钮。
- 现在只保留 `is-revealed`（聚焦分支的边变强调色）；`is-collapsed` / `is-dimmed` 已删除，不要再加回来。

## 改动入口

| 想改什么 | 改哪里 |
| --- | --- |
| 新增项目/文章 | 往 `src/content/projects` 或 `posts` 加 Markdown，填 frontmatter；不需要坐标 |
| 给叶子加相关链接/截图 | frontmatter 的 `links` / `screenshots`，截图放到 `public/` 下 |
| 调整分组名称、顺序、提示 | `src/lib/graph.ts` 的 `GROUPS` / `GROUP_IDS` |
| 新增或调整分类 | `src/lib/graph.ts` 的 `SECTIONS`；条目 frontmatter 的 `category` |
| 调整节点尺寸/间距 | `src/lib/graph-layout.ts` 的 `NODE_SIZE` / `AXIS` |
| 调整展开、聚焦、退回规则 | `NodeGraph.tsx` 的 `focusNode` / `toggleNode` / `stepUpFocus` / `backToOverview` |
| 调整哪些节点渲染/参与取景 | `NodeGraph.tsx` 的 `view` memo |
| 调整取景缩放、pin、动画 | `NodeGraph.tsx` 的视口 `useEffect` |
| 调整叶子按钮或详情卡片外观 | `src/styles/graph.css` |
| 调整内容字段与校验 | `src/content.config.ts` + `src/pages/index.astro` 的映射 |

## 不变量与常见坑

1. **点击空白/总览不得清空 `collapsed`**。这是明确的产品行为：导航只改取景，不改树的展开状态。
2. **可见性只在 `view` memo 判断一次**。不要在 nodes、edges、取景里各写一份，否则会漂移。
3. **`focus` 与 `collapsed` 正交**。`focus` 不负责隐藏节点，`collapsed` 不负责高亮。
4. **根是普通节点**：收起状态放在同一个 `collapsed` 集合里，键是 `ROOT_KEY`，没有独立 state。
5. **`group.leaves` 与 `group.sections` 互斥**。如果以后允许混挂，需要同时改布局、渲染、连线和取景。
6. **节点尺寸只能来自 `NODE_SIZE`**。CSS 里写死宽高会和布局/取景计算打架。
7. **节点 id 必须全局唯一**。叶子用 `project-` / `post-` 前缀保证这一点；详情 id 复用叶子 id 加下标。
8. **不要恢复 `expandable`**。分组/分类只有在有内容时才会进入布局，渲染出来的节点必然可展开；叶子由详情数量决定按钮是否出现。
9. **分类键使用 `分组/分类`**，不要只用分类 id，避免不同分组出现同名分类时互相影响。
10. **未知分类在构建期报错**，不要静默跳过，否则条目会从画布上消失。
11. **详情节点必须走布局结果**：渲染 `leaf.details`，不要直接遍历 `entry.details`，否则收起时会被错误渲染。
12. **叶子主体永远不是链接**：跳转只走 `node-jump`，详情跳转只走详情卡片；不要给 `.node-card--leaf` 套 `<a>`。
