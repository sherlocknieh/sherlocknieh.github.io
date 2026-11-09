import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** 文章: 一篇文章就是一个写作节点的载体 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    /** 按需注入 MathJax, 避免所有页面都加载渲染引擎 */
    math: z.boolean().default(false),
    mermaid: z.boolean().default(false),
  }),
});

/** 项目: href 缺省时指向站内详情页, 有值时指向外部仓库或演示地址 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    href: z.url(),
    tags: z.array(z.string()).default([]),
    order: z.number().default(0),
  }),
});

export const collections = { posts, projects };
