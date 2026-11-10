import { withBase } from '../lib/urls';
/**
 * 搜索页：dev 模式下没有 dist/pagefind 索引，探测一下并给出提示，
 * 避免用户输入关键词却什么也没发生。
 */
const notice = document.querySelector<HTMLElement>('[data-pagefind-missing]');

function showNotice(): void {
  if (notice) notice.hidden = false;
}

fetch(withBase('/pagefind/pagefind-entry.json'), { method: 'HEAD' })
  .then((response) => {
    if (!response.ok) showNotice();
  })
  .catch(showNotice);

export {};
