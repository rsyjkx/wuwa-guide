# 上线操作简章（账号绑定部分）

从零到线上站点，**大约 25–40 分钟**。最少只需要 **GitHub 一个账号**（Staticman 公共实例免注册）；Cloudflare 可选——打不开就用第 5B 节的 GitHub Pages 方案。

```
GitHub 仓库  ←── Staticman（把表单变成 PR）←── 访客填表
     │
     └──→ Cloudflare Pages（构建 + 托管）──→ 你的站点
```

每一步都有「成功的样子」，卡住就看最后一节。

---

## 0. 准备

| 需要 | 说明 |
| --- | --- |
| GitHub 账号 | 免费注册：https://github.com/signup |
| Cloudflare 账号 | 免费注册：https://dash.cloudflare.com/sign-up |
| Node.js 22+ | 本机执行 `node -v` 检查；没有就装 https://nodejs.org |
| git（可选） | 没有也能上传代码，见第 3 步方案 B |

---

## 1. 建 GitHub 仓库（约 3 分钟）

1. 打开 https://github.com/new
2. **Repository name**：`wuwa-guide`（可以换，记住它）
3. 选 **Public**（公共仓库的 Actions 额度更宽松）
4. **不要**勾选 "Add a README file" / ".gitignore"（避免和本地文件冲突）
5. 点 **Create repository**

✅ 成功的样子：能看到 `https://github.com/<你的用户名>/<仓库名>` 这个空仓库页面。

---

## 2. 写入仓库信息（约 1 分钟）

在项目根目录执行：

```bash
npm install
npm run setup -- --user <你的GitHub用户名> --repo <仓库名>
npm run build
```

`--site` 可以先不填，等第 5 步拿到 Cloudflare 域名后再补：

```bash
npm run setup -- --user <你的用户名> --repo <仓库名> --site https://你的域名
```

这条命令会改三个地方：`src/config.ts` 的仓库坐标、`astro.config.mjs` 的站点地址、`.github/CODEOWNERS` 的审批人。

✅ 成功的样子：`npm run build` 最后输出 `Indexed N pages / 2 filters`，没有红色报错。

---

## 3. 把代码传到 GitHub（约 3 分钟，二选一）

### 方案 A：本机有 git

```bash
git init -b main
git add .
git commit -m "init: 鸣潮攻略站"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 方案 B：本机没有 git

用 **GitHub Desktop**：https://desktop.github.com → File → Add local repository → 选项目目录 → Publish repository（勾 Public）。

或者用网页：仓库页 → **Add file → Upload files** → 把项目文件夹拖进去。⚠️ 网页上传会连 `node_modules/`、`dist/` 一起传，请先删掉这两个目录，或者只传源码文件。

✅ 成功的样子：仓库首页能看到 `package.json`、`staticman.yml`、`src/` 等文件。

---

## 4. 让 Staticman 有权限（约 5 分钟，**最关键**）

Staticman 是"把表单变成 PR"的那个机器人，它需要你仓库的写权限。

**4.1 加协作者**

1. 打开 `https://github.com/<你的用户名>/<仓库名>/settings/access`
2. 点 **Add people**
3. 输入 **`staticmanapp`** → 选择 → 权限选 **Write** → 发送邀请
4. 这个账号会自动接受

**4.2 完成实例授权**

用浏览器打开（把两处换成你的）：

```
https://best.staticman.net/v2/connect/<你的用户名>/<仓库名>
```

- 看到成功页 = 完成
- 如果提示要安装 GitHub App：按页面提示把 Staticman 的 App 安装到你这个仓库，效果一样

> 为什么不是 `api.staticman.net`？那个域名已经无法解析了，官方公共实例现在叫 `best.staticman.net`，接口协议完全一致。项目默认就用它，改的话只改 `src/config.ts` 里 `STATICMAN.endpoint` 一行。

✅ 成功的样子：Settings → Collaborators 列表里能看到 `staticmanapp`；`/v2/connect/...` 页面没有报错。

---

## 5A. Cloudflare Pages 部署（可选，约 8 分钟）

1. 打开 https://dash.cloudflare.com → 左侧 **Workers & Pages**
2. **Create** → **Pages** → **Connect to Git**
3. 授权 GitHub，选中你的仓库，分支选 **main**
4. 构建设置填：

   | 项 | 值 |
   | --- | --- |
   | Framework preset | Astro（选 None 也行） |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

5. **Save and Deploy**，等 1–2 分钟

✅ 成功的样子：拿到 `https://<项目名>.pages.dev`，打开能看到首页、搜索页有结果。

**拿到域名后回到第 2 步补一次 `--site`**，再提交推送，canonical 才是对的：

```bash
npm run setup -- --user <你> --repo <仓库> --site https://<项目名>.pages.dev
```

> 打不开 Cloudflare（国内常见）？跳到 **5B**，用 GitHub Pages，不需要任何新账号。

---

## 5B. GitHub Pages 部署（打不开 Cloudflare 时用，零新账号、约 5 分钟）

只要仓库是 **Public**，GitHub 自带静态托管，完全免费、国内通常能打开。

