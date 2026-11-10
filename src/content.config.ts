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
 * 养成面板（可选）：攻略页顶部那张"养成卡"用的结构化数据。
 * 对应参考图里的：毕业面板 / 关键共鸣链 / 天赋加点 / 武器推荐 / 声骸推荐 / 队伍搭配。
 * 所有子字段都可选，没填就不渲染那一块。
 */
const buildWeapon = z.object({
  name: requiredText,
  note: optionalText,
  image: optionalUrl,
});

const buildEcho = z.object({
  /** 费用：4 / 3 / 1，或"首位" */
  cost: requiredText,
  /** 主词条，例如 暴击/爆伤 */
  main: requiredText,
});

const buildSchema = z.object({
  attack: optionalText,
  critRate: optionalText,
  critDamage: optionalText,
  energyRegen: optionalText,
  /** 关键共鸣链：1–6 里哪几链最关键 */
  keyNodes: z
    .preprocess(
      (value) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,，、]+/) : []),
      z.array(z.coerce.number().int().min(1).max(6)).max(6),
    )
    .default([]),
  /** 天赋加点顺序，从高到低 */
  talentOrder: tagList.default([]),
  weapons: z.array(buildWeapon).max(6).default([]),
  echoCosts: z.array(buildEcho).max(8).default([]),
  /** 关键命座效果描述（可选）：推荐几命、每命提升什么 */
  nodeNotes: optionalText,
  echoSet: optionalText,
  echoFirst: optionalText,
  substatOrder: optionalText,
  teams: tagList.default([]),
});

/** 面板整体可选：不填就不渲染。 */
const buildOptional = z.preprocess(
  (value) => (value === null || value === '' ? undefined : value),
  buildSchema.optional(),
);

/**
 * 单角色攻略。
 * Staticman 表单字段与这里一一对应：
 *   title / character / author / version / tags / cover / images / video / content
 * （content 会被 Staticman 写成正文，不进入 frontmatter）
 */
/** 配队面板：每个位置一段（声骸 / 武器 / 加点），对应"一图流"里的一排 */
const buildMember = z.object({
  /** 位置：一号位 / 二号位 / 可替换 */
  slot: requiredText,
  /** 角色名 */
  character: requiredText,
  /** 下位替代（可选）：没有这个角色时可以用谁 */
  substitute: optionalText,
  /** 毕业面板数值（每个成员一张小面板） */
  hp: optionalText,
  attack: optionalText,
  critRate: optionalText,
  critDamage: optionalText,
  energyRegen: optionalText,
  /** 关键共鸣链 */
  keyNodes: z
    .preprocess(
      (value) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,，、]+/) : []),
      z.array(z.coerce.number().int().min(1).max(6)).max(6),
    )
    .default([]),
  /** 关键命座效果描述（可选） */
  nodeNotes: optionalText,
  echoSet: optionalText,
  echoCosts: z.array(buildEcho).max(8).default([]),
  echoFirst: optionalText,
  substatOrder: optionalText,
  /** 额外需求，例如"共鸣效率需求 250%" */
  requirement: optionalText,
  weapons: z.array(buildWeapon).max(6).default([]),
  talentOrder: tagList.default([]),
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
    /** 标签：体系 / 属性，例如 同奏、导电（列表页筛选用） */
    tags: tagList.default([]),
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
    /** 视频出处（可选）：视频作者 / 攻略组，标注来源用 */
    videoCredit: optionalText,
    /** 配队面板（可选）：每个位置一段，渲染成"一图流" */
    buildMembers: z.array(buildMember).max(8).default([]),
    /** 正文是否跟随面板自动生成（开启后正文由面板数据生成，不再手写） */
    syncBody: z.boolean().default(false),
  }),
});

export const collections = { teams };
