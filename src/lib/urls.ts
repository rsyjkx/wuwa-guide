/**
 * 站内路径工具。
 *
 * 站点可能部署在两种位置：
 *   · 域名根路径（Cloudflare Pages / 自定义域名 / <user>.github.io）→ base = '/'
 *   · 子路径（GitHub Pages 的项目站点 /<repo>/）→ base = '/<repo>/'
 *
 * Astro 的 `import.meta.env.BASE_URL` 会在构建时给出正确的 base，
 * 所有站内链接都必须经过 withBase()，否则子路径部署会 404。
 */

const base: string = import.meta.env.BASE_URL || '/';

/** 站内链接：/search/ → /repo/search/（外链原样返回） */
export function withBase(path = ''): string {
  if (!path) return base;
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(path)) return path;
  if (path.startsWith('mailto:') || path.startsWith('#')) return path;
  return `${base}${path.replace(/^\/+/, '')}`;
}

/** 媒体地址：/media/x.png → /repo/media/x.png（http(s) 外链原样返回） */
export function assetUrl(path: string | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return withBase(path);
}
