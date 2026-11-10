/**
 * 构建脚本：先 astro build，再 pagefind --site dist。
 *
 * 几个必须处理的边界情况：
 *   1. 部署到子路径（GitHub Pages 项目站点）时用 BASE_PATH，例如：
 *        BASE_PATH=/wuwa-guide/ npm run build
 *      Astro 的 base 只影响页面里的 URL 前缀，产物仍然输出到 dist/。
 *   2. 内容被全部删除时 Pagefind 会以「没有可索引页面」失败；
 *      这时不应该让构建失败（否则站点永远停在旧版本），只提示并跳过索引。
 *   3. 本地重复构建时 Astro 的内容缓存（.astro/data-store.json）可能残留已删除的条目，
 *      导致"删了还显示"。构建前清掉这份缓存，保证和 CI 的行为一致。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, args, options = {}) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

function countContentFiles() {
  let count = 0;
  for (const kind of ['guides', 'teams']) {
    try {
      count += readdirSync(resolve(rootDir, 'src/content', kind)).filter((name) => name.endsWith('.md')).length;
    } catch {
      // 目录不存在就是 0
    }
  }
  return count;
}

const contentCount = countContentFiles();
console.log(`内容文件：${contentCount} 篇`);

const base = process.env.BASE_PATH;
if (base) {
  console.log(`使用 BASE_PATH=${base}（页面里的站内链接会带上这个前缀）`);
}

// 清掉可能残留的内容缓存，避免"已删除的内容还在"
// Astro 6 会把内容缓存写到 node_modules/.astro/data-store.json，两个位置都要清
for (const cachePath of [
  resolve(rootDir, '.astro/data-store.json'),
  resolve(rootDir, 'node_modules/.astro/data-store.json'),
]) {
  if (existsSync(cachePath)) {
    rmSync(cachePath, { force: true });
    console.log('已清理内容缓存 ' + cachePath.replace(rootDir + '/', ''));
  }
}

const build = run('astro build', [resolve(rootDir, 'node_modules/astro/bin/astro.mjs'), 'build']);
if (build.status !== 0) {
  console.error(`\n✗ astro build 失败（exit ${build.status ?? 'null'}）`);
  process.exit(build.status ?? 1);
}

const pagefind = run('pagefind index', [
  resolve(rootDir, 'node_modules/pagefind/lib/runner/bin.cjs'),
  '--site',
  resolve(rootDir, 'dist'),
]);

if (pagefind.status !== 0) {
  const output = `${pagefind.stdout ?? ''}${pagefind.stderr ?? ''}`;
  // 内容被删空时 Pagefind 可能返回 1 或 101，都不应该让部署失败
  if (contentCount === 0 || output.includes('not able to build an index')) {
    console.warn('\n⚠ 当前没有可索引的内容（攻略/配队都被删了？），跳过搜索索引。');
    console.warn('  搜索页会显示"索引未生成"的提示；恢复内容后重新构建即可。');
    process.exit(0);
  }
  console.error(`\n✗ pagefind 失败（exit ${pagefind.status ?? 'null'}）`);
  process.exit(pagefind.status ?? 1);
}
