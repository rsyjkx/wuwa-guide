import type { CollectionEntry } from 'astro:content';
import { withBase } from './urls';

export type Guide = CollectionEntry<'guides'>;
export type Team = CollectionEntry<'teams'>;

export interface CharacterSummary {
  /** 角色名（也是角色页的路径参数） */
  name: string;
  /** 该角色的攻略数 */
  guideCount: number;
  /** 以该角色为核心的配队数（按 coreCharacter 统计） */
  teamCount: number;
  /** 角色页地址 */
  path: string;
}

/**
 * 角色页地址。
 * 路径参数用原始中文名（构建产物是 dist/characters/今汐/index.html），
 * href 里做一次 URL 编码，避免链接里出现需要浏览器猜测的字符。
 */
export function characterPath(name: string): string {
  return withBase(`characters/${encodeURIComponent(name)}/`);
}

export function guidePath(guide: Guide): string {
  return withBase(`guides/${guide.id}/`);
}

export function teamPath(team: Team): string {
  return withBase(`teams/${team.id}/`);
}

/** 中文按拼音排序，保证每次构建顺序稳定。 */
const collator = new Intl.Collator('zh-CN');

function timeOf(date: Date | undefined): number {
  return date ? new Date(date).getTime() : 0;
}

/** 攻略按日期倒序（新的在前），同日期用标题兜底保证稳定。 */
export function sortGuides(list: Guide[], direction: 'asc' | 'desc' = 'desc'): Guide[] {
  const factor = direction === 'desc' ? -1 : 1;
  return [...list].sort(
    (a, b) => factor * (timeOf(a.data.date) - timeOf(b.data.date)) || collator.compare(a.data.title, b.data.title),
  );
}

/** 配队按日期倒序；tier 只展示，不参与排序。 */
export function sortTeams(list: Team[]): Team[] {
  return [...list].sort(
    (a, b) => timeOf(b.data.date) - timeOf(a.data.date) || collator.compare(a.data.teamName, b.data.teamName),
  );
}

/** 所有出现过的角色：攻略角色 + 配队核心角色 + 配队成员。 */
export function allCharacters(guides: Guide[], teams: Team[]): CharacterSummary[] {
  const names = new Set<string>();

  for (const guide of guides) names.add(guide.data.character);
  for (const team of teams) {
    names.add(team.data.coreCharacter);
    for (const member of team.data.members) names.add(member.name);
  }

  const guideCount = new Map<string, number>();
  for (const guide of guides) {
    guideCount.set(guide.data.character, (guideCount.get(guide.data.character) ?? 0) + 1);
  }

  const teamCount = new Map<string, number>();
  for (const team of teams) {
    teamCount.set(team.data.coreCharacter, (teamCount.get(team.data.coreCharacter) ?? 0) + 1);
  }

  return [...names]
    .sort(collator.compare)
    .map((name) => ({
      name,
      guideCount: guideCount.get(name) ?? 0,
      teamCount: teamCount.get(name) ?? 0,
      path: characterPath(name),
    }));
}

/** 某个角色的攻略（角色页主区块）。 */
export function guidesOfCharacter(guides: Guide[], name: string): Guide[] {
  return sortGuides(guides.filter((guide) => guide.data.character === name));
}

/**
 * 以某角色为核心的配队（角色页"相关配队"区块）。
 * 只按 coreCharacter 关联，成员列表不参与匹配，避免出现"只是路过"的配队。
 */
export function teamsOfCharacter(teams: Team[], name: string): Team[] {
  return sortTeams(teams.filter((team) => team.data.coreCharacter === name));
}

export function latestGuides(guides: Guide[], limit: number): Guide[] {
  return sortGuides(guides).slice(0, limit);
}

export function latestTeams(teams: Team[], limit: number): Team[] {
  return sortTeams(teams).slice(0, limit);
}

export interface TeamGroup {
  element: string;
  teams: Team[];
}

/**
 * 配队列表页按 element 分组。
 * 分组顺序：队伍多的体系在前，其次按中文名排序；组内按日期倒序。
 * 注意：tier 不参与任何排序。
 */
export function groupTeamsByElement(teams: Team[]): TeamGroup[] {
  const groups = new Map<string, Team[]>();

  for (const team of teams) {
    const element = team.data.element || '未分类';
    const list = groups.get(element) ?? [];
    list.push(team);
    groups.set(element, list);
  }

  return [...groups.entries()]
    .map(([element, list]) => ({ element, teams: sortTeams(list) }))
    .sort((a, b) => b.teams.length - a.teams.length || collator.compare(a.element, b.element));
}

/** 展示用的日期格式：2026-11-10 */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return '';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** 主C 视觉突出：定位里带"主"字即可，兼容"主C"、"主 C"、"主c" 等写法。 */
export function isMainRole(role: string): boolean {
  return /主\s*[cC]/.test(role);
}
