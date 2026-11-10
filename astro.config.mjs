// @ts-check
import { defineConfig } from 'astro/config';
import rehypeBaseImages from './src/lib/rehype-base-images.mjs';

// 正文图片的 /media/... 需要补上部署子路径（GitHub Pages 项目站点）
const basePath = process.env.BASE_PATH && process.env.BASE_PATH !== '/' ? process.env.BASE_PATH : '/';

// 纯静态站点：无 adapter、无 SSR。构建产物是 dist/ 下的 HTML，
// 之后由 pagefind 生成浏览器端搜索索引，再交给 Cloudflare Pages 托管。
export default defineConfig({
  // 部署后请改成你的正式域名（用于 canonical 等绝对地址）
  // 部署后可改这里；GitHub Pages 的 deploy-pages 工作流会用 SITE_URL 覆盖（自定义域名/项目站点）
  site: process.env.SITE_URL ?? 'https://rsyjkx.github.io/wuwa-guide',
  output: 'static',
  /**
   * 部署到子路径时（例如 GitHub Pages 项目站点 /<repo>/）设置 BASE_PATH：
   *   BASE_PATH=/<repo>/ npm run build
   * 站点会在 Cloudflare Pages / 自定义域名 / <user>.github.io 下保持 base 为空。
   */
  base: process.env.BASE_PATH && process.env.BASE_PATH !== '/' ? process.env.BASE_PATH : undefined,
  trailingSlash: 'ignore',
  markdown: {
    rehypePlugins: [[rehypeBaseImages, { base: basePath }]],
  },
  build: {
    format: 'directory',
  },
});

