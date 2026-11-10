# 鸣潮攻略站（Astro + Staticman + Pagefind + Cloudflare Pages）

一个**纯静态**的《鸣潮》攻略站：单角色攻略 + 配队推荐，支持按角色筛选和全文搜索，游客可以投稿，投稿必须经过站长审核（合并 Pull Request）才会发布。

- 没有数据库、没有后端 API、没有登录系统、没有常驻服务器
- GitHub 仓库是唯一数据源和部署源
- 运营成本：**0 元/月**（Cloudflare Pages 免费套餐 + GitHub 公共仓库 + 静态搜索）

> **只想照着步骤做？** 看 [SETUP.md](SETUP.md)（账号绑定 + 部署 + 审批，约 30 分钟，每步都有"成功的样子"）。本文是完整参考手册。

---

## 1. 数据流

```
游客填表
  │  POST fields[...]（含蜜罐字段）
  ▼
Staticman v2 公共实例  ── 校验 allowedFields / requiredFields / 蜜罐
  │  在仓库里新建 src/content/guides/guide-<时间戳>.md
  │  因为 moderation: true，只创建 Pull Request
  ▼
站长在 GitHub 审阅 PR  ── 合并（= 发布）/ 关闭（= 拒绝）
  │  main 分支变动
  ▼
Cloudflare Pages 自动构建
  │  astro build  → dist/
  │  pagefind --site dist  → dist/pagefind/ 索引
  ▼
新攻略 / 新配队上线，并可被搜索到
```

关键点：**内容只存在于 Git 仓库里**。合并前的内容在 PR 分支上，主分支和网站都看不到。

---

## 2. 技术栈与版本

| 层 | 选择 | 版本 |
| --- | --- | --- |
| 框架 | Astro（静态输出，无 adapter） | `6.4.8`（配 Vite 7） |
| 语言 | TypeScript（strict） | 5.x |
| 样式 | 纯 CSS（CSS 变量 + Grid/Flex，无 UI 框架） | — |
| 内容 | Markdown + Content Collections（glob loader + Zod 校验） | — |
| 投稿 | Staticman v2 公共实例（PR 审核模式） | v2 |
| 搜索 | Pagefind（组件 UI `pagefind-component-ui.js`） | `1.6.0` |
| 托管 | Cloudflare Pages（Git 集成自动构建），备选 GitHub Pages | — |

> **关于 Astro 版本**：`package.json` 里锁定了 `astro@6.4.8`（Vite 7）。Astro 7 / Vite 8 在构建阶段引入的 module runner 会把 `yaml`、`picomatch` 这类 CommonJS 依赖当作 ESM 执行，导致 `astro sync` 直接报 `require is not defined`（本次搭建时实测复现）。升级前请先本地跑通 `npm run build`，确认这个兼容问题已经修复，再改版本号。

---

## 3. 目录结构

```
.
├─ astro.config.mjs          # 静态输出、目录式 URL、站点 site
├─ SETUP.md                  # ★ 操作简章：账号绑定 → 部署 → 审批
├─ package.json              # dev / build / preview / check / check:forms
├─ staticman.yml             # guides / teams 两段投稿配置（moderation: true）
├─ tsconfig.json
├─ .nvmrc                    # 22（Cloudflare Pages 读它决定 Node 版本）
├─ .github/
│  ├─ CODEOWNERS             # 谁能批准（只有站长）
│  └─ workflows/
│     ├─ validate.yml        # PR 上跑构建，坏数据合并前就红
│     ├─ review-gate.yml     # 站长没批准就显示 ✗
│     └─ deploy-pages.yml    # GitHub Pages 部署（Cloudflare 的备选）
├─ public/
│  ├─ favicon.svg
│  └─ robots.txt
├─ scripts/
│  ├─ build.mjs              # astro build + pagefind（支持 BASE_PATH）
│  ├─ check-forms.mjs        # 表单字段 ↔ staticman.yml 一致性检查
│  ├─ setup.mjs              # 写入仓库名 / 站点地址 / CODEOWNERS
│  ├─ simulate-submission.mjs # 本地模拟 Staticman 投稿（验证合并后的链路）
│  └─ apply-branch-protection.mjs # 配置 main 分支保护（单人批准 + 检查通过）
└─ src/
   ├─ config.ts              # ★ 部署前唯一需要改的文件（仓库名 / 实例地址）
   ├─ content.config.ts      # guides / teams 的 Zod schema
   ├─ lib/characters.ts      # 角色聚合、路径、排序、coreCharacter 关联
   ├─ styles/global.css
   ├─ lib/media.ts           # 视频地址解析（B 站 / YouTube / mp4）
   ├─ components/            # BaseLayout SiteHeader SiteFooter GuideCard TeamCard MemberList
   │                        # Gallery（图集+灯箱） VideoEmbed（B站/YouTube 嵌入） FeedbackDialog（内容纠错）
   ├─ content/
   │  ├─ guides/*.md         # 3 篇示例攻略
   │  └─ teams/*.md          # 3 支示例配队
   └─ pages/
      ├─ index.astro            # 首页：角色网格 + 最新攻略/配队
      ├─ guides/index.astro     # 全部攻略
      ├─ guides/[slug].astro    # 攻略详情（Pagefind 索引页）
      ├─ characters/index.astro # 全部角色
      ├─ characters/[character].astro  # 角色页：该角色攻略 + 相关配队
      ├─ teams/index.astro      # 配队列表（按体系分组）
      ├─ teams/[slug].astro     # 配队详情（成员构成 + 正文）
      ├─ submit.astro           # 双表单投稿页
      ├─ search.astro           # Pagefind 搜索页
      └─ 404.astro
```

