#!/usr/bin/env node
/**
 * 一键配置 main 分支的保护规则（可选，但强烈建议）。
 *
 * 目标：内容 PR 必须满足以下条件才能合并
 *   · 至少 1 个批准，且必须是站长（required_approving_review_count = 1 + CODEOWNERS）
 *   · 必须是 CODEOWNERS 里的人批准（require_code_owner_reviews = true）
 *   · validate / review-gate 两个检查通过
 *   · 不允许直接往 main 推（只允许 PR 合并）
 *
 * 需要 GitHub Token（有 repo/admin 权限）：
 *   Windows PowerShell:
 *     $env:GH_TOKEN="ghp_xxx"; node scripts/apply-branch-protection.mjs --dry-run
 *     $env:GH_TOKEN="ghp_xxx"; node scripts/apply-branch-protection.mjs --apply
 *
 * 没有 Token 也可以照 README 在网页上手动点：
 *   Settings → Rules / Branches → Add branch protection rule
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const branch = args.find((arg) => arg.startsWith('--branch='))?.split('=')[1] ?? 'main';

function readRepo() {
  // 复用站点配置里的仓库信息
  const configText = readFileSync(resolve(rootDir, 'src/config.ts'), 'utf8');
  const pick = (key) => new RegExp(`${key}:\\s*'([^']*)'`).exec(configText)?.[1] ?? '';
  return { owner: pick('username'), repo: pick('repository') };
}

const { owner, repo } = readRepo();

if (!owner || owner === 'YOUR_GITHUB_USER') {
  console.error('src/config.ts 里的仓库信息还是占位符，先运行：npm run setup -- --user <你> --repo <仓库>');
  process.exit(1);
}

const payload = {
  required_status_checks: {
    strict: true,
    contexts: ['build', 'review-gate'],
  },
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
};

const endpoint = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`;

console.log('仓库：', `${owner}/${repo}`);
console.log('分支：', branch);
console.log('审批：只允许仓库所有者（站长）批准，1 个批准即可合并');
console.log('请求：', 'PUT', endpoint);
console.log('载荷：');
console.log(JSON.stringify(payload, null, 2));

if (!apply) {
  console.log('\n这是 dry-run。确认无误后加 --apply 真正写入（需要 GH_TOKEN）。');
  process.exit(0);
}

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
if (!token) {
  console.error('\n缺少 GH_TOKEN 环境变量。');
  process.exit(1);
}

const response = await fetch(endpoint, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'wuwa-guide-setup',
  },
  body: JSON.stringify(payload),
});

const text = await response.text();
if (!response.ok) {
  console.error(`失败：HTTP ${response.status}`);
  console.error(text.slice(0, 1200));
  process.exit(1);
}

console.log(`\n✓ 已写入分支保护（HTTP ${response.status}）。`);
console.log('现在内容 PR 需要站长批准 + build / review-gate 通过才能合并。');
