#!/usr/bin/env node
/**
 * 把 GitHub Issue（投稿模板）转成内容文件，并开一个 PR。
 *
 * 由 .github/workflows/issue-to-pr.yml 调用，运行在 GitHub Actions 里。
 *
 * 环境变量：
 *   GITHUB_TOKEN     Actions 自动提供
 *   GITHUB_REPOSITORY owner/repo
 *   ISSUE_NUMBER / ISSUE_TITLE / ISSUE_AUTHOR / ISSUE_BODY
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY ?? '';
const issueNumber = Number(process.env.ISSUE_NUMBER ?? 0);
const issueTitle = process.env.ISSUE_TITLE ?? '';
const issueAuthor = process.env.ISSUE_AUTHOR ?? '';
const issueBody = process.env.ISSUE_BODY ?? '';

if (!token || !repository || !issueNumber) {
  console.error('缺少 GITHUB_TOKEN / GITHUB_REPOSITORY / ISSUE_NUMBER');
  process.exit(1);
}

const kind = issueTitle.startsWith('[攻略]') ? 'guides' : issueTitle.startsWith('[配队]') ? 'teams' : null;
if (!kind) {
  console.log('标题没有 [攻略] / [配队] 前缀，跳过。');
  process.exit(0);
}

// ---------- 解析 Issue 表单 ----------
// Issue Forms 生成的正文形如：
//   ### 攻略标题
//
//   今汐 2.4 …
const sections = new Map();
{
  const lines = issueBody.split(/\r?\n/);
  let current = null;
  let buffer = [];
  const flush = () => {
    if (current) {
      const value = buffer.join('\n').trim();
      sections.set(current, value === '_No response_' ? '' : value);
    }
    buffer = [];
  };
  for (const line of lines) {
    const match = /^###\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      current = match[1].trim();
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();
}

const pick = (...names) => {
  for (const name of names) {
    const value = sections.get(name);
    if (value) return value;
  }
  return '';
};

const oneLine = (value) => value.replace(/\s+/g, ' ').trim();
const q = (value) => JSON.stringify(String(value));
const toList = (value) =>
  value
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);

const today = new Date().toISOString().slice(0, 10);

// ---------- 组装文件 ----------
let filePath;
let markdown;
let prTitle;
let summaryLines;

if (kind === 'guides') {
  const title = oneLine(pick('攻略标题')) || issueTitle.replace('[攻略]', '').trim();
  const character = oneLine(pick('角色名'));
  const version = oneLine(pick('适用游戏版本（可选）', '适用游戏版本'));
  const tags = toList(pick('标签（可选）', '标签'));
  const author = oneLine(pick('作者昵称（可选）', '作者昵称')) || issueAuthor;
  const content = pick('正文（支持 Markdown）', '正文');
  const cover = oneLine(pick('封面图链接（可选）', '封面图链接'));
  const images = toList(pick('图集链接（可选）', '图集链接'));
  const video = oneLine(pick('视频链接（可选）', '视频链接'));

  const missing = [];
  if (!title) missing.push('攻略标题');
  if (!character) missing.push('角色名');
  if (!content) missing.push('正文');
  if (missing.length) {
    console.error('缺少必填项：' + missing.join('、'));
    process.exit(1);
  }

  const frontmatter = [
    `title: ${q(title)}`,
    `character: ${q(character)}`,
    `author: ${q(author)}`,
    `date: ${q(today)}`,
    tags.length ? `tags: [${tags.map(q).join(', ')}]` : null,
    version ? `version: ${q(version)}` : null,
    cover ? `cover: ${q(cover)}` : null,
    images.length ? `images:\n${images.map((item) => `  - ${q(item)}`).join('\n')}` : null,
    video ? `video: ${q(video)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  filePath = resolve('src/content/guides', `issue-${issueNumber}.md`);
  markdown = `---\n${frontmatter}\n---\n\n${content}\n`;
  prTitle = `内容投稿：攻略「${title}」`;
  summaryLines = [`角色：${character}`, version && `版本：${version}`, tags.length && `标签：${tags.join('、')}`];
} else {
  const teamName = oneLine(pick('配队名称')) || issueTitle.replace('[配队]', '').trim();
  const coreCharacter = oneLine(pick('核心角色'));
  const element = oneLine(pick('体系 / 属性', '体系/属性', '体系 / 属性（必填）')) || '未分类';
  const tier = oneLine(pick('强度分级（可选，仅展示）', '强度分级'));
  const scenario = toList(pick('适用场景（可选）', '适用场景'));
  const summary = oneLine(pick('一句话说明（可选）', '一句话说明'));
  const author = oneLine(pick('作者昵称（可选）', '作者昵称')) || issueAuthor;
  const content = pick('正文（支持 Markdown）', '正文');
  const cover = oneLine(pick('封面图链接（可选）', '封面图链接'));
  const images = toList(pick('图集链接（可选，一行一个）', '图集链接'));
  const video = oneLine(pick('视频链接（可选）', '视频链接'));

  const members = pick('成员（每行一个：角色名 | 定位）', '成员')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, role] = line.split(/[|｜]/).map((part) => part.trim());
      return { name: name ?? '', role: role ?? '' };
    })
    .filter((member) => member.name);

  const missing = [];
  if (!teamName) missing.push('配队名称');
  if (!coreCharacter) missing.push('核心角色');
  if (!content) missing.push('正文');
  if (members.length === 0) missing.push('成员');
  if (members.some((member) => !member.role)) missing.push('成员的定位（格式：角色名 | 定位）');
  if (missing.length) {
    console.error('缺少或格式不对：' + missing.join('、'));
    process.exit(1);
  }

  const frontmatter = [
    `teamName: ${q(teamName)}`,
    `coreCharacter: ${q(coreCharacter)}`,
    'members:',
    ...members.map((member) => `  - name: ${q(member.name)}\n    role: ${q(member.role)}`),
    `element: ${q(element)}`,
    tier ? `tier: ${q(tier)}` : null,
    scenario.length ? `scenario: [${scenario.map(q).join(', ')}]` : null,
    summary ? `summary: ${q(summary)}` : null,
    `author: ${q(author)}`,
    `date: ${q(today)}`,
    cover ? `cover: ${q(cover)}` : null,
    images.length ? `images:\n${images.map((item) => `  - ${q(item)}`).join('\n')}` : null,
    video ? `video: ${q(video)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  filePath = resolve('src/content/teams', `issue-${issueNumber}.md`);
  markdown = `---\n${frontmatter}\n---\n\n${content}\n`;
  prTitle = `内容投稿：配队「${teamName}」`;
  summaryLines = [
    `核心角色：${coreCharacter}`,
    `体系：${element}`,
    `成员：${members.map((member) => `${member.name}(${member.role})`).join('、')}`,
  ];
}

mkdirSync(dirname(filePath), { recursive: true });
writeFileSync(filePath, markdown, 'utf8');
console.log('已生成文件：' + filePath.replace(process.cwd() + '/', ''));

// ---------- 建分支 + 提交 + 推送 ----------
const relativePath = filePath.replace(process.cwd() + '/', '');
const branch = `submission/issue-${issueNumber}`;

const git = (...args) => {
  console.log('$ git ' + args.join(' '));
  return execFileSync('git', args, { stdio: 'inherit' });
};

git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('checkout', '-B', branch);
git('add', relativePath);
git('commit', '-m', `content: 来自 Issue #${issueNumber} 的投稿`);
git('push', '--force', 'origin', `HEAD:${branch}`);

// ---------- 开 PR ----------
const api = 'https://api.github.com';
const call = async (method, path, body) => {
  const response = await fetch(api + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'issue-to-content',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, data: text ? JSON.parse(text) : null, text };
};

const body = [
  `关联 Issue：#${issueNumber}`,
  '',
  ...summaryLines.filter(Boolean).map((line) => `- ${line}`),
  '',
  '### 审核清单',
  '- [ ] 内容原创、无广告引流',
  '- [ ] 角色名 / 成员定位正确',
  '- [ ] 图片、视频链接能打开',
  '',
  '合并后 Cloudflare / GitHub Pages 会自动重建并更新搜索索引。',
].join('\n');

const pr = await call('POST', `/repos/${repository}/pulls`, {
  title: prTitle,
  head: branch,
  base: 'main',
  body,
  draft: false,
});

if (!pr.ok) {
  // 已经开过 PR（Issue 被编辑后重新触发）
  if (pr.status === 422) {
    console.log('PR 已存在，跳过创建。');
  } else {
    console.error('创建 PR 失败：' + pr.status + ' ' + pr.text.slice(0, 300));
    process.exit(1);
  }
} else {
  console.log('已创建 PR：' + pr.data.html_url);
  await call('POST', `/repos/${repository}/issues/${issueNumber}/comments`, {
    body: `已自动生成 PR：${pr.data.html_url}\n\n站长批准合并后就会发布；如果内容有需要修改的地方，直接编辑本 Issue 即可（会更新 PR）。`,
  });
}