---

## 4. 本地开发

要求 Node ≥ 22.12.0（`.nvmrc` 写的是 22）。

```bash
npm install
npm run dev        # http://localhost:4321
```

构建与预览（**搜索功能必须走这一步**）：

```bash
npm run build      # 等价于：astro build && pagefind --site dist
npm run preview    # 预览 dist/，含 Pagefind 索引
```

> `build` 脚本用的是 `devDependencies` 里的 `pagefind` 可执行文件（不需要联网再 `npx` 下载）。如果你更习惯官方写法，把脚本换成 `astro build && npx pagefind --site dist` 效果一致。

其他脚本：

```bash
npm run check        # astro check（TypeScript / .astro 类型检查）
npm run check:forms  # 表单字段与 staticman.yml 是否一致
npm run setup        # 写入仓库名 / 站点地址（--user --repo --site）
npm run simulate     # 本地模拟一次 Staticman 投稿，然后 npm run build 看效果
npm run protect      # 配置 main 分支保护（--dry-run 预览，--apply 写入）
```

> `npm run dev` 下搜索框**没有结果**是正常的：`dist/pagefind/` 索引只在构建后生成，dev 服务器不产出它。搜索页会显示提示。想看真实搜索效果请用 `npm run build && npm run preview`。

---

## 5. 部署步骤

### 5.1 创建 GitHub 仓库并推送

```bash
git init -b main
git add .
git commit -m "init: 鸣潮攻略站"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

仓库可以是 public（Actions 免费额度更宽松）；branch 默认用 `main`。

### 5.2 写入仓库信息

一条命令搞定（含 `src/config.ts`、`astro.config.mjs` 和 `.github/CODEOWNERS`）：

```bash
npm run setup -- --user <你的GitHub用户名> --repo <仓库名> --site https://你的域名
```

也可以手动改 `src/config.ts` 里的 `STATICMAN`（username / repository / branch），
以及 `astro.config.mjs` 里的 `site`（用于 canonical）。

改完提交推送，`/submit/` 页顶部的"占位符未替换"警告会消失。

> **关于实例地址**：项目最初按 `https://api.staticman.net/v2/entry/` 设计，但该域名目前**已无法解析**（DNS 查不到）。官方公共实例迁移到了 **`https://best.staticman.net`**，v2 的 URL 结构和字段协议完全一致（`/v2/entry/:user/:repo/:branch/:property`）。所以这里默认用 `best.staticman.net`。如果以后官方换域名，只需改 `STATICMAN.endpoint` 这一行。

### 5.3 给 Staticman 授权（v2 模式：加协作者）

1. 打开 `https://github.com/<你的用户名>/<仓库名>/settings/access` → **Add people**。
2. 添加用户 **`staticmanapp`**，权限选 **Write**（Staticman 需要能建分支、开 PR）。
3. 浏览器访问连接 URL 完成握手（把用户名/仓库名换成你的）：

   ```
   https://best.staticman.net/v2/connect/<用户名>/<仓库名>
   ```

   看到成功提示即可。这一步是让实例记住它对这个仓库的授权。

