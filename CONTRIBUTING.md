# 参与贡献 · Contributing

感谢你愿意花时间。这个插件很小，改动门槛也低：**没有构建步骤**，改完 `client.js`
刷新页面就能看到效果。

## 开发环境

```powershell
git clone https://github.com/aichixiaojuzi/dsh-model-quick-switch.git
cd dsh-model-quick-switch

# 装进你的 profile（把 desktop 换成 web 也可以）
dsh plugin --profile desktop add link:$PWD

# 语法检查 + 冒烟测试
node --check client.js
node --check index.js
node dev/smoke.mjs
```

`dev/smoke.mjs` 用一个极简的 React / 模块加载器桩件把 `client.js` 跑起来，
覆盖 34 项断言（双栏渲染、搜索、收藏、最近、右键菜单、别名、默认供应商、
拖拽结果、空目录兜底、子代理会话留空、注入声明等）。**提交前请确保它全绿。**

## 改代码时的约定

- **只用主题变量**：颜色一律走 `--dsw-alias-*` 之类的 token，不要写死十六进制值；
  深浅色主题都要能看。
- **不引入依赖**：客户端半边只用 `require('react')`，不要新增运行时依赖。
- **不用 `ctx.modelDirectories.select()` 之外的方式切换模型**：这样 `/model` 弹窗
  与本插件永远一致；也不要自己去改 Host 状态。
- **席位要能安全退出**：这个插件遮蔽了官方席位，任何情况下都不能渲染成空白。
  新增渲染分支时想清楚失败路径，必要时用 `SeatBoundary`。
- **服务注入要声明齐全**：`ctx.inject([...])` 里必须列出该服务自身依赖的服务
  （例如 `modelDirectories` 需要 `remote` / `remote.session`），否则 Cordis 会在
  缺依赖的作用域里实例化它，报 `cannot get property ... without inject`。
- 文案改动要同时更新 `COPY.en` / `COPY.zh` 与 `locale/*.json`。

## 提交与 PR

1. Fork 并开一个分支：`git checkout -b fix/panel-empty-state`
2. 提交信息用祈使句，说明**为什么**改：`fix: declare remote.session so directoryFor stops throwing`
3. PR 描述里写清楚：现象、根因、验证方式（跑了哪些断言 / 手动点了哪些路径）
4. 涉及 UI 的改动请附一张改动后的截图。

## 报告问题

用 issue 模板，尽量带上：

- DSH 版本（`dsh --version` 或应用里的版本号）与操作系统；
- 复现步骤；
- 面板里的报错原文（面板底部红字，或空目录状态下的那行提示）；
- 浏览器控制台的报错堆栈（如果有）。

## 行为准则

保持友善、就事论事。技术分歧用证据解决，不针对人。
