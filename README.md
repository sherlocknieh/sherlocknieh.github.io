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

首页的分组是 **项目**、**写作**、**关于**。分组与叶子的坐标由分组数量和叶子数量推导,
新增内容不会让已有节点位置跳动。点击分组展开该分支的叶子, 点击叶子跳转, 点击空白或左上角名称回到总览。
没有条目的分组不会出现在画布上。

节点数据全部来自内容集合, 不需要手写坐标:

| 分组 | 数据来源 | 说明 |
| --- | --- | --- |
| 项目 | `src/content/projects/*.md` | `href` 必填, 指向仓库或演示地址 |
| 写作 | `src/content/posts/*.md` | 按日期倒序 |
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
order: 2
---
```

## 页面

- `/` 节点图导航
- `/posts` 文章列表
- `/posts/<id>` 文章详情
- `/resume` 个人简历 (A4 打印版, 独立页面, 不在导航中链接)

## 部署

`.github/workflows/deploy.yml` 在推送到 `main` 后构建并发布到 GitHub Pages。
仓库 Settings → Pages 需要把 Source 设为 **GitHub Actions**。
