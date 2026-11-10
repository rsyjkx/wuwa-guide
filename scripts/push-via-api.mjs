#!/usr/bin/env node
/**
 * 没有 git 也能把站点推到 GitHub（用 GitHub REST API）。
 *
 * 适用场景：这台电脑没装 git，或者不想折腾命令行。
 *
 * 用法：
 *   # 1) 先看会传哪些文件（不发任何请求）
 *   node scripts/push-via-api.mjs --dry-run
 *
 *   # 2) 真正推送（仓库需要先建好，Public，空仓库）
 *   $env:GH_TOKEN="github_pat_xxx"
 *   $env:GH_OWNER="你的用户名"; $env:GH_REPO="wuwa-guide"
 *   node scripts/push-via-api.mjs --apply
 *
 *   # 3) 顺便开启 GitHub Pages + main 分支保护
 *   node scripts/push-via-api.mjs --apply --pages --protect
 *
 * 令牌需要的最小权限（fine-grained token，只授权这一个仓库）：
 *   Contents: Read and write      （推文件）
 *   Workflows: Read and write     （推 .github/workflows/*）
 *   Pages: Read and write         （开启 Pages）
 *   Administration: Read and write（分支保护，可选）
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--apply');
const doPages = args.includes('--pages');
const doProtect = args.includes('--protect');

const token = process.env.GH_TOKEN;
let owner = process.env.GH_OWNER;
const repo = process.env.GH_REPO ?? 'wuwa-guide';
const branch = process.env.GH_BRANCH ?? 'main';

if (!dryRun && !token) {
  console.error('缺少 GH_TOKEN。示例：');
  console.error('  $env:GH_TOKEN="ghp_xxx"; $env:GH_REPO="wuwa-guide"');
  process.exit(1);
}

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.astro', '.npm-cache', '.git']);
const EXCLUDE_FILES = new Set(['pnpm-lock.yaml']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.dsh')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      out.push(full);
    }
  }
  return out;
}

const files = walk(rootDir).map((full) => ({
  absolute: full,
  path: relative(rootDir, full).split('\\').join('/'),
  size: statSync(full).size,
}));

const binaryExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.zip', '.pdf']);

console.log(`仓库：${owner ?? '(未设置)'}/${repo}　分支：${branch}`);
console.log(`待上传文件：${files.length} 个，合计 ${(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1)} KB`);
console.log('前 12 个：');
for (const file of files.slice(0, 12)) console.log(`  ${file.path} (${file.size} B)`);

if (dryRun) {
  console.log('\n这是 dry-run（不会发请求）。确认后加 --apply 真正推送。');
  process.exit(0);
}

const api = 'https://api.github.com';

async function call(method, path, body) {
  const response = await fetch(api + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'wuwa-guide-push',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 400)}`);
  }
  return data;
}

// 0) 没给 owner 就用 token 自己的账号
if (!owner) {
  const me = await call('GET', '/user');
  owner = me.login;
  console.log(`使用账号：${owner}`);
}

// 1) 仓库不存在就创建
let repoInfo;
try {
  repoInfo = await call('GET', `/repos/${owner}/${repo}`);
  console.log(`\n✓ 仓库已存在：${repoInfo.full_name}（${repoInfo.private ? 'private' : 'public'}）`);
} catch (error) {
  if (!String(error.message).includes('404')) throw error;
  repoInfo = await call('POST', '/user/repos', {
    name: repo,
    description: '《鸣潮》单角色攻略与配队静态站（Astro + Staticman + Pagefind）',
    private: false,
    auto_init: false,
    has_issues: true,
    has_wiki: false,
  });
  console.log(`\n✓ 已创建仓库：${repoInfo.full_name}（public）`);
}

if (doPages) {
  try {
    await call('POST', `/repos/${owner}/${repo}/pages`, { build_type: 'workflow' });
    console.log('✓ 已开启 GitHub Pages（Source = GitHub Actions）');
  } catch (error) {
    if (String(error.message).includes('409')) {
      await call('PUT', `/repos/${owner}/${repo}/pages`, { build_type: 'workflow' });
      console.log('✓ GitHub Pages 已更新为 Actions 构建');
    } else {
      console.log('! 开启 Pages 失败：' + error.message);
    }
  }
}

let baseCommitSha = null;
try {
  const ref = await call('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  baseCommitSha = ref.object.sha;
  console.log(`  已有分支 ${branch}（${baseCommitSha.slice(0, 7)}），将基于它追加提交`);
} catch {
  // 空仓库的 Git Data API 会返回 409，先用 Contents API 建一个占位提交
  console.log(`  仓库还是空的，先创建一个初始化提交…`);
  await call('PUT', `/repos/${owner}/${repo}/contents/.bootstrap`, {
    message: 'chore: 初始化仓库',
    content: Buffer.from('init\n').toString('base64'),
  });
  const ref = await call('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  baseCommitSha = ref.object.sha;
  console.log(`  已创建初始化提交（${baseCommitSha.slice(0, 7)}）`);
}

// 2) 逐个文件创建 blob
const blobs = [];
for (const file of files) {
  const content = readFileSync(file.absolute);
  const encoding = binaryExt.has(extname(file.path).toLowerCase()) ? 'base64' : 'base64';
  const data = await call('POST', `/repos/${owner}/${repo}/git/blobs`, {
    content: content.toString(encoding),
    encoding,
  });
  blobs.push({ path: file.path, mode: '100644', type: 'blob', sha: data.sha });
  process.stdout.write(`\r  已上传 ${blobs.length}/${files.length}`);
}
console.log('');

// 3) tree + commit + 更新分支
const tree = await call('POST', `/repos/${owner}/${repo}/git/trees`, {
  tree: blobs,
  ...(baseCommitSha ? {} : {}),
});

const commit = await call('POST', `/repos/${owner}/${repo}/git/commits`, {
  message: 'init: 鸣潮攻略站（Astro + Staticman + Pagefind）',
  tree: tree.sha,
  parents: baseCommitSha ? [baseCommitSha] : [],
});

if (baseCommitSha) {
  await call('PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    sha: commit.sha,
    force: false,
  });
} else {
  await call('POST', `/repos/${owner}/${repo}/git/refs`, {
    ref: `refs/heads/${branch}`,
    sha: commit.sha,
  });
}

console.log(`\n✓ 已推送 ${files.length} 个文件，提交 ${commit.sha.slice(0, 7)}`);

// 4) 开启 GitHub Pages（用 Actions 作为构建源）
if (doPages) {
  try {
    await call('POST', `/repos/${owner}/${repo}/pages`, { build_type: 'workflow' });
    console.log('✓ 已开启 GitHub Pages（Source = GitHub Actions）');
  } catch (error) {
    if (String(error.message).includes('409')) {
      await call('PUT', `/repos/${owner}/${repo}/pages`, { build_type: 'workflow' });
      console.log('✓ GitHub Pages 已更新为 Actions 构建');
    } else {
      console.log('! 开启 Pages 失败（可以在仓库 Settings → Pages 手动选 GitHub Actions）：' + error.message);
    }
  }
}

// 5) 分支保护：只允许站长批准 + 必须过 build / review-gate
if (doProtect) {
  try {
    await call('PUT', `/repos/${owner}/${repo}/branches/${branch}/protection`, {
      required_status_checks: { strict: true, contexts: ['build', 'review-gate'] },
      enforce_admins: false,
      required_pull_request_reviews: {
        dismiss_stale_reviews: true,
        require_code_owner_reviews: true,
        required_approving_review_count: 1,
      },
      restrictions: null,
      allow_force_pushes: false,
      allow_deletions: false,
      required_conversation_resolution: true,
    });
    console.log('✓ 已开启分支保护（1 个批准 + build/review-gate + 禁止直推）');
  } catch (error) {
    console.log('! 分支保护失败（可在 Settings → Branches 手动开）：' + error.message);
  }
}

try {
  await call('POST', `/repos/${owner}/${repo}/actions/workflows/deploy-pages.yml/dispatches`, { ref: branch });
  console.log('✓ 已触发 deploy-pages 工作流');
} catch (error) {
  console.log('! 触发工作流失败（可在 Actions 页手动 Run workflow）：' + error.message);
}

console.log(`
下一步：
  1. 打开 https://github.com/${owner}/${repo}/actions ，等 deploy-pages 跑完
  2. 站点地址：https://${owner}.github.io/${repo === `${owner}.github.io` ? '' : repo + '/'}
`);
