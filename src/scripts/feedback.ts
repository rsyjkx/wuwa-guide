/**
 * 反馈窗口逻辑：
 *   · 打开时自动填入当前页面地址
 *   · 把内容拼成 Markdown，附带浏览器 / 视口 / 时间等环境信息
 *   · "在 GitHub 提交" → 打开带预填参数的 new issue 链接
 *   · "复制反馈内容" → 写剪贴板，给没有 GitHub 账号的人用
 */

const dialog = document.querySelector<HTMLDialogElement>('[data-feedback]');
const form = dialog?.querySelector<HTMLFormElement>('[data-feedback-form]');

if (dialog && form) {
  const pageInput = form.querySelector<HTMLInputElement>('[data-feedback-page]');
  const kindSelect = form.querySelector<HTMLSelectElement>('[data-feedback-kind]');
  const description = form.querySelector<HTMLTextAreaElement>('textarea');
  const imageInput = form.querySelector<HTMLInputElement>('[data-feedback-image]');
  const contactInput = form.querySelector<HTMLInputElement>('[data-feedback-contact]');
  const status = form.querySelector<HTMLElement>('[data-feedback-status]');
  const submitButton = form.querySelector<HTMLButtonElement>('[data-feedback-submit]');
  const copyButton = form.querySelector<HTMLButtonElement>('[data-feedback-copy]');

  const issueBase = dialog.dataset.issueBase ?? '';
  const labels = dialog.dataset.labels ?? '';

  const showStatus = (message: string, tone: 'ok' | 'error' | 'warn'): void => {
    if (!status) return;
    status.hidden = false;
    status.className = `notice notice--${tone}`;
    status.textContent = message;
  };

  const buildBody = (): string => {
    const kind = kindSelect?.value ?? '信息错误';
    const page = pageInput?.value.trim() ?? location.href;
    const text = description?.value.trim() ?? '';
    const image = imageInput?.value.trim() ?? '';
    const contact = contactInput?.value.trim() ?? '';

    const lines = [
      `### 问题类型`,
      kind,
      '',
      `### 相关页面`,
      page,
      '',
      `### 哪里不对`,
      text || '（未填写）',
      '',
    ];

    if (image) lines.push('### 截图', image, '');
    if (contact) lines.push('### 联系方式', contact, '');

    lines.push(
      '### 环境',
      `- 浏览器：${navigator.userAgent}`,
      `- 视口：${window.innerWidth} × ${window.innerHeight}`,
      `- 时间：${new Date().toISOString()}`,
    );

    return lines.join('\n');
  };

  const buildIssueUrl = (): string => {
    if (!issueBase) return '';
    const kind = kindSelect?.value ?? '信息错误';
    const title = `[内容纠错] ${kind}：${description?.value.trim().slice(0, 50) || '站点内容问题'}`;
    const params = new URLSearchParams({ title, body: buildBody() });
    if (labels) params.set('labels', labels);
    return `${issueBase}?${params.toString()}`;
  };

  const openDialog = (): void => {
    if (pageInput) pageInput.value = location.href;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    description?.focus();
  };

  const closeDialog = (): void => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  };

  document.querySelectorAll('[data-feedback-open]').forEach((trigger) => {
    trigger.addEventListener('click', openDialog);
  });

  dialog.querySelector('[data-feedback-close]')?.addEventListener('click', closeDialog);

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!description?.value.trim()) {
      showStatus('请先填写「哪里不对」。', 'error');
      description?.focus();
      return;
    }

    const url = buildIssueUrl();
    if (!url) {
      showStatus('仓库地址还没配置，暂时只能用"复制反馈内容"。', 'warn');
      return;
    }

    window.open(url, '_blank', 'noopener');
    showStatus('已在新标签页打开 GitHub Issues，确认后点 Submit 即可。', 'ok');
  });

  copyButton?.addEventListener('click', async () => {
    if (!description?.value.trim()) {
      showStatus('请先填写「哪里不对」。', 'error');
      description?.focus();
      return;
    }

    const text = buildBody();
    try {
      await navigator.clipboard.writeText(text);
      showStatus('反馈内容已复制，可以粘贴到 QQ 群 / 邮件 / Issue 里。', 'ok');
    } catch {
      // 剪贴板 API 不可用（http 或旧浏览器）时退化成选中文本
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.append(helper);
      helper.select();
      const ok = document.execCommand('copy');
      helper.remove();
      showStatus(ok ? '反馈内容已复制。' : '复制失败，请手动选中内容复制。', ok ? 'ok' : 'error');
    }
  });

  if (!issueBase && submitButton) submitButton.hidden = true;
}

export {};
