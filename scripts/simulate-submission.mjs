#!/usr/bin/env node
/**
 * 本地模拟 Staticman 投稿（不碰 GitHub）。
 *
 * 为什么需要它：
 *   线上链路是 表单 → Staticman → PR → 合并 → 构建。合并之后会发生什么，以前只能靠猜。
 *   这个脚本用 Staticman 完全相同的规则（frontmatter + 正文，date 为 ISO8601 字符串）
 *   在 src/content/ 下生成文件，让你能立刻验证：
 *     · Zod schema 是否接受 Staticman 写的结构
 *     · 详情页 / 角色页 / 配队列表是否正常渲染
 *     · Pagefind 索引与角色/体系筛选是否命中
 *
 * 用法：
 *   node scripts/simulate-submission.mjs                 # 生成 1 篇攻略 + 1 支配队
 *   node scripts/simulate-submission.mjs --kind guides   # 只生成攻略
 *   node scripts/simulate-submission.mjs --clean         # 删除所有模拟文件
 *   node scripts/simulate-submission.mjs --clean --build # 删完再重新构建一次
 */

import { readdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = resolve(rootDir, 'src/content');

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const getValue = (name, fallback) => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
};

const kind = getValue('kind', 'all');
const shouldClean = hasFlag('clean');
const shouldBuild = hasFlag('build');

/** 把字符串写成 YAML 标量：全部用双引号，避免中文标点/冒号导致的歧义。 */
const q = (value) => JSON.stringify(String(value));

/**
 * 只处理我们这个数据模型用到的三种结构：标量、字符串数组、对象数组。
 * Staticman 用的是 js-yaml 的 safeDump，输出格式略有差异（它会给需要的地方加引号），
 * 但两者都是合法 YAML，Astro 侧的解析结果一致。
 */
function dumpFields(fields) {
  const lines = [];

  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      if (value.length > 0 && value[0] !== null && typeof value[0] === 'object') {
        lines.push(`${key}:`);
        for (const item of value) {
          Object.entries(item).forEach(([itemKey, itemValue], index) => {
            lines.push(`  ${index === 0 ? '- ' : '  '}${itemKey}: ${q(itemValue)}`);
          });
        }
      } else {
        lines.push(`${key}: [${value.map((item) => q(item)).join(', ')}]`);
      }
    } else {
      lines.push(`${key}: ${q(value)}`);
    }
  }

  return lines.join('\n') + '\n';
}

/** 与 Staticman 的 `_createFile()` 完全一致的拼接方式 */
function toStaticmanMarkdown(fields, content) {
  const attributes = { ...fields };
  delete attributes.content;
  return `---\n${dumpFields(attributes)}---\n${content}\n`;
}

function cleanup() {
  const removed = [];
  for (const dir of ['guides', 'teams']) {
    const absolute = resolve(CONTENT_DIR, dir);
    if (!existsSync(absolute)) continue;
    for (const file of readdirSync(absolute)) {
      if (/-(sim)-\d+\.md$/.test(file)) {
        unlinkSync(resolve(absolute, file));
        removed.push(`${dir}/${file}`);
      }
    }
  }
  console.log(removed.length ? `已删除 ${removed.length} 个模拟文件：\n  ${removed.join('\n  ')}` : '没有需要删除的模拟文件。');
  return removed;
}

const stamp = Date.now();
const isoDate = new Date().toISOString();
const written = [];

if (shouldClean) {
  cleanup();
} else {
  const makeGuides = kind === 'all' || kind === 'guides';
  const makeTeams = kind === 'all' || kind === 'teams';

  if (makeGuides) {
    const fields = {
      title: `模拟投稿：验证 Staticman frontmatter ${stamp}`,
      character: '散华',
      author: '模拟投稿机器人',
      version: '2.4',
      // 表单里 tags 是逗号分隔的字符串，schema 会归一化成数组
      tags: '输出手法, 冷凝',
      // 媒体：封面 + 图集（一行一个）+ 视频（B 站）
      cover: '/media/example-cover.svg',
      images: '/media/example-shot-1.svg\n/media/example-shot-2.svg',
      video: 'https://www.bilibili.com/video/BV1GJ411x7h7',
      _honeypot: '',
    };
    const content = [
      '## 这是模拟投稿生成的正文',
      '',
      '这条内容由 `scripts/simulate-submission.mjs` 生成，用来验证 Staticman 写入的文件能否被正常渲染。',
      '',
      '- 如果这条内容能出现在列表、详情页和搜索结果里，说明「合并之后的链路」是通的。',
      '- 验证完执行 `node scripts/simulate-submission.mjs --clean` 删除。',
    ].join('\n');

    // Staticman 的 generatedFields.date 会以 ISO8601 字符串写进 frontmatter
    const file = resolve(CONTENT_DIR, 'guides', `guide-sim-${stamp}.md`);
    writeFileSync(file, toStaticmanMarkdown({ ...fields, date: isoDate }, content), 'utf8');
    written.push(file);
  }

  if (makeTeams) {
    const fields = {
      teamName: `模拟配队 ${stamp}`,
      coreCharacter: '散华',
      members: [
        { name: '散华', role: '主C' },
        { name: '白芷', role: '治疗' },
      ],
      element: '冷凝',
      tier: 'T1',
      scenario: ['新手开荒'],
      summary: '模拟投稿生成的配队，用于验证 members 对象数组与筛选。',
      cover: '/media/example-team-cover.svg',
      author: '模拟投稿机器人',
      _honeypot: '',
    };
    const content = [
      '## 模拟配队正文',
      '',
      '这段正文用来验证 Pagefind 的 team-element 筛选与正文索引。',
    ].join('\n');

    const file = resolve(CONTENT_DIR, 'teams', `team-sim-${stamp}.md`);
    writeFileSync(file, toStaticmanMarkdown({ ...fields, date: isoDate }, content), 'utf8');
    written.push(file);
  }

  console.log(`已写入 ${written.length} 个模拟投稿文件：\n  ${written.join('\n  ')}`);
  console.log('\n下一步：npm run build，然后看页面 / 搜索；验证完用 --clean 清理。');
}

if (shouldBuild) {
  console.log('\n开始构建…');
  execFileSync(process.execPath, [resolve(rootDir, 'node_modules/astro/bin/astro.mjs'), 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  execFileSync(
    process.execPath,
    [resolve(rootDir, 'node_modules/pagefind/lib/runner/bin.cjs'), '--site', 'dist'],
    { cwd: rootDir, stdio: 'inherit' },
  );
}