> 如果该实例改成了 GitHub App 模式（部分部署会这样配置），按实例首页提示把它的 App **安装到你的仓库**，效果等价：Staticman 拿到写入权限。两种方式都不需要付费。

### 5.4 Cloudflare Pages 连接仓库

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
2. 选择仓库和 `main` 分支。
3. 构建配置：

   | 项 | 值 |
   | --- | --- |
   | Framework preset | Astro（或 None，不影响） |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node version | 由 `.nvmrc` 决定（也可加环境变量 `NODE_VERSION=22`） |

4. 保存并部署。首次构建会执行 `astro build` + `pagefind --site dist`，产物里包含 `dist/pagefind/`。
5. 之后每次 `main` 有新的 commit（包括你合并的投稿 PR），Cloudflare 都会自动重新构建。

> **打不开 Cloudflare 怎么办？** 中国大陆网络经常访问不了 dash.cloudflare.com。可以直接换用 **GitHub Pages**（仓库 Public 即可，零新账号）：
> 仓库 Settings → Pages → Source 选 **GitHub Actions**，推一次代码，`.github/workflows/deploy-pages.yml` 会自动构建部署到 `https://<user>.github.io/<repo>/`。
> 项目站点的子路径前缀（`BASE_PATH=/<repo>/`）工作流会自己算，不用手改。详细步骤见 [SETUP.md](SETUP.md) 第 5B 节。

不需要任何环境变量、密钥或付费插件。

### 5.5 测试投稿与审核流程

1. 打开线上站点的 `/submit/`。
2. 填"单角色攻略"表单并提交（正文至少 30 字）。
3. 期望结果：页面提示提交成功；**GitHub 仓库里出现一个新的 Pull Request**，其中新增 `src/content/guides/guide-<时间戳>.md`；**主分支没有任何新文件**。
4. 在 PR 里点 **Files changed**，确认 frontmatter 和正文正确；此时 Actions 的 `validate` 会跑一次构建，schema 不合规会直接红。
5. 合并 PR → Cloudflare 触发一次新构建 → 构建完成后攻略出现在 `/guides/`、对应角色页，并且能被搜索到。
6. 关闭 PR 则不发布，文件不会进入主分支。
7. 配队表单同理，生成 `src/content/teams/team-<时间戳>.md`，frontmatter 里 `members` 是对象数组。

可选：用 curl 直接验证实例是否愿意接收（会真的建 PR，测完记得关掉）：

```bash
curl -X POST "https://best.staticman.net/v2/entry/<用户名>/<仓库名>/main/guides" \
  -H "Accept: application/json" \
  --data-urlencode "fields[title]=接口测试" \
  --data-urlencode "fields[character]=今汐" \
  --data-urlencode "fields[content]=这是一条接口测试内容，请忽略。"
```

### 5.6 让 URL 更好看（可选）

Staticman 用时间戳命名文件，所以新投稿的详情页是 `/guides/guide-1783…/`。在合并前于 PR 里把文件重命名成有意义的 slug（例如 `jinhsi-rotation-2-4.md`），URL 就变成 `/guides/jinhsi-rotation-2-4/`。文件名就是 slug，不需要改任何代码。

---

## 6. 内容规范

### 6.1 单角色攻略 `src/content/guides/*.md`

