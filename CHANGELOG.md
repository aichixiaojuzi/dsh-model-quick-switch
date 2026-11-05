# 更新日志 · Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)；每个版本都会打 Git tag。

## [0.2.2] - 2026-11-05

### 修复

- 模型面板及右键菜单通过 React portal 挂载到 `document.body`，避免输入框祖先的变换、裁切和滚动容器影响视口坐标定位；右键菜单不再放在面板的裁切区域内。
- 搜索框、键盘列表聚焦使用 `preventScroll`；键盘导航仅调整模型列表自身的 `scrollTop`，不再通过 `scrollIntoView` 带动宿主对话区滚动。
- 面板采用 border-box 尺寸，按视口可用高度收缩并限制上下边界，移除与定位计算不一致的窄屏宽度覆盖。

### 工程

- 增加 portal 挂载目标、右键菜单裁切隔离、防滚动焦点、列表局部滚动和小视口边界的模拟 hooks 回归断言。
- 实机验收：用户确认本次布局错位 bug 已修复。
- 标签发布流程在 npm 发布成功后，自动从本版本更新日志生成 GitHub Release。

## [0.2.1] - 2026-11-05

### 修复

- **工作区 / 新会话切换时的模型选择器生命周期**：移除插件按会话 ID 保存的第二份目录缓存，交由官方按 retained binding 管理的解析器返回当前目录；会话尚未就绪时不再退回已释放的目录。
- 目录解析会在打开面板和注入属性变化时重新校验，即使旧目录已有供应商，也会切换到新目录并重新订阅；切换会话时重置选择器组件，避免沿用旧的展开、搜索及重试状态。
- 模型触发按钮与官方选择器一样阻止鼠标按下时的默认焦点转移，避免空白会话切换期间在 click 之前打断按钮交互；不影响搜索框聚焦。
- 目录查询错误改为当前席位私有，避免一个会话覆盖另一个会话的错误信息。

### 工程

- 补充目录释放 / 重绑定、跨会话状态隔离与有状态 hooks 生命周期回归测试；原有冒烟测试继续覆盖排序、收藏、别名和供应商刷新。发布 CI 同时运行两套测试。
- 实机回归：用户完全重启 DSH 后确认，切换工作区并新建会话可正常展开双栏列表、切换模型，原问题未复现。

## [0.2.0] - 2026-11-03

### 新增

- **供应商右键菜单「刷新供应商与模型」**：强制同步当前会话设置中的最新供应商和模型；重复供应商 ID 只保留一条，加载失败的供应商不再占用左栏。
- **供应商右键菜单「从面板删除」**：该供应商同时从左栏、搜索、收藏、最近里消失。
  这是**面板本地**操作——只写 localStorage，不动 profile 里的供应商配置；
  左栏底部会出现「已删除 N 个 · 恢复」，一键全部还原。
  全部删完时右栏不再假装「没有匹配的模型」，而是说明情况并给出恢复入口。
- **模型右键菜单**：右侧任一模型上右键可「重命名」（就地编辑，回车保存、Esc 取消、
  留空恢复原名）、「恢复原名」、「收藏/取消收藏」。模型别名与供应商别名并存但分开存
  （`modelAliases` 以 `供应商id/模型id` 为键），同样参与跨供应商搜索，
  也用在触发按钮和搜索结果里的显示名。
- **「刷新供应商与模型」**：从供应商右键菜单触发当前会话的强制同步。
  它会针对当前会话**强制重新解析最新配置**再 `load()`，因此设置里新加的供应商/API/模型
  不必重启应用；打开插件面板时也会自动执行一次同样的同步。加载期间按钮转圈并禁用，
  Host 报错仍以红字显示；已有供应商的本地别名、排序、收藏和隐藏状态按供应商 id 保留，
  新供应商接在已有供应商之后。

### 变更

- 去掉左栏「收藏」「最近」上方的**供应商过滤框**（原本供应商超过 8 个才出现）。
  供应商多了以后搜索框本身就能跨供应商找模型，这个框只是多一层负担；
  左栏现在直接从「收藏」开始，拖拽也不再受过滤状态限制。

### 工程

- `dev/smoke.mjs` 增加对两个右键菜单、删除/恢复、模型别名、重新加载按钮的断言
  （34 → 53 项），并删掉过滤器相关的那条。
- `load` 现在把底层的 promise 透传出来，重新加载按钮据此显示进度而不是猜一个延时。
- 供应商排序（拖拽 / 置顶 / 上移 / 下移）改为只在**可见**供应商之间计算索引，
  删掉的供应商不再占位。
