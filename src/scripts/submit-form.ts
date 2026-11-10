/**
 * 投稿页的客户端增强（原生 JS，无框架）。
 *
 * 做四件事：
 *   1. 两个表单之间切换 tab（没有 JS 时两块表单都平铺显示）
 *   2. 配队表单的成员行增删，并在提交前重新编号 + 去掉空行
 *      —— Staticman 依赖 fields[members][0][name] 这种连续下标解析成数组
 *   3. 蜜罐字段有值时静默丢弃（服务端也会拒绝，这里只是少一次请求）
 *   4. 用 fetch 提交并显示结果（Staticman 已开 CORS；没有 JS 时表单会原生 POST）
 */

const MAX_MEMBERS = 8;

interface StaticmanResponse {
  success?: boolean;
  errorCode?: string;
  message?: string;
}

type Tone = 'ok' | 'error' | 'warn';

function memberRows(form: HTMLFormElement): HTMLElement[] {
  return [...form.querySelectorAll<HTMLElement>('[data-member-row]')];
}

/** 把成员行重新编号成 0..n-1，避免 qs 解析出稀疏数组 */
function renumberRows(form: HTMLFormElement): void {
  const rows = memberRows(form);
  rows.forEach((row, index) => {
    row.querySelectorAll<HTMLInputElement>('input[name^="fields[members]"]').forEach((input) => {
      input.name = input.name.replace(/fields\[members\]\[\d+\]/, `fields[members][${index}]`);
    });
  });

  const addButton = form.querySelector<HTMLButtonElement>('[data-add-row]');
  if (addButton) addButton.disabled = rows.length >= MAX_MEMBERS;
}

/** 提交前删掉"角色名 + 定位"都为空的整行 */
function pruneEmptyRows(form: HTMLFormElement): void {
  memberRows(form).forEach((row) => {
    const name = row.querySelector<HTMLInputElement>('[data-member-name]');
    const role = row.querySelector<HTMLInputElement>('[data-member-role]');
    if (!name?.value.trim() && !role?.value.trim()) row.remove();
  });
  renumberRows(form);
}

function setupMemberRows(form: HTMLFormElement): void {
  const container = form.querySelector<HTMLElement>('[data-member-rows]');
  if (!container) return;

  const template = document.querySelector<HTMLTemplateElement>('[data-member-template]');

  form.querySelector<HTMLButtonElement>('[data-add-row]')?.addEventListener('click', () => {
    if (memberRows(form).length >= MAX_MEMBERS || !template) return;
    const source = template.content.firstElementChild;
    if (!source) return;

    const row = source.cloneNode(true) as HTMLElement;
    container.append(row);
    renumberRows(form);
    row.querySelector<HTMLInputElement>('[data-member-name]')?.focus();
  });

  container.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('[data-remove-row]');
    if (!button) return;

    const rows = memberRows(form);
    if (rows.length <= 1) {
      // 至少留一行，只清空内容
      rows[0]?.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
        input.value = '';
      });
      return;
    }

    button.closest('[data-member-row]')?.remove();
    renumberRows(form);
  });

  renumberRows(form);
}

/**
 * 图片链接实时预览：粘贴封面 / 图集地址后立刻显示缩略图，
 * 免得用户提交完才发现链接是坏的。
 */
function setupMediaPreview(form: HTMLFormElement): void {
  const coverInput = form.querySelector<HTMLInputElement>('[data-media-cover]');
  const coverPreview = form.querySelector<HTMLElement>('[data-media-preview="cover"]');
  const imagesInput = form.querySelector<HTMLTextAreaElement>('textarea[name="fields[images]"]');
  const imagesPreview = form.querySelector<HTMLElement>('[data-media-preview="images"]');

  const render = (container: HTMLElement | null, sources: string[], limit: number): void => {
    if (!container) return;
    container.textContent = '';
    for (const source of sources.slice(0, limit)) {
      if (!/^(https?:\/\/|\/)/i.test(source)) continue;
      const image = document.createElement('img');
      image.src = source;
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      container.append(image);
    }
  };

  const refreshCover = (): void => {
    const value = coverInput?.value.trim() ?? '';
    render(coverPreview, value ? [value] : [], 1);
  };

  const refreshImages = (): void => {
    const sources = (imagesInput?.value ?? '')
      .split(/[\n,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
    render(imagesPreview, sources, 6);
  };

  coverInput?.addEventListener('input', refreshCover);
  imagesInput?.addEventListener('input', refreshImages);
  refreshCover();
  refreshImages();
}

function setupTabs(): void {  const root = document.querySelector<HTMLElement>('[data-tabs]');
  if (!root) return;

  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-panel]')];
  const nav = root.querySelector<HTMLElement>('[data-tabs-nav]');
  if (buttons.length === 0 || panels.length === 0) return;

  // 只有在 JS 可用时才启用 tab 视图
  if (nav) nav.hidden = false;

  const select = (kind: string): void => {
    buttons.forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.tab === kind));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== kind;
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => select(button.dataset.tab ?? 'guides'));
  });

  select(buttons[0]?.dataset.tab ?? 'guides');
}

function showStatus(form: HTMLFormElement, message: string, tone: Tone): void {
  const status = form.querySelector<HTMLElement>('[data-status]');
  if (!status) return;
  status.hidden = false;
  status.className = `notice notice--${tone}`;
  status.textContent = message;
}

function errorMessage(payload: StaticmanResponse | null): string {
  const code = payload?.errorCode;
  if (code === 'MISSING_REQUIRED_FIELDS' || code === 'MISSING_REQUIRED_FIELD') {
    return '提交失败：有必填项没填（标题、角色、正文等）。';
  }
  if (code === 'INVALID_FIELDS') {
    return '提交失败：表单里包含了不被接受的字段，请刷新页面后重试。';
  }
  if (payload?.message) return `提交失败：${payload.message}`;
  return '提交失败：Staticman 返回了错误，请稍后重试，或直接到 GitHub 提 PR。';
}

async function submitForm(form: HTMLFormElement): Promise<void> {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const honeypot = form.querySelector<HTMLInputElement>('[data-honeypot]');

  // 蜜罐有值 = 大概率是机器人，静默丢弃
  if (honeypot?.value.trim()) {
    form.reset();
    return;
  }

  pruneEmptyRows(form);

  if (button) {
    button.dataset.label = button.textContent ?? '提交审核';
    button.disabled = true;
    button.textContent = '提交中…';
  }

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    });
    const payload = (await response.json().catch(() => null)) as StaticmanResponse | null;

    if (response.ok && payload?.success) {
      showStatus(
        form,
        '提交成功！已在仓库里创建待审核的 Pull Request，站长合并后会自动发布；合并后还需要等一次构建完成，内容才会出现在搜索里。',
        'ok',
      );
      form.reset();
      renumberRows(form);
      return;
    }

    showStatus(form, errorMessage(payload), 'error');
  } catch {
    showStatus(
      form,
      '无法连接投稿服务（可能是 Staticman 公共实例暂时不可用）。请稍后重试，或直接到 GitHub 仓库提 PR。',
      'error',
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.label || '提交审核';
    }
  }
}

setupTabs();

document.querySelectorAll<HTMLFormElement>('form[data-staticman]').forEach((form) => {
  setupMemberRows(form);
  setupMediaPreview(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitForm(form);
  });
});

export {};
