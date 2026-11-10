/**
 * 把 Markdown 正文里以 "/" 开头的图片地址补上站点 base 前缀。
 *
 * 为什么需要：站点部署在 GitHub Pages 的子路径（/wuwa-guide/）下，
 * 而 Markdown 里的 `![说明](/media/a.png)` 是站点根路径写法，
 * 不加前缀会 404。作者只用写 /media/...，构建时自动变成 /wuwa-guide/media/...。
 *
 * @param {{ base?: string }} options
 */
export default function rehypeBaseImages(options = {}) {
  const raw = options.base ?? '/';
  const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;

  const walk = (node) => {
    if (node?.type === 'element' && node.tagName === 'img') {
      const src = node.properties?.src;
      if (typeof src === 'string' && src.startsWith('/') && !src.startsWith('//')) {
        node.properties.src = `${base}${src}`;
      }
    }
    for (const child of node?.children ?? []) walk(child);
  };

  return (tree) => {
    if (!base) return;
    walk(tree);
  };
}