- 新增 `.github/workflows/publish.yml`：推 `v*` 标签即由 GitHub Actions 通过 npm
  **Trusted Publishing（OIDC）** 发布，仓库与 GitHub secrets 里不再存放任何 npm 令牌。
  发布前会校验「标签版本 == `package.json` 版本」并跑一遍冒烟测试。
- CI 的动作升级到 `actions/checkout@v7` 与 `actions/setup-node@v7`
  （v4 跑在已被强制升级的 Node 20 上，会产生弃用警告）。
- 这两项都只影响仓库，不入 npm 包（`files` 白名单不含 `.github/`）。
- Trusted Publisher 已在 npmjs.com 配置并验证通过（手动触发一次，认证成功、
  因 0.1.3 已存在而如预期停止）。从分支手动触发只做打包检查，不写 registry。

## [0.1.3] - 2026-11-02

### 文档

- README 的示意图由一张换成两张：① 插件在输入框工具行的位置、② 点开后展开的完整面板。
  `assets/panel.png` 已删除，新图是 `assets/panel-1.png` 与 `assets/panel-2.png`。
- `screenshots.json` 同步列出这两张图（插件市场的卡片就是读这个文件，所以以后换图
  不需要再提 PR）。功能代码没有任何改动。

## [0.1.2] - 2026-11-02

### 修复

- **改名后客户端半片加载失败、面板消失**。客户端的模块 id 必须与包名完全一致
  （`@local/sidebar-focus-panel`、`@ace-zone/dsh-market` 都是这个约定），0.1.1 只改了包名、
  没同步这个 id，于是渲染器报 `import failed`，输入框里的面板不再出现。现已把 id 改成完整
  作用域包名，并在冒烟测试里加了一条「模块 id 必须等于 `package.json` 的 `name`」的回归断言。

## [0.1.1] - 2026-11-02

### 变更

- **npm 包名改为作用域包** `@aichixiaojuzi/dsh-model-quick-switch`。npm 的防混淆规则判定
  `dsh-model-quick-switch` 与已存在的 `dsh-model-quickswitch` 去掉连字符后完全同形
  （均为 `dshmodelquickswitch`），因此拒绝了普通包名。仓库名、插件功能和本地安装方式都不变。
- 安装命令随之变为
  `dsh plugin --profile <desktop|web> add @aichixiaojuzi/dsh-model-quick-switch`。

## [0.1.0] - 2026-11-01

首个公开版本。

### 新增

- 供应商优先的双栏模型面板，替换 `conversation.input.model` 席位。
- 收藏、最近使用（12 条）、跨供应商模糊搜索（含别名）。
- 供应商顺序、组内模型顺序、收藏顺序的拖拽排序，以及 `Alt + ↑/↓` 键盘排序。
- 供应商右键菜单：重命名别名、打开面板时默认选中、置顶/上移/下移、
  重置该组模型顺序、批量收藏与清空、重新加载模型目录。
- 推理强度档位内联展开、模型 badge、供应商过滤框（>8 个时出现）。
- 键盘导航：`↑/↓`、`Home/End`、`PageUp/PageDown`、`Enter`、`Esc`。
- 中英双语界面文案。

### 修复

首发前的自测中修掉了三个只在真实 Host 上暴露的问题：

- **座位在新建会话里消失**：插件以 `priority: -1` 抢下席位后，遇到尚未就绪的会话会
  返回空，而官方席位不会顶上来。现在改为惰性解析并重试，只在真正不可用的会话
  （子代理会话）里留空，并加了 `SeatBoundary` 兜底和输入行紧凑显示契约。
- **面板加载后一直空白**：首次 `load()` 被 Host 拒绝后无人重试，官方席位一旦被
  遮蔽就再没人触发加载。现在面板打开期间会自动重试，兼容两种目录对象形状，
  空目录显示明确文案与重试按钮。
- **`directoryFor()` 每次都抛错**：插件的注入作用域少声明了 `remote` /
  `remote.session`，Cordis 在缺依赖的作用域里实例化了 `modelDirectories` 服务，
  导致目录查询失败而被静默吞掉。现已声明齐全，并加了回归断言。

### 已知限制

见 README 的「已知限制」一节。

[0.2.2]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.2.2
[0.2.1]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.2.1
[0.2.0]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.2.0
[0.1.3]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.1.3
[0.1.2]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.1.2
[0.1.1]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.1.1
[0.1.0]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.1.0
