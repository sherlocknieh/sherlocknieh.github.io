# 作品集导航

节点式可视化导航的个人站点, 用 Astro 构建, 首页由 React Flow 渲染成一张可展开的节点图。

实际效果: [https://sherlocknieh.github.io](https://sherlocknieh.github.io)

## 技术栈

- Astro (静态输出, 部署到 GitHub Pages)
- React Flow (`@xyflow/react`), 只在首页水合
- TypeScript
- 原生 CSS (无 UI 框架)

## 本地运行

安装 Node.js 22+ 后, 进入项目主目录:

```bash
npm install
npm run dev
```

预览地址: [http://localhost:4321](http://localhost:4321)

其他命令:

```bash
npm run build     # 生成静态产物到 dist/
npm run preview   # 预览产物
npm run check     # Astro 类型检查
```

## 节点图的组织方式

实现规格（状态机、布局公式、取景规则与改动入口）见 [docs/node-graph.md](docs/node-graph.md)。

画布是 **根 → 分组 → 分类 → 叶子** 的树: 根节点是「项目导航」, 分组是根下的一级类别,
分类只在分组内部切分主题。条目多时分组靠分类收拢, 所以
**在线APP / 学习与实验** 直接挂条目, **插件&工具** 再分成
**浏览器插件 / 油猴脚本 / VSCode插件 / 桌面工具 / 开发工具** 五类。

默认只展开到二级: 根 → 分组, 分组下的分类与条目都收起。节点右侧的按钮同时承担计数与展开:
收起时显示直接子节点数, 展开后变成收起图标。点击节点主体把视口框住该节点及其子节点并自动展开,
整支居中铺满; 点击空白或总览按钮只清空聚焦, 已展开的节点保持展开, 收起根节点后画布只剩根。
没有条目的分组不会出现在画布上。坐标由条目数量推导, 不需要手写位置。

节点数据全部来自内容集合:

| 分组 | 数据来源 | 说明 |
| --- | --- | --- |
| 在线APP | `src/content/projects/*.md` | `group: apps`, 直接挂条目 |
| 学习与实验 | `src/content/projects/*.md` | `group: lab`, 直接挂条目 |
| 插件&工具 | `src/content/projects/*.md` | `group: tools`, `category` 决定子类别 |
| 写作 | `src/content/posts/*.md` | 按日期倒序, 不分类 |
| 关于 | 目前无条目 | 需要时再补内容 |

## 新增内容

新增一篇文章:

```bash
touch src/content/posts/my-post.md
```

```markdown
---
title: 标题
date: 2026-01-01
description: 可选, 用于 meta description
math: true      # 可选, 需要公式时开启 MathJax
mermaid: true   # 可选, 需要流程图时开启 Mermaid
---

正文...
```

新增一个项目:

```markdown
---
title: 项目名
summary: 一句话说明
href: https://github.com/sherlocknieh/xxx
tags: [Astro]
group: tools           # apps | lab | tools | writing | about
category: extensions   # 仅 tools 需要: extensions | userscripts | vscode | desktop | devtools
order: 2         # 同分类内的排序
---
```

分组与分类的 id、标签、归属定义在 `src/lib/graph.ts` 的 `GROUPS` 与 `SECTIONS` 里,
新增分类改这一处即可; `category` 必须属于声明的 `group`, 否则构建期报错。

## 页面

- `/` 节点图导航
- `/posts` 文章列表
- `/posts/<id>` 文章详情
- `/resume` 个人简历 (A4 打印版, 独立页面, 不在导航中链接)

## 部署

`.github/workflows/deploy.yml` 在推送到 `main` 后构建并发布到 GitHub Pages。
仓库 Settings → Pages 需要把 Source 设为 **GitHub Actions**。
