# 项目规则

个人作品集站点：Astro 静态输出，首页由 React Flow 渲染成可展开的节点图，另有文章页与简历页。

## 内容改动

新增项目或文章只加 Markdown，坐标与布局由代码推导。frontmatter 字段与示例见 `README.md`「新增内容」。

- 项目的 `group` 取 `GROUP_IDS` 中的值，`category` 必须属于该分组，`src/content.config.ts` 在构建期校验。
- 文章的 `group` 固定为 `writing`，按日期倒序排列。
- 分组的 id、标签、顺序、提示与分类归属只在 `src/lib/graph.ts` 的 `GROUPS` / `SECTIONS` 定义；新增分类改这一处，内容只声明归属。
- 同一分组内的条目要么全部挂在分类下，要么全部直接挂在分组下；布局、连线与取景都依赖这个前提。

## 节点图逻辑

改交互、布局、取景、动画或卡片样式前，先读 `docs/node-graph.md`：它给出可读规格和「改动入口」表，按表定位文件即可。

动手时守住三条：可见性只在 `NodeGraph.tsx` 的 `view` memo 判断一次；`focus`（取景）与 `collapsed`（收起）互不影响；节点尺寸只来自 `graph-layout.ts` 的 `NODE_SIZE`，CSS 只负责填满节点。完整不变量见 `docs/node-graph.md` 末尾。

## 验证与发布

改完运行 `npm run check`；动过页面、数据映射或配置时再跑 `npm run build`，两者都通过才算完成。

推送到 `main` 由 GitHub Actions 构建并发布到 GitHub Pages；本地用 `npm run dev` 预览，不需要手工部署。
