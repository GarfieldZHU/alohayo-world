# Wiki 版本管理

> **Wiki 页面版本：** zh-CN 1.0.0 · **英文源版本：** EN 1.0.0 · **产品基线：** v0.1.3 · **更新日期：** 2026-07-18
> **English:** [Wiki Versioning](Wiki-Versioning) · **同步状态：** 已同步至 EN 1.0.0

英文是编辑基准语言，简体中文是一等翻译版本。两者分别记录版本，使读者能直接知道中文
是否落后于英文，而不是假设它们总是同步。

## 版本契约

每个英文页面必须声明英文页面版本、产品基线、更新日期、中文链接和翻译状态。每个中文
页面必须声明 `zh-CN` 版本以及“翻译自哪个 EN 版本”。

- patch：措辞、链接、排版或翻译修正，不改变规则含义；
- minor：增加新行为、表格、示例或模块契约；
- major：术语不兼容或权威模型重组。

Wiki 页面版本不是游戏包版本；“产品基线”说明页面描述的是哪个已发布运行时。

## 翻译同步表

| 英文页面                       |    EN | 中文页面                             | zh-CN | 翻译自 | 状态   |
| ------------------------------ | ----: | ------------------------------------ | ----: | -----: | ------ |
| Home                           | 1.0.0 | Home-zh-CN                           | 1.0.0 |  1.0.0 | 已同步 |
| World and Terrain              | 1.0.0 | World-and-Terrain-zh-CN              | 1.0.0 |  1.0.0 | 已同步 |
| Background World               | 1.0.0 | Background-World-zh-CN               | 1.0.0 |  1.0.0 | 已同步 |
| Character System               | 1.0.0 | Character-System-zh-CN               | 1.0.0 |  1.0.0 | 已同步 |
| Abilities and Roles            | 1.0.0 | Abilities-and-Roles-zh-CN            | 1.0.0 |  1.0.0 | 已同步 |
| Weapons, Armor, and Items      | 1.0.0 | Weapons-Armor-and-Items-zh-CN        | 1.0.0 |  1.0.0 | 已同步 |
| Character and Map Interactions | 1.0.0 | Character-and-Map-Interactions-zh-CN | 1.0.0 |  1.0.0 | 已同步 |
| Repository Architecture        | 1.0.0 | Repository-Architecture-zh-CN        | 1.0.0 |  1.0.0 | 已同步 |
| Content and Modding            | 1.0.0 | Content-and-Modding-zh-CN            | 1.0.0 |  1.0.0 | 已同步 |
| Sources and Design Boundaries  | 1.0.0 | Sources-and-Design-Boundaries-zh-CN  | 1.0.0 |  1.0.0 | 已同步 |

## 发布流程

1. 在 `docs/wiki/` 修改英文源并提升 EN 版本。
2. 若运行行为改变，同时更新模块文档与 `CHANGELOG.md`。
3. 翻译对应 `-zh-CN` 页面；若延期，保留旧版并明确标注当前英文版本。
4. 更新中英文两份同步表。
5. 运行 `yarn validate:wiki` 检查配对、版本头、内部链接与状态。
6. 先提交仓库中的权威 Wiki 源。
7. 同步到独立的 `alohayo-world.wiki.git`，审查 diff 后提交并推送 `master`。

不要只编辑线上 Wiki，否则会形成无法由 Agent 读取、审查和复现的文档分叉。
