# 仓库架构

> **Wiki 页面版本：** zh-CN 1.0.0 · **英文源版本：** EN 1.0.0 · **产品基线：** v0.1.3 · **更新日期：** 2026-07-18
> **English:** [Repository Architecture](Repository-Architecture) · **同步状态：** 已同步至 EN 1.0.0

## 依赖方向

`config → map/character → engine → embed → host`

配置定义可序列化契约；领域包实现确定性查询；引擎负责浏览器生命周期与渲染；embed
暴露精简的懒加载 API；博客或独立页面只是宿主，不拥有游戏规则。

## 工作区职责

| 路径                       | 负责                                  | 禁止负责                 |
| -------------------------- | ------------------------------------- | ------------------------ |
| `apps/game`                | 独立启动器和 Pages 外壳               | 模拟规则                 |
| `packages/config`          | 公共类型、schema、目录与 i18n 契约    | 渲染或可执行内容         |
| `packages/map`             | 地理字段、区块、拓扑、水文、覆盖层    | DOM/PixiJS 对象          |
| `packages/character`       | 身份、外观、槽位、固定步长运动        | 宿主 UI 与地图改写       |
| `packages/character-rules` | 可选的资源/装备/地形纯查询            | 存档、输入、Worker、渲染 |
| `packages/engine`          | 运行时、PixiJS、镜头、输入、HUD、清理 | 内容包权威               |
| `packages/embed`           | `mountGame`、懒加载资源、公共生命周期 | 宿主导航与主题政策       |
| `crates/world-core`        | 经测量的确定性 typed-array 热循环     | 每帧场景所有权           |
| `content`                  | 经过校验的内容包和自定义区域          | 任意脚本                 |

## 运行生命周期

宿主先渲染轻量启动器，不加载游戏资源。用户明确点击 Start 后才导入 embed，创建
`GameHandle`、引擎、Worker、Canvas、覆盖层与输入。Worker 先生成中心视口，完整后再
显示画面；随后流式加载近区块并驱逐远区块。`destroy` 必须释放 Worker、RAF、监听器、
DOM 与 GPU 资源。

## Rust/Wasm 边界

Rust/Wasm 只加速经性能测量的 Worker 数值批处理。v0.1.3 稳定批次是区块基础层与纯水文
栅格。TypeScript 保留确定性参考与回退。PixiJS 绘制、UI、内容解析、存档格式、道路、
地形分类和世界变更仍由 TypeScript 负责。

新候选必须通过精确一致性、传输、回退、浏览器测试，并至少减少 15% 中位 CPU 时间且
传输增长不超过 5%。

## 本地持久化

IndexedDB 保存版本化快照、探索状态、角色位置、内容包解析信息与命名槽位。没有账号、
遥测、远程存档或联网玩法。导入数据必须先通过 schema 和兼容性校验。

## 验证门槛

运行 lint、typecheck、内容/资产/Wiki 校验、Vitest、Rust test/fmt/clippy、强制 Wasm
构建、生产构建、性能预算和 Playwright E2E。影响线上 UI 的修改还必须检查 Pages、
Vercel 与实际博客页面。
