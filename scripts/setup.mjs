#!/usr/bin/env node
/**
 * 一条命令写入部署所需的仓库信息，省得手改两个文件。
 *
 *   node scripts/setup.mjs --user yourname --repo wuwa-guide
 *   node scripts/setup.mjs --user yourname --repo wuwa-guide --site https://wuwa.example.com
 *   node scripts/setup.mjs --title "我的鸣潮攻略站"
 *   node scripts/setup.mjs --check          # 只看当前值
 *
 * 会修改：src/config.ts（username / repository / branch / 站点名）、astro.config.mjs（site）
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(rootDir, 'src/config.ts');
const astroConfigPath = resolve(rootDir, 'astro.config.mjs');
const approversPath = resolve(rootDir, '.github/approvers.json');
const codeownersPath = resolve(rootDir, '.github/CODEOWNERS');

const args = process.argv.slice(2);

function arg(name) {
  const match = args.find((item) => item.startsWith(`--${name}=`));
  if (match) return match.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return undefined;
}

const read = (path) => readFileSync(path, 'utf8');

/** 只在指定对象块里替换 key，避免同名字段（例如 repository 出现在多个常量里）被改错 */
function setInBlock(text, blockStart, key, value) {
  const startIndex = text.indexOf(blockStart);
  if (startIndex === -1) {
    throw new Error(`在文件里找不到块 ${blockStart}`);
  }
  const endIndex = text.indexOf('} as const;', startIndex);
  const block = text.slice(startIndex, endIndex);
  const pattern = new RegExp(`(${key}:\\s*')([^']*)(')`);
  if (!pattern.test(block)) {
    throw new Error(`在 ${blockStart} 里找不到字段 ${key}`);
  }
  const updated = block.replace(pattern, `$1${value}$3`);
  return text.slice(0, startIndex) + updated + text.slice(endIndex);
}

function currentValues() {
  const config = read(configPath);
  const astro = read(astroConfigPath);
  const staticmanBlock = config.slice(config.indexOf('export const STATICMAN'), config.indexOf('} as const;', config.indexOf('export const STATICMAN')));
  const feedbackBlock = config.slice(config.indexOf('export const FEEDBACK'), config.indexOf('} as const;', config.indexOf('export const FEEDBACK')));
  const pick = (text, key) => new RegExp(`${key}:\\s*'([^']*)'`).exec(text)?.[1] ?? '(未找到)';
  return {
    username: pick(staticmanBlock, 'username'),
    repository: pick(staticmanBlock, 'repository'),
    branch: pick(staticmanBlock, 'branch'),
    endpoint: pick(staticmanBlock, 'endpoint'),
    feedbackRepo: `${pick(feedbackBlock, 'repoOwner')}/${pick(feedbackBlock, 'repoName')}`,
    title: pick(config, 'title'),
    site: pick(astro, 'site'),
  };
}

if (args.includes('--check') || args.length === 0) {
  const values = currentValues();
  console.log('当前配置：');
  for (const [key, value] of Object.entries(values)) {
    console.log(`  ${key.padEnd(10)} ${value}`);
  }
  if (args.length === 0) {
    console.log('\n用法：node scripts/setup.mjs --user <GitHub 用户名> --repo <仓库名> [--branch main] [--site https://…] [--title 站点名]');
  }
  process.exit(0);
}

const username = arg('user');
const repository = arg('repo');
const branch = arg('branch') ?? 'main';
const site = arg('site');
const title = arg('title');

if (!username || !repository) {
  console.error('缺少参数：--user 和 --repo 都是必填（例如 --user octocat --repo wuwa-guide）');
  process.exit(1);
}

if (!/^[A-Za-z0-9-]+$/.test(username)) {
  console.error(`GitHub 用户名不合法：${username}`);
  process.exit(1);
}
if (!/^[A-Za-z0-9._-]+$/.test(repository)) {
  console.error(`仓库名不合法：${repository}`);
  process.exit(1);
}
if (site && !/^https?:\/\//.test(site)) {
  console.error(`--site 必须以 http(s):// 开头：${site}`);
  process.exit(1);
}

const STATICMAN_BLOCK = 'export const STATICMAN';
const FEEDBACK_BLOCK = 'export const FEEDBACK';

let config = read(configPath);
config = setInBlock(config, STATICMAN_BLOCK, 'username', username);
config = setInBlock(config, STATICMAN_BLOCK, 'repository', repository);
config = setInBlock(config, STATICMAN_BLOCK, 'branch', branch);
// 纠错窗口同样指向这个仓库
config = setInBlock(config, FEEDBACK_BLOCK, 'repoOwner', username);
config = setInBlock(config, FEEDBACK_BLOCK, 'repoName', repository);
if (title) config = setInBlock(config, 'export const SITE', 'title', title);
writeFileSync(configPath, config, 'utf8');

// CODEOWNERS：只有站长一个人（任何 PR 都要站长批准）
const codeowners = `# CODEOWNERS —— 配合仓库设置里的 "Require review from Code Owners" 使用。
#
# 这里只有站长一个人：任何 PR 都需要站长批准后才能合并。
# 本文件由 \`npm run setup\` 生成。

*  @${username}
`;
writeFileSync(codeownersPath, codeowners, 'utf8');

// 旧版本的多审批人配置，存在就清掉
if (existsSync(approversPath)) unlinkSync(approversPath);

if (site) {
  let astroConfig = read(astroConfigPath);
  // astro.config.mjs 是 defineConfig({...})，直接用单行替换
  astroConfig = astroConfig.replace(/(site:\s*')([^']*)(')/, `$1${site.replace(/\/$/, '')}$3`);
  writeFileSync(astroConfigPath, astroConfig, 'utf8');
}

const values = currentValues();
console.log('已更新：');
for (const [key, value] of Object.entries(values)) {
  console.log(`  ${key.padEnd(10)} ${value}`);
}
console.log(`
提交流程地址（Staticman 会自动用它开 PR）：
  ${values.endpoint}/${values.username}/${values.repository}/${values.branch}/guides
  ${values.endpoint}/${values.username}/${values.repository}/${values.branch}/teams

接下来：
  1. npm run build   # 确认构建通过
  2. 把仓库推到 GitHub，并在 Cloudflare Pages 配置构建（见 README 第 5 节）
  3. 给仓库加上 staticmanapp 协作者，再访问
     https://best.staticman.net/v2/connect/${values.username}/${values.repository}
  4. 运行 npm run protect -- --apply（或按 README 在网页上开分支保护），
     这样内容 PR 必须由你（仓库所有者）批准后才能合并。
`);