1. 仓库 → **Settings** → **Pages**
2. **Build and deployment → Source** 选 **GitHub Actions**（不要选 "Deploy from a branch"）
3. 推一次代码（或在 Actions 页手动点 **deploy-pages → Run workflow**）
4. 等 1–2 分钟，Pages 设置页会显示站点地址：

   | 仓库名 | 站点地址 | BASE_PATH |
   | --- | --- | --- |
   | `<你的用户名>.github.io` | `https://<你的用户名>.github.io/` | 根路径（自动） |
   | 其它（如 `wuwa-guide`） | `https://<你的用户名>.github.io/wuwa-guide/` | `/wuwa-guide/`（自动） |

   工作流 `.github/workflows/deploy-pages.yml` 会自己算好 `BASE_PATH`，**你不用手改**。

5. 回到第 2 步把站点地址写进配置，再推一次：

   ```bash
   npm run setup -- --user <你> --repo <仓库> --site https://<你的用户名>.github.io/wuwa-guide/
   ```

6. 打开站点，确认首页、配队、搜索都能用

> 说明：GitHub Pages 只是"托管"换了地方，投稿/审核流程完全不变 —— 还是 Staticman 开 PR、你批准合并、Actions 重新构建发布。
> 想要自定义域名也行：Settings → Pages → Custom domain（域名本身要自己买，不是免费的）。

**备选：Netlify Drop**（不想用 GitHub Actions 时）：本地 `npm run build` 后把 `dist` 文件夹拖到 https://app.netlify.com/drop ，10 秒得到一个网址。缺点是每次更新都要手动拖，不适合放 Staticman 的自动发布流程。

## 6. 开启审批（约 3 分钟）——只有你能批准

访客投稿 → Staticman 开 PR → **你批准 + 合并** → 自动发布。

### 方式 A：一条命令（推荐）

1. 生成 Token：GitHub → Settings → Developer settings → **Personal access tokens (classic)** → Generate new token → 勾 `repo` → 复制
2. 执行：

```powershell
$env:GH_TOKEN="ghp_你的token"
npm run protect -- --dry-run     # 先看要写入什么
npm run protect -- --apply       # 真正写入
```

### 方式 B：网页点选

仓库 → **Settings** → **Branches** → **Add branch protection rule**

- Branch name pattern：`main`
- ✅ Require a pull request before merging
- ✅ Require approvals → **1**
- ✅ Require review from Code Owners
- ✅ Dismiss stale pull request approvals
- ✅ Require status checks to pass → 勾 `build`、`review-gate`
- ❌ Allow force pushes / Allow deletions

✅ 成功的样子：随便开一个 PR，Merge 按钮是灰的，提示 "Review required"。

---

## 7. 走一遍完整验收（约 5 分钟）

1. 打开 `https://<你的域名>/submit/`，提交一条测试攻略（正文 ≥30 字）
2. GitHub → **Pull requests** 出现新 PR，作者是 `staticmanapp`；**main 分支没有新文件**
3. 打开 PR → **Files changed** → **Review changes** → **Approve** → **Merge pull request**
4. Cloudflare 自动重新构建（约 1–2 分钟）
5. 构建完成后：内容出现在列表 / 角色页，搜索页能搜到
6. 再提交一条，这次直接 **Close pull request**，确认线上没有变化

✅ 到这里账号绑定就全部完成，之后日常只需要：**看 PR → 批准 → 合并**。

---

## 常见卡点

| 现象 | 原因 / 处理 |
| --- | --- |
| 提交后页面报网络错误 | 公共实例挂了或限流，稍后重试；也可以直接在 GitHub 新建文件（提交页有链接） |
| 提示提交成功，但 GitHub 上没有 PR | ① 仓库名/分支和 `src/config.ts` 不一致 ② `staticmanapp` 没加成功 ③ 没做第 4.2 步的 connect 授权 |
| PR 里文件路径不对 | 检查 `staticman.yml` 的 `path`（应为 `src/content/guides` / `src/content/teams`） |
| Merge 按钮是灰的 | 分支保护生效，用**站长账号**点 Approve（GitHub 不允许批准自己开的 PR） |
| 批准不了自己开的 PR | GitHub 不允许自批。访客通过表单投稿时作者是 `staticmanapp`，你能正常批准；自己提的 PR 直接用仓库所有者权限合并 |
| Cloudflare 构建失败 | 看部署日志；本地 `npm run build` 能复现；多半是 frontmatter 不合 schema |
| 搜索搜不到新内容 | Pagefind 索引在构建时生成，等这次构建完成；确认 `/pagefind/pagefind-entry.json` 可访问 |
| 角色页 404 | 中文路径需要 URL 编码，站内链接已经处理好，手输链接要带 `%E4%BB%8A…` |
| GitHub Pages 打开是 404 / 样式全丢 | Pages 的 Source 要选 **GitHub Actions**；项目站点必须带 `/<repo>/` 前缀，工作流已自动处理，别手动改 `BASE_PATH` |

---

## 三个账号分别负责什么

| 账号 | 作用 | 是否必需 | 费用 |
| --- | --- | --- | --- |
| GitHub | 存内容、开 PR、你批准合并、Pages 托管 | **必需** | 免费 |
| Staticman 公共实例 | 把表单提交变成 PR | 必需（免注册） | 免费 |
| Cloudflare Pages | 另一种托管方式（大陆访问不稳） | 可选 | 免费（每月 500 次构建） |

合计 **0 元/月**。

---

## 附：日常维护只需要会两件事

1. **发内容**：访客走 `/submit/`，你批准并合并 PR。
2. **改页面**：改 Markdown / 组件后 push，Cloudflare 自动重建。

其余细节（字段规范、图片视频怎么放、搜索原理、备选方案、排错）都在 [README.md](README.md)。