```markdown
---
title: 今汐 2.4 版本输出手法与共鸣链选择
character: 今汐
author: 洄游的鲸          # 可选
date: 2026-10-28
tags: [输出手法, 共鸣链]  # 可选，数组或逗号分隔字符串都行
version: '2.4'            # 可选
---

正文（Markdown）。
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | ✅ | 攻略标题 |
| `character` | ✅ | 角色名，角色页按它筛选 |
| `date` | ✅ | 日期；表单投稿时由 Staticman 自动写入 |
| `author` | — | 作者昵称 |
| `tags` | — | 标签数组 |
| `version` | — | 适用游戏版本 |

### 6.2 配队推荐 `src/content/teams/*.md`

```markdown
---
teamName: 今汐聚爆速切队
coreCharacter: 今汐
members:
  - name: 今汐
    role: 主C
  - name: 长离
    role: 副C
  - name: 维里奈
    role: 治疗
element: 聚爆
tier: T0.5                 # 可选，仅展示
scenario: [逆境深塔, 冥歌海墟]
summary: 双爆发核互相接轴，深渊与海墟通用。   # 可选
---

配队思路、输出轴、注意事项……
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `teamName` | ✅ | 配队名称 |
| `coreCharacter` | ✅ | 核心角色，角色页"相关配队"按它匹配 |
| `members` | ✅ | **对象数组**，每项含 `name` + `role` |
| `element` | ✅ | 体系 / 属性标签，配队列表按它分组 |
| `scenario` | — | 适用场景数组 |
| `tier` | — | 强度分级，**只展示，不参与排序** |
| `summary` | — | 一句话说明 |

`members` 必须是对象数组，下面这种写法会**直接构建失败**：

```yaml
members: ["今汐", "长离"]        # ✗ 纯字符串数组
```

### 6.3 约定

- 文件名（去掉 `.md`）= URL slug，例如 `jiyan-aero.md` → `/teams/jiyan-aero/`。
- 角色页由"攻略角色 ∪ 配队核心角色 ∪ 配队成员"自动生成，新增角色不需要改代码。
- `tier` 只在卡片/详情页显示；配队列表按 `element` 分组、组内按日期倒序。
- 正文里的图片用外链（本仓库没有图片上传通道）。

---

### 6.4 图片与视频

Staticman 只能写文本字段，**不能上传文件**；Git 仓库也不适合放视频。所以媒体统一走"链接"：

| 形式 | 怎么写 | 页面效果 |
| --- | --- | --- |
| 封面 `cover` | `/media/cover.png` 或 `https://…` | 卡片缩略图 + 详情页顶部大图 |
| 图集 `images` | `[链接, 链接]`（表单里一行一个，最多 12 张） | 缩略图网格，点开是灯箱大图 |
| 视频 `video` | B 站 / YouTube 链接，或 `.mp4` 直链 | 自动嵌入播放器；不认识的链接降级成按钮 |

地址只接受 `http(s)://` 外链或以 `/` 开头的站内路径，`javascript:` / `data:` 会被 schema 直接拒绝（防止把用户输入塞进 `<img src>` / `<iframe src>`）。

**图片放哪儿？三种都行：**

1. **仓库里的 `public/media/`（最稳）**：把图片放进该目录，写 `cover: /media/xxx.png`。贡献者可以在 GitHub 网页的文件编辑框里直接拖图上传。
2. **GitHub 附件**：在 Issue / PR 输入框里粘贴或拖入图片，GitHub 会生成 `https://github.com/user-attachments/assets/…` 链接，复制进表单即可。
3. **图床**：任何支持外链的图床都行，注意选稳定的服务并允许站外引用。

**视频为什么不能上传？** 视频动辄几十上百 MB，放进 Git 会撑爆仓库（单文件 100MB 上限，LFS 要额外配置）；免费静态托管也没有"直传视频"的通道。所以视频用 B 站 / YouTube 嵌入，带宽由平台承担，本站成本仍然是 0。

> 想要"点按钮直接上传文件"，需要额外的存储与写入通道（Cloudflare R2 + Pages Functions，或 GitHub API + Token）。这会引入后端函数和密钥，与"纯静态、无后端"的约束冲突，所以默认不做，取舍见第 10 节。

### 6.5 内容纠错窗口（右下角「内容纠错」）

每页右下角有个悬浮按钮，专门收两类问题：**信息错误**（数值 / 机制 / 描述写错）和**时效性不足**（版本过时、配队不再适用）。

- 打开后自动带上当前页面地址，填完拼成一段结构化 Markdown
- **在 GitHub 提交**：打开预填标题 / 正文 / 标签的 new issue 页面（需要 GitHub 账号）
- **复制反馈内容**：写进剪贴板，发给站长 / 群聊也行（适合没有 GitHub 账号的人）
- 不经过本站任何接口，没有数据库、没有后端，反馈只落在 GitHub Issues
- 默认标签 `content-error` + `feedback`，建议先在 Issues → Labels 里建好同名标签

想换成别的渠道（邮箱、QQ 群链接等），改 `src/components/FeedbackDialog.astro` 里的按钮即可，脚本逻辑在 `src/scripts/feedback.ts`。

## 7. 搜索是怎么工作的

- 构建后运行 `pagefind --site dist`，扫描 `dist/**/*.html` 生成 `dist/pagefind/`（纯静态文件 + wasm）。
- 只有**详情页**进索引：`guides/[slug].astro` 和 `teams/[slug].astro` 的正文容器带 `data-pagefind-body`；列表页 / 表单页 / 搜索页 / 404 在 `<body>` 上带 `data-pagefind-ignore`。
- 配队详情页里的**成员构成区块**带 `data-pagefind-ignore`，不进索引（成员名重复度高，会污染摘要）；筛选信息由"角色"和"体系"标签提供。
- 筛选项由属性生成：
  - 攻略页：`data-pagefind-filter="character"` → 搜索页"按角色筛选"
  - 配队页：`data-pagefind-filter="team-element"` → 搜索页"按配队体系筛选"
  - 配队页的核心角色同样带 `character` 筛选，所以按角色搜能同时命中攻略和配队
- 搜索页用 Pagefind 1.6 的**组件 UI**：`pagefind-input` + 两个 `pagefind-filter-dropdown` + `pagefind-summary` + `pagefind-results`，全部在浏览器本地完成，不请求任何第三方接口。
- **索引只在构建时生成**：新合并的投稿要等 Cloudflare 这次构建完成后才会出现在搜索里（通常 1–2 分钟）。这是设计如此，不是 bug。

---

## 8. 审核与防滥用

| 机制 | 实现 |
| --- | --- |
| 审核闸门 | `staticman.yml` 每个字段段都设 `moderation: true` → 只创建 PR，不写主分支 |
| 发布动作 | 你在 GitHub 上合并 PR；拒绝就关闭 PR |
| 字段白名单 | `allowedFields` 限定字段，多传非空字段 → `INVALID_FIELDS` |
| 必填校验 | `requiredFields` |
| 蜜罐 | 表单里有隐藏的 `fields[_honeypot]`，它**故意不在** `allowedFields` 里：正常用户留空 → 空值放行；机器人填了值 → Staticman 直接拒绝。前端 JS 也会静默丢弃。 |
| 长度限制 | 输入框 `required` / `minlength` / `maxlength`，正文上限 20000 字符 |
| 数据质量 | Zod schema 在构建时强校验，坏数据无法上线；`.github/workflows/validate.yml` 让 PR 阶段就变红 |
| 无账号体系 | 不收集邮箱、密码，不需要登录，也没有数据库 |

> Staticman v2 本身**没有**长度限制或内容审核配置项（服务端只有上面这些校验），所以长度控制只能靠 HTML 属性 + 你合并前的人工检查。需要更强的反垃圾可以给实例配 `reCaptcha` 或 `akismet`，但那属于实例侧配置，公共实例不开放。

---

### 8.1 发布审批：只有站长**一个人**能批准

审核动作就是"合并 PR"，所以"必须有人批准"直接用 GitHub 原生机制：

1. **CODEOWNERS**：`.github/CODEOWNERS` 里只有你（仓库所有者），`npm run setup -- --user 你的用户名 --repo 仓库名` 会自动生成。
2. **不需要再加别人**：审批人就是仓库所有者本人，`review-gate` 工作流直接按 `context.repo.owner` 判断，没有额外名单要维护。
3. **分支保护**：1 个批准 + 必须 Code Owner 批准 + `build` / `review-gate` 通过 + 禁止直接 push。
   - 网页：Settings → Rules / Branches → Add branch protection rule
   - 命令行：`$env:GH_TOKEN="ghp_…"; npm run protect -- --apply`（先跑 `--dry-run` 看载荷）
4. **review-gate 工作流**：即使分支保护被误改，PR 上也会因为缺少批准显示 ✗，不会悄悄合并。

| 设置 | 值 | 作用 |
| --- | --- | --- |
| Require a pull request before merging | ✅ | 不能直接推 main |
| Required approvals | **1** | 只有站长能批准，1 个批准即可合并 |
| Require review from Code Owners | ✅ | 批准人必须是 CODEOWNERS 里的人 |
| Dismiss stale approvals | ✅ | 新 commit 后旧批准失效 |
| Require status checks | `build`、`review-gate` | 数据与字段校验必须先过 |
| Allow force pushes / deletions | ❌ | 保护历史 |

> GitHub 不允许批准自己开的 PR。访客通过表单投稿时作者是 `staticmanapp`，你可以正常批准；如果你自己直接提了内容 PR，可以用仓库所有者的权限直接合并（`enforce_admins` 默认留 false），或改用表单投稿。

## 9. 免费额度与成本

| 服务 | 免费额度（以官方为准） | 本站用量 |
| --- | --- | --- |
| Cloudflare Pages | 每月 500 次构建、无限请求与带宽、单次构建 20 分钟 | 每次合并 1 次构建 |
| GitHub 公共仓库 | 无限私有/公共仓库、Actions 2000 分钟/月（公共仓库另有免费额度） | 每个 PR 1 次构建 |
| Staticman 公共实例 | 免费、无 SLA | 每次投稿 1 个 PR |
| Pagefind | 开源，构建时本地运行 | — |
| 数据库 / 服务器 | 不使用 | 0 |

合计：**0 元/月**。唯一可能触发限制的场景是短时间内合并大量 PR（每月 500 次构建上限），对个人攻略站来说远超需求。

---

## 10. 已知限制

1. **公共 Staticman 实例不稳定 / 有限流**：它由社区维护，可能临时不可用、限速，或因为 GitHub API 变更短暂失效。表单提交失败时页面会提示，可以稍后重试或手动提 PR。
2. **公共实例依赖共享的 GitHub 账号**：v2 模式需要把 `staticmanapp` 加为仓库协作者，这等于给它该仓库的写权限；介意的话请用第 11 节的自部署方案。
3. **没有实时发布**：必须合并 PR，且要等 Cloudflare 构建完成。
4. **搜索索引滞后**：索引在构建时生成，新内容要等下一次构建。
5. **中文路径**：角色页产物是 `dist/characters/今汐/index.html`，URL 里会出现 `%E4%BB%8A%E6%B1%90` 这类编码，功能正常，但不适合直接分享纯文本链接之外的地方。
6. **详情页 slug 是时间戳**：除非你在 PR 里手动重命名文件。
7. **没有图片上传**：Staticman 只处理表单文本字段；图片请用外链。
8. **蜜罐只能挡住简单机器人**，没有验证码（公共实例不开放 reCaptcha 密钥配置）。
9. **没有真正的文件上传**：图片/视频都是链接（原因见 6.4），图床挂了图片就会失效；B 站嵌入可能被部分广告拦截插件屏蔽。
10. **审批依赖 GitHub 账号**：只有仓库所有者能批准，且不能批准自己开的 PR（访客投稿不受影响，作者是 staticmanapp）。
11. **表单增强依赖 JavaScript**：禁用 JS 时表单仍能提交，但成员行不能增删、也看不到提交结果（会显示 JSON 响应）。

---

## 11. 备选方案（公共实例不可用时）

**A. 自部署 Staticman（推荐，仍免费）**

1. Fork `https://github.com/eduardoboucas/staticman`。
2. 部署到 Render / Fly.io / Railway 的免费实例（Node 服务），配置 `GITHUB_TOKEN`（一个有 `repo` 权限的 GitHub Personal Access Token）。
3. 把 `src/config.ts` 里的 `endpoint` 改成 `https://<你的实例域名>/v2/entry`。
4. 其余不变：`staticman.yml`、表单字段、PR 审核流程完全一致。

