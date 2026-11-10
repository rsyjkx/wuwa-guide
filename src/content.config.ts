import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content Collections 校验配置。
 *
 * 数据来源有两条：
 *   1. 手动维护的 Markdown 文件（src/content/guides、src/content/teams）
 *   2. Staticman 审核合并后的 PR：文件由 Staticman 写入同样的目录，格式是
 *      frontmatter + 正文的 Markdown（staticman.yml 里 format: "frontmatter"）
 *
 * 因此这里的 schema 就是"投稿质量闸门"：任何一条不合规的数据都会让构建失败，
 * 配合 .github/workflows/validate.yml 可以在 PR 阶段就拦住，而不是合并后才炸站。
 */

/** 把 "a, b，c"、换行分隔的文本或数组统一成去重、去空的字符串数组。 */
function toArray(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,，、;；|]/)
      : [];

  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))];
}

/** 选填文本：空串 / null / undefined 一律当成"没填"。 */
const optionalText = z.preprocess(
  (value) => (value === null || value === undefined || value === '' ? undefined : String(value).trim()),
  z.string().max(200).optional(),
);

const requiredText = z.string().trim().min(1, '不能为空').max(400);

/**
 * 图片 / 视频地址。
 *
 * 只允许两种形式：
 *   · https:// 或 http:// 开头的外链（图床、GitHub 附件、B 站、YouTube）
 *   · / 开头的站内路径（放在仓库 public/ 目录里的图片，例如 /media/cover.png）
 *
 * 显式拒绝 javascript:/data: 之类的协议，避免把用户输入直接塞进 <img src> / <iframe src>。
 */
const urlText = z
  .string()
  .trim()
  .min(1)
  .max(600, '链接过长')
  .refine((value) => /^(https?:\/\/|\/)/i.test(value), '必须是 http(s):// 外链，或以 / 开头的站内路径');

const optionalUrl = z.preprocess(
  (value) => (value === null || value === undefined || value === '' ? undefined : String(value).trim()),
  urlText.optional(),
);

/** 图集：最多 12 张，字段可以写成 YAML 数组，也可以写成一行一个链接的字符串。 */
const urlList = z.preprocess(toArray, z.array(urlText).max(12, '最多 12 张图'));

/** 标签：表单里可以逗号分隔，手工文件里也可以直接写 YAML 数组。 */
const tagList = z.preprocess(toArray, z.array(z.string().max(40)).max(12));

/**
 * 单角色攻略。
 * Staticman 表单字段与这里一一对应：
 *   title / character / author / version / tags / cover / images / video / content
 * （content 会被 Staticman 写成正文，不进入 frontmatter）
 */
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    /** 攻略标题 */
    title: requiredText,
    /** 角色名（必填，角色页筛选依据） */
    character: requiredText,
    /** 作者昵称（可选） */
    author: optionalText,
    /** 提交日期：Staticman 通过 generatedFields 自动写入 ISO8601 字符串 */
    date: z.coerce.date(),
    /** 标签（可选） */
    tags: tagList.default([]),
    /** 适用游戏版本（可选） */
    version: optionalText,
    /** 封面图（可选） */
    cover: optionalUrl,
    /** 图集（可选）：截图、词条、伤害数字等 */
    images: urlList.default([]),
    /** 视频（可选）：B 站 / YouTube 链接，或 .mp4 直链 */
    video: optionalUrl,
  }),
});

const memberSchema = z.object({
  /** 成员角色名 */
  name: requiredText,
  /** 角色定位：主C / 副C / 辅助 / 治疗，或自定义分类 */
  role: requiredText,
});

/**
 * 配队推荐。
 * 关键约束：members 必须是对象数组（不是纯文本），coreCharacter 是角色页与配队页的桥梁。
 */
const teams = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/teams' }),
  schema: z.object({
    teamName: requiredText,
    coreCharacter: requiredText,
    members: z.array(memberSchema).min(1, '至少需要一名成员').max(8, '最多 8 名成员'),
    element: requiredText,
    /** 强度分级：只做展示，不参与任何排序逻辑 */
    tier: optionalText,
    scenario: tagList.default([]),
    summary: optionalText,
    author: optionalText,
    date: z.coerce.date().optional(),
    /** 封面图（可选）：配队卡片和详情页顶部展示 */
    cover: optionalUrl,
    /** 图集（可选）：面板、伤害截图、轴表等 */
    images: urlList.default([]),
    /** 视频（可选）：演示视频 */
    video: optionalUrl,
  }),
});

export const collections = { guides, teams };
