import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  // 用户站点部署在根路径, 与仓库名 sherlocknieh.github.io 对应
  site: 'https://sherlocknieh.github.io',
  integrations: [react()],
  markdown: {
    shikiConfig: { theme: 'github-dark' },
  },
});