**B. 手动提 PR**： Contributors 直接在 GitHub 上新建 `src/content/guides/*.md`（照抄第 6 节的 frontmatter），你合并即可。`/submit/` 页也给了这条提示。

**C. 换托管（打不开 Cloudflare 时）**：用 GitHub Pages（见 SETUP.md 5B，零新账号）；或本地 `npm run build` 后把 `dist` 拖到 Netlify Drop。站点是纯静态，代码不用改，只是 `site` / `BASE_PATH` 跟着变。

**D. GitHub Issue 表单 + Actions 生成文件**：用 Issue Forms 收集投稿，Actions 里把 Issue 转成 Markdown 文件开 PR。适合想把投稿入口彻底搬到 GitHub 的场景，但游客需要 GitHub 账号。

---

## 12. 排错 FAQ

| 现象 | 原因 / 处理 |
| --- | --- |
| 搜索页一直空、控制台 404 `/pagefind/pagefind.js` | 你跑的是 `npm run dev`，没有索引。用 `npm run build && npm run preview`。 |
| 提交后返回 `INVALID_FIELDS` | 请求里带了 `allowedFields` 之外的非空字段（常见：蜜罐被填、表单加了新字段但没更新 `staticman.yml`）。跑 `npm run check:forms`。 |
| 提交返回 `MISSING_REQUIRED_FIELDS` | 必填项为空，或成员行被全部清空导致 `members` 缺失。 |
| 提交报网络错误 | 公共实例挂了/限流。稍后重试，或改用第 11 节方案。 |
| PR 的 `validate` 变红 | 看日志里的 Zod 报错：通常是 `members` 不是对象数组、或 `date` 格式不对。改好 PR 里的文件即可重新触发。 |
| 合并后页面 404 | 构建还没跑完，看 Cloudflare 部署日志；构建失败的话 Pages 会保留上一版。 |
| 中文角色页 404 | URL 必须带编码（`/characters/%E4%BB%8A%E6%B1%90/`）；站内链接已经处理好，手输时注意。 |
| Cloudflare 构建报 Node 版本 | 确认 `.nvmrc` 存在，或加环境变量 `NODE_VERSION=22`。 |

