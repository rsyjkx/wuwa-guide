/**
 * 构建脚本：先 astro build，再 pagefind --site dist。
 *
 * 支持 BASE_PATH（部署到子路径时用），例如 GitHub Pages 的项目站点：
 *   BASE_PATH=/wuwa-guide/ npm run build
 *
 * 注意：Astro 的 base 只影响"页面里的 URL 前缀"，产物仍然输出到 dist/。
 * GitHub Pages 会把仓库内容挂在 /<repo>/ 下，所以 dist/ 原样上传即可，
 * 页面里的 /wuwa-guide/... 正好对上。
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`✗ ${label} 失败（exit ${result.status ?? 'null'}）`);
    process.exit(result.status ?? 1);
  }
}

const base = process.env.BASE_PATH;
if (base) {
  console.log(`使用 BASE_PATH=${base}（页面里的站内链接会带上这个前缀）`);
}

run('astro build', [resolve(rootDir, 'node_modules/astro/bin/astro.mjs'), 'build']);
run('pagefind index', [
  resolve(rootDir, 'node_modules/pagefind/lib/runner/bin.cjs'),
  '--site',
  resolve(rootDir, 'dist'),
]);
