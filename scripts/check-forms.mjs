#!/usr/bin/env node
/**
 * 表单 ↔ Staticman 配置一致性检查。
 *
 * 这个脚本不做完整 YAML 解析（避免给站点增加运行时依赖），只按行扫描
 * staticman.yml 里的两个 property 段，提取 allowedFields / requiredFields 等，
 * 再和 src/pages/submit.astro 里两个 <form> 的 name="fields[...]" 做集合比对。
 *
 * 用法：npm run check:forms（CI 里也会跑）
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticmanPath = resolve(rootDir, 'staticman.yml');
const submitPath = resolve(rootDir, 'src/pages/submit.astro');

const errors = [];
const notes = [];

/** 取出某个顶层 property 的配置块文本 */
function getSection(text, name) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${name}:\\s*$`).test(line));
  if (start === -1) return null;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^[A-Za-z_][\w-]*:\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

/** 读取形如 key: ["a", "b"] 的数组（支持换行） */
function readList(block, key) {
  const match = new RegExp(`${key}:\\s*\\[([\\s\\S]*?)\\]`).exec(block);
  if (!match) return null;
  return match[1]
    .split(',')
    .map((item) => item.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function readScalar(block, key) {
  const match = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm').exec(block);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

const staticman = readFileSync(staticmanPath, 'utf8');
const submit = readFileSync(submitPath, 'utf8');

const sections = {
  guides: getSection(staticman, 'guides'),
  teams: getSection(staticman, 'teams'),
};

for (const [name, block] of Object.entries(sections)) {
  if (!block) {
    errors.push(`staticman.yml 缺少 ${name} 段`);
    continue;
  }

  const allowed = readList(block, 'allowedFields');
  const required = readList(block, 'requiredFields');
  const moderation = readScalar(block, 'moderation');
  const format = readScalar(block, 'format');
  const path = readScalar(block, 'path');

  if (!allowed) errors.push(`staticman.yml 的 ${name}.allowedFields 格式不对（应为数组）`);
  if (!required) errors.push(`staticman.yml 的 ${name}.requiredFields 格式不对（应为数组）`);

  if (moderation !== 'true') {
    errors.push(`staticman.yml 的 ${name}.moderation 必须是 true（否则投稿会直接进主分支）`);
  }
  if (format !== 'frontmatter') {
    errors.push(`staticman.yml 的 ${name}.format 应为 "frontmatter"（否则不会生成 Markdown）`);
  }
  if (path !== `src/content/${name}`) {
    errors.push(`staticman.yml 的 ${name}.path 应为 "src/content/${name}"，当前是 ${path}`);
  }
  if (!/content:\s*frontmatterContent/.test(block)) {
    errors.push(`staticman.yml 的 ${name}.transforms 缺少 content: frontmatterContent`);
  }
  if (allowed?.includes('_honeypot')) {
    errors.push(`staticman.yml 的 ${name}.allowedFields 不能包含 _honeypot（蜜罐必须保持"不允许"）`);
  }
  for (const field of required ?? []) {
    if (!allowed?.includes(field)) {
      errors.push(`${name}.requiredFields 里的 ${field} 不在 allowedFields 中`);
    }
  }

  // 从提交页里找对应的 <form>
  const forms = [...submit.matchAll(/<form\b[\s\S]*?<\/form>/g)].map((match) => match[0]);
  const form = forms.find((markup) => new RegExp(`${name}"`).test(markup) && /data-staticman/.test(markup));

  if (!form) {
    errors.push(`submit.astro 里找不到提交 ${name} 的表单`);
    continue;
  }

  // 表单里的字段名有两种写法：
  //   name="fields[title]"                  （普通输入框）
  //   name={`fields[members][${index}][name]`}  （模板里动态编号的成员行）
  // 所以这里对整个 <form> 片段扫 fields[...]，只取第一段作为字段名。
  const formFields = new Set(
    [...form.matchAll(/fields\[([A-Za-z_][\w-]*)\]/g)]
      .map((match) => match[1])
      .filter((field) => field !== '_honeypot'),
  );

  const allowedSet = new Set(allowed ?? []);
  for (const field of formFields) {
    if (!allowedSet.has(field)) {
      errors.push(`表单字段 fields[${field}]（${name}）没有写进 staticman.yml 的 allowedFields`);
    }
  }
  for (const field of allowedSet) {
    if (!formFields.has(field)) {
      errors.push(`staticman.yml 的 ${name}.allowedFields 里有 ${field}，但表单没有对应字段`);
    }
  }
  for (const field of required ?? []) {
    if (!formFields.has(field)) {
      errors.push(`${name} 的必填字段 ${field} 在表单里没有对应输入`);
    }
  }

  notes.push(
    `${name}: ${formFields.size} 个表单字段 / ${allowedSet.size} 个允许字段 / 必填 ${(required ?? []).length} 个`,
  );
}

if (errors.length > 0) {
  console.error('✗ 表单与 Staticman 配置不一致：');
  for (const error of errors) console.error('  - ' + error);
  process.exit(1);
}

console.log('✓ 表单字段与 staticman.yml 一致');
for (const note of notes) console.log('  · ' + note);