---

## 13. 验收自检

| # | 验收项 | 状态 |
| --- | --- | --- |
| 1 | `npm run dev` 可预览 | ✅ 本地实测 |
| 2 | `npm run build` 成功并生成 Pagefind 索引 | ✅ 实测：`Indexed 6 pages / 2 filters` |
| 3 | 两个表单字段与 `staticman.yml` 匹配 | ✅ `npm run check:forms` |
| 4 | Staticman 开启审核（PR 而非直写） | ✅ `moderation: true`（两段配置均校验） |
| 5 | 搜索页能搜到已合并内容 | ✅ 用 headless 浏览器实测全文检索返回结果 |
| 6 | 角色页按角色筛选攻略 | ✅ |
| 7 | 配队列表展示核心角色与成员定位 | ✅ |
| 8 | 角色页"相关配队"按 `coreCharacter` 筛选 | ✅ |
| 9 | `team-element` 筛选可用、配队正文可搜 | ✅ 实测筛选命中 `/teams/jinhsi-burst/` |
| 10 | 配队表单产出正确的对象数组结构 | ✅ 字段名 `fields[members][N][name|role]`，提交前自动重排索引 |
| 11 | README 部署步骤可执行 | ✅ 见第 5 节 |
| 12 | 无付费依赖 | ✅ 见第 9 节 |
| 13 | 图片：封面 / 图集 / 灯箱 | ✅ 实测：封面渲染、2 张缩略图、点击打开灯箱（src/alt 正确） |
| 14 | 视频：B 站 / YouTube / mp4 / 降级 | ✅ 实测三种产物：`player.bilibili.com` iframe、原生 `<video>`、外链按钮 |
| 15 | 内容纠错窗口（单人可用的零后端反馈） | ✅ 实测生成的 Issue 链接含标题、正文、`content-error`/`feedback` 标签 |
| 16 | 投稿页媒体链接实时预览 | ✅ 实测封面 1 张、图集 2 张缩略图即时出现 |
| 17 | 配队/攻略发布需站长批准 | ✅ CODEOWNERS + `review-gate`（比对 `context.repo.owner`）+ `npm run protect`；配置见第 8.1 节 |
| 18 | 390px 移动端无横向溢出 | ✅ 实测 /、攻略详情、配队列表、投稿页 `scrollWidth == innerWidth` |
| 19 | 合并后的链路可复现 | ✅ `npm run simulate` 生成模拟投稿 → 构建 22 页 → 索引 8 页 → 搜索命中，随后 `--clean` 复原 |
| 20 | 子路径部署（GitHub Pages 项目站点） | ✅ `BASE_PATH=/wuwa-guide/ npm run build` 后，20 页 288 条站内链接全部可达（0 断链） |

第 4、10、17 条的端到端行为依赖真实 GitHub 仓库：需要你先完成 5.2–5.4 与 8.1，再按 5.5 走一遍投稿 → PR → 批准 → 合并 → 构建的完整链路。

---

## 14. 许可

示例攻略与配队内容仅用于演示，可自由替换。代码可直接用于你自己的站点。
