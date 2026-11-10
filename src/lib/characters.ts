import type { CollectionEntry } from 'astro:content';
import { withBase } from './urls';

export type Team = CollectionEntry<'teams'>;

export interface CharacterSummary {
  /** 角色名（也是角色页的路径参数） */
  name: string;
  /** 以该角色为核心的配队数（按 coreCharacter 统计） */
  teamCount: number;
  /** 角色页地址 */
  path: string;
}

/** 角色页地址。路径参数用原始中文名，href 里做一次 URL 编码。 */
export function characterPath(name: string): string {
  return withBase(`characters/${encodeURIComponent(name)}/`);
}

export function teamPath(team: Team): string {
  return withBase(`teams/${team.id}/`);
}

const collator = new Intl.Collator('zh-CN');

function timeOf(date: Date | undefined): number {
  return date ? new Date(date).getTime() : 0;
}

/** 配队按日期倒序；tier 只展示，不参与排序。 */
export function sortTeams(list: Team[]): Team[] {
  return [...list].sort(
    (a, b) => timeOf(b.data.date) - timeOf(a.data.date) || collator.compare(a.data.teamName, b.data.teamName),
  );
}

/** 所有出现过的角色：配队核心角色 + 配队成员。 */
export function allCharacters(teams: Team[]): CharacterSummary[] {
  const names = new Set<string>();
  for (const team of teams) {
    names.add(team.data.coreCharacter);
    for (const member of team.data.members) names.add(member.name);
    for (const member of team.data.buildMembers ?? []) if (member.character) names.add(member.character);
  }

  const teamCount = new Map<string, number>();
  for (const team of teams) {
    teamCount.set(team.data.coreCharacter, (teamCount.get(team.data.coreCharacter) ?? 0) + 1);
  }

  return [...names]
    .sort(collator.compare)
    .map((name) => ({
      name,
      teamCount: teamCount.get(name) ?? 0,
      path: characterPath(name),
    }));
}

/** 以某角色为核心的配队。只按 coreCharacter 关联，避免"只是路过"的配队。 */
export function teamsOfCharacter(teams: Team[], name: string): Team[] {
  return sortTeams(teams.filter((team) => team.data.coreCharacter === name));
}

export function latestTeams(teams: Team[], limit: number): Team[] {
  return sortTeams(teams).slice(0, limit);
}

export interface TeamGroup {
  element: string;
  teams: Team[];
}

/** 配队列表页按 element 分组：多的在前，组内按日期倒序。 */
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

/** 主C 视觉突出：定位里带"主"字即可。 */
export function isMainRole(role: string): boolean {
  return /主\s*[cC]/.test(role);
}
