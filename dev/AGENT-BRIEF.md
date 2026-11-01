# 项目交接说明（给下一个 AI 会话 / 新对话）

> 这份文件**不进 npm 包**（`files` 白名单里没有 `dev/`），只服务于开发。
> 新对话的第一句话可以写：「先读 `dev/AGENT-BRIEF.md` 和 `CHANGELOG.md`，然后……」

## 这是什么

`@aichixiaojuzi/dsh-model-quick-switch` —— DSH（DeepSeek Harness）的 profile bundle 插件，
占用输入框的 `conversation.input.model` 座位，把官方的模型下拉换成「供应商优先」的双栏面板：
左栏全部供应商、右栏该供应商的模型，支持拖拽排序、别名、收藏、最近、搜索、推理档位内联展开。

- 仓库：https://github.com/aichixiaojuzi/dsh-model-quick-switch （public、MIT、话题 `dsh-plugin`）
- npm：`@aichixiaojuzi/dsh-model-quick-switch`（当前 **0.1.2**，`latest`）
- 本机仓库：`C:\Users\Administrator\Documents\deepseek-harness\default-workspace\dsh-model-quick-switch`

## 架构（读这几个文件就够）

| 文件 | 作用 |
|---|---|
| `package.json` | 包名/版本/`files` 白名单；`dsh.bundle.patch` → `cordis.patch.yml`；`dsh.client` 声明 `platform: web`、`immediately: true`、要注入的服务列表 |
| `cordis.patch.yml` | 4 行：往 profile 插件树 `insert` 一行，`id: model-quick-switch`、`name:` **完整包名**（含作用域） |
| `index.js` | 宿主半片，**故意为空**（`export function apply() {}`）。功能全在浏览器侧，宿主不注册任何东西 |
| `client.js` | 全部功能（约 1400 行、单文件、**无构建步骤**）：占座、渲染、拖拽排序、别名、收藏、最近、搜索、推理档位 |
| `dev/smoke.mjs` | 无头渲染测试（stub 掉 React hooks、模块加载器、目录服务）：`node dev/smoke.mjs` |
| `locale/{zh,en}.json` | 文案 |

## 必须遵守的不变量（都是踩过坑换来的）

1. **客户端模块 id === `package.json` 的 `name`**，逐字相同。
   `client.js` 里 `__ModuleLoader__.load({ id })` 的 id 不一致 → 渲染器报
   `import failed`、面板直接消失（0.1.1 就是这么坏的）。
   `dev/smoke.mjs` 已有断言，改错会立刻测试失败。
2. **只用主题 token 上色**，不要引入 `@deepseek-ai/dsh-client-ui-primitives`；
   样式用 `ctx.effect` 注入 `<style id="dsh-model-quick-switch-styles">`，卸载时清掉。
3. **`ctx.inject([...])` 必须列全每个服务真正读取的依赖**。
   例如 `modelDirectories` 内部会读 `ctx.remote.session`，所以 `remote.session` 也要列；
   漏声明会在某些会话类型下崩。
4. 座位是 single 槽且 `replaceRisk: shadows-shipped-ui`，我们 `priority: -1` 压过官方 `0`；
   保留 `SeatBoundary` 兜底、子代理会话不渲染、重试/自愈循环（`SeatBoundary`、`refreshTick`）。
5. 偏好存在 localStorage 的 `dsh.model-quick-switch.v1`（卸载/清库即恢复默认）。
6. 禁用这个 bundle 就能恢复到官方模型选择器（profile 的 `dsh.profile.bundles` 里去掉即可）。

## 本机开发安装（`link:` 方式）

profile 目录：`C:\Users\Administrator\.dsh\profiles\desktop`。**改名时四处必须一致**：

1. `package.json` → `dependencies` 的**键** = 包名
2. `package.json` → `dsh.profile.bundles` 数组里的一项 = 包名
3. `pnpm-lock.yaml` → `importers["."].dependencies` 的键 = 包名
   （YAML 里以 `@` 开头的键**必须加单引号**：`'@scope/name':`）
4. `node_modules/@scope/name` → 指向仓库目录的 **junction**（旧名那条要删掉）

改完**完全重启 DSH 应用**（不是刷新页面）才生效。回滚用同目录
`*.bak-scope-<时间戳>` / `*.bak-rename-<时间戳>` 备份。

## 常用命令

```powershell
$node = "C:\Users\Administrator\.dsh\dsh-runtimes\dsh-next-primary-runtime\dependencies\node\bin\node.exe"
$pnpm = "C:\Users\Administrator\.dsh\dsh-runtimes\dsh-next-primary-runtime\dependencies\pnpm\bin\pnpm.mjs"

cd C:\Users\Administrator\Documents\deepseek-harness\default-workspace\dsh-model-quick-switch
node dev\smoke.mjs                                     # 自测（必须全绿）
& $node --check client.js                              # 语法
& $node $pnpm view @aichixiaojuzi/dsh-model-quick-switch version repository.url
```

发布流程见 `..\_publish\PUBLISH-STEPS.md`（含 2FA 豁免令牌的完整步骤）。

## 未完成的线程 / 状态

- **收录 PR**（`awesome-dsh-plugin/awesome-dsh-plugin`）：仓库满 24 小时后才能提
  （**2026-11-03 00:12** 之后）。条目草案 `_publish\catalog-entry.yml`；
  规则核实见 `_publish\CATALOG-SPEC.md`；操作指引见 `_publish\PR-STEPS.md`。
- npm 上的 **0.1.1 有缺陷**（客户端 id 未随改名同步），不要使用；`latest` 已是 0.1.2。
- 发布用的 **2FA 豁免令牌是一次性的**，发完即删；下次发布要新造一个。
- 本地 profile 已同步到作用域包名；`_publish\` 目录在仓库之外，**不要**提交进仓库
  （里面含发布笔记与临时产物）。

## 环境注意（会直接影响命令能否跑通）

- 本机**没有 `npm` 命令**，只有 node 与 pnpm（路径见上）；`pnpm dlx` 需要 node 的 bin 目录在 `PATH` 里。
- PowerShell 5.1 里 `Get-Content` / `Set-Content` 读写 UTF-8 文件会按 ANSI 解码而读坏中文，
  要用 `-Encoding UTF8`，或交给编辑器 / Node 处理。
- 远端验证交给 `web_fetch`（GitHub API、registry.npmjs.org），本机 pwsh 出网不稳。
