/**
 * 图集灯箱：用原生 <dialog>，支持 Esc 关闭、点遮罩关闭、点关闭按钮关闭。
 * 没有原生 dialog 的旧浏览器会退化成新标签页打开原图。
 */
for (const gallery of document.querySelectorAll<HTMLElement>('[data-gallery]')) {
  const dialog = gallery.querySelector<HTMLDialogElement>('dialog');
  const preview = gallery.querySelector<HTMLImageElement>('[data-lightbox-image]');
  if (!dialog || !preview) continue;

  const close = () => dialog.close();

  gallery.querySelectorAll<HTMLButtonElement>('[data-lightbox-src]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const src = trigger.dataset.lightboxSrc;
      if (!src) return;

      if (typeof dialog.showModal !== 'function') {
        window.open(src, '_blank', 'noopener');
        return;
      }

      preview.src = src;
      preview.alt = trigger.querySelector('img')?.alt ?? '';
      dialog.showModal();
    });
  });

  // 点遮罩关闭（dialog 自身区域是面板，点到 dialog 本身说明点在遮罩上）
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  dialog.querySelector('[data-lightbox-close]')?.addEventListener('click', close);

  dialog.addEventListener('close', () => {
    preview.removeAttribute('src');
  });
}

export {};
