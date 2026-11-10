/**
 * 视频地址解析。
 *
 * 不引入任何播放器库：
 *   · B 站 / YouTube → 官方 iframe 嵌入（懒加载）
 *   · .mp4 / .webm / .ogv 直链 → 原生 <video>
 *   · 其它链接 → 降级成一个外链按钮，绝不让脏 URL 进 iframe
 */

export type VideoEmbed =
  | { kind: 'bilibili'; src: string }
  | { kind: 'youtube'; src: string }
  | { kind: 'file'; src: string }
  | { kind: 'link'; src: string };

const BILIBILI_BV = /bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i;
const BILIBILI_AV = /bilibili\.com\/video\/av(\d+)/i;
const YOUTUBE_ID = [
  /youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/i,
  /youtu\.be\/([\w-]{6,})/i,
  /youtube\.com\/embed\/([\w-]{6,})/i,
  /youtube\.com\/shorts\/([\w-]{6,})/i,
];

export function parseVideo(url: string | undefined): VideoEmbed | null {
  if (!url) return null;
  const value = url.trim();
  if (!/^https?:\/\//i.test(value)) return null;

  const bv = BILIBILI_BV.exec(value);
  if (bv) {
    return {
      kind: 'bilibili',
      src: `https://player.bilibili.com/player.html?bvid=${bv[1]}&page=1&high_quality=1&autoplay=0`,
    };
  }

  const av = BILIBILI_AV.exec(value);
  if (av) {
    return {
      kind: 'bilibili',
      src: `https://player.bilibili.com/player.html?aid=${av[1]}&page=1&high_quality=1&autoplay=0`,
    };
  }

  for (const pattern of YOUTUBE_ID) {
    const match = pattern.exec(value);
    if (match) {
      return { kind: 'youtube', src: `https://www.youtube.com/embed/${match[1]}` };
    }
  }

  if (/\.(mp4|webm|ogv|ogg)(\?.*)?$/i.test(value)) {
    return { kind: 'file', src: value };
  }

  return { kind: 'link', src: value };
}

/** 视频来源的中文说明，用于详情页小标题 */
export function videoLabel(embed: VideoEmbed): string {
  switch (embed.kind) {
    case 'bilibili':
      return '哔哩哔哩';
    case 'youtube':
      return 'YouTube';
    case 'file':
      return '视频';
    default:
      return '外部视频';
  }
}
