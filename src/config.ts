/**
 * 站点与投稿端的集中配置。
 *
 * 部署前通常只需要改 STATICMAN 里的三项：username / repository / branch。
 * 也可以直接跑一条命令把它们写好（包括站点地址和审批人）：
 *   npm run setup -- --user <你> --repo <仓库> --admins <管理员A,管理员B> --site https://你的域名
 *
 * 如果官方公共实例不可用（或你自部署了 Staticman），把 endpoint 换成你的实例地址即可，
 * 例如：'https://my-staticman.onrender.com/v2/entry'
 */

export const SITE = {
  title: '鸣潮攻略站',
  /**
   * 出现在首页标题、meta description 里的一句话介绍。
   */
  description: '《鸣潮》单角色攻略与配队推荐，支持按角色筛选与全文搜索。',
  lang: 'zh-CN',
} as const;

/**
 * 内容纠错入口（页面右下角的悬浮按钮）。
 * 默认把反馈送到仓库的 GitHub Issues（不需要后端、不需要数据库、免费）。
 * 仓库还没配置时，反馈窗口只保留"复制反馈内容"。
 *
 * 注意：这里的字段名故意与 STATICMAN 不同（repoOwner / repoName），
 * 避免 `npm run setup` 做文本替换时改错对象。
 */
export const FEEDBACK = {
  repoOwner: 'rsyjkx',
  repoName: 'wuwa-guide',
  /** Issue 上自动打的标签，仓库里先建好同名标签即可 */
  labels: ['content-error', 'feedback'],
} as const;

/**
 * Staticman v2 公共实例。
 *
 * 说明：项目最初计划使用 https://api.staticman.net/v2/entry/，
 * 但该域名目前已经无法解析（DNS 找不到），官方公共实例迁移到了
 * https://best.staticman.net，v2 路由与字段协议保持完全一致。
 * 这里把地址抽成常量，切换实例只需要改这一行。
 */
export const STATICMAN = {
  endpoint: 'https://best.staticman.net/v2/entry',
  username: 'rsyjkx',
  repository: 'wuwa-guide',
  branch: 'main',
} as const;

/** 两个内容集合，同时也是 staticman.yml 里两个 property 的名字。 */
export type SubmissionKind = 'guides' | 'teams';

/**
 * 拼接 Staticman v2 的提交地址：
 *   {endpoint}/{user}/{repo}/{branch}/{property}
 * property 对应 staticman.yml 里的配置段名（guides / teams）。
 */
export function staticmanAction(kind: SubmissionKind): string {
  return `${STATICMAN.endpoint}/${STATICMAN.username}/${STATICMAN.repository}/${STATICMAN.branch}/${kind}`;
}

/** 占位符还没替换时，提交页会显示提醒。 */
export const staticmanReady =
  String(STATICMAN.username) !== 'YOUR_GITHUB_USER' && String(STATICMAN.repository) !== 'YOUR_REPO';

/**
 * 兜底入口：直接在 GitHub 网页上新建文件（表单提交不了时用）。
 * 格式：https://github.com/<user>/<repo>/new/<branch>/<目录>
 */
export function newFileUrl(kind: SubmissionKind): string {
  const dir = kind === 'guides' ? 'src/content/guides' : 'src/content/teams';
  return `https://github.com/${STATICMAN.username}/${STATICMAN.repository}/new/${STATICMAN.branch}/${dir}`;
}

/**
 * 仓库里某个内容文件的 GitHub 操作链接。
 *   blob   → 查看
 *   edit   → 网页编辑
 *   delete → 网页删除（会走 GitHub 的删除确认页）
 * 只有仓库所有者 / 协作者点了才有效果，其他人会看到 404 或只读页面。
 */
export function repoFileUrl(
  kind: SubmissionKind,
  id: string,
  action: 'blob' | 'edit' | 'delete',
): string {
  const dir = kind === 'guides' ? 'src/content/guides' : 'src/content/teams';
  const base = `https://github.com/${STATICMAN.username}/${STATICMAN.repository}`;
  return `${base}/${action}/${STATICMAN.branch}/${dir}/${id}.md`;
}

/** 表单里的可选项（只做输入建议，schema 不做枚举限制，方便以后加新体系/新定位）。 */
export const ELEMENT_SUGGESTIONS = [
  '冷凝',
  '热熔',
  '导电',
  '气动',
  '衍射',
  '湮灭',
  '聚爆',
  '风蚀',
] as const;

export const ROLE_SUGGESTIONS = ['主C', '副C', '辅助', '治疗'] as const;

export const SCENARIO_OPTIONS = ['逆境深塔', '冥歌海墟', '新手开荒'] as const;

export const TIER_SUGGESTIONS = ['T0', 'T0.5', 'T1', 'T2'] as const;
