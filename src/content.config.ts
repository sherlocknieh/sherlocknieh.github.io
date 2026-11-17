import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { GROUP_IDS, SECTIONS, SECTION_IDS } from './lib/graph';

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
  schema: z
    .object({
      title: z.string(),
      summary: z.string(),
      href: z.url(),
      tags: z.array(z.string()).default([]),
      /** 画布上的一级类别, 决定条目挂在根节点下的哪个分组 */
      group: z.enum(GROUP_IDS),
      /** 分组内的分类, 只有需要再切分的分组才填 */
      category: z.enum(SECTION_IDS as [string, ...string[]]).optional(),
      order: z.number().default(0),
    })
    // 分类必须属于所在分组, 否则条目会挂到别的分组下
    .refine(
      (data) =>
        data.category === undefined ||
        SECTIONS.some((section) => section.id === data.category && section.group === data.group),
      { message: 'category 不属于该 group', path: ['category'] },
    ),
});

export const collections = { posts, projects };
