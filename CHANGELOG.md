# 更新日志 · Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)；每个版本都会打 Git tag。

## [未发布]

### 工程

- 新增 `.github/workflows/publish.yml`：推 `v*` 标签即由 GitHub Actions 通过 npm
  **Trusted Publishing（OIDC）** 发布，仓库与 GitHub secrets 里不再存放任何 npm 令牌。
  发布前会校验「标签版本 == `package.json` 版本」并跑一遍冒烟测试。
- CI 的动作升级到 `actions/checkout@v7` 与 `actions/setup-node@v7`
  （v4 跑在已被强制升级的 Node 20 上，会产生弃用警告）。
- 这两项都只影响仓库，不入 npm 包（`files` 白名单不含 `.github/`）。

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

[0.1.3]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.1.3
[0.1.2]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.1.2
[0.1.1]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.1.1
[0.1.0]: https://github.com/aichixiaojuzi/dsh-model-quick-switch/releases/tag/v0.1.0
