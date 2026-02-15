# usefulbilibili

一个面向哔哩哔哩（Bilibili）的油猴脚本仓库。  
当前包含 2 个脚本，后续会继续扩展更多场景。

## 仓库目标

- 收集高频、实用、低干扰的 B 站效率脚本。
- 每个脚本只解决一个明确问题，方便按需启用/停用。
- 保持统一命名与目录规范，便于后续扩展到更多脚本。

## 脚本清单（Script Index）

| ID | 脚本名（油猴显示） | 文件路径 | 适用页面 | 核心功能 |
|---|---|---|---|---|
| BILI-001 | `[Bilibili] 动态页封面一键收藏` | `scripts/bilibili/bilibili-dynamic-quick-favorite.user.js` | `https://t.bilibili.com/*` | 在动态流视频封面上直接一键收藏，支持 Shift+点击切换目标收藏夹 |
| BILI-002 | `[Bilibili] 收藏页卡片一键取消收藏` | `scripts/bilibili/bilibili-favlist-quick-unfavorite.user.js` | `https://space.bilibili.com/*/favlist*` | 在收藏夹视频卡片上增加快捷按钮，一键触发取消收藏流程 |

## 使用前准备

1. 浏览器安装 Tampermonkey（或同类用户脚本管理器）。
2. 保持 B 站已登录状态（部分接口/操作依赖登录 Cookie）。
3. 建议只启用你当前需要的脚本，避免多个脚本同时修改同一区域 DOM。

## 安装方式

1. 打开 Tampermonkey 控制面板。
2. 新建脚本。
3. 将目标 `.user.js` 文件内容粘贴进去并保存。
4. 刷新对应 B 站页面，确认脚本已生效。

## 详细功能与用法

### BILI-001 `[Bilibili] 动态页封面一键收藏`

文件：`scripts/bilibili/bilibili-dynamic-quick-favorite.user.js`

功能说明：

- 在 `t.bilibili.com` 动态流中，为视频封面注入 `★` 悬浮按钮。
- 点击 `★` 可直接把视频加入目标收藏夹，无需打开视频详情页。
- 首次使用会自动读取并保存“默认目标收藏夹”（通常为你创建列表中的第一个）。
- `Shift + 点击` 按钮可弹窗切换目标收藏夹。
- 页面滚动懒加载、动态新增内容也会自动注入按钮。

使用步骤：

1. 打开 B 站动态页：`https://t.bilibili.com/`。
2. 将鼠标移动到视频封面右上角，点击 `★`。
3. 看到“已收藏”提示即表示成功。
4. 如需切换收藏夹：按住 `Shift` 再点击 `★`，按提示输入序号。

实现要点（便于维护）：

- 通过 `x/web-interface/view` 由 `bvid` 获取 `aid`。
- 通过 `x/v3/fav/folder/created/list-all` 获取收藏夹列表。
- 通过 `x/v3/fav/resource/deal` 完成收藏操作。
- 使用 `GM_setValue/GM_getValue` 持久化目标收藏夹 ID 与标题。

注意事项：

- 依赖登录态中的 `bili_jct` 与 `DedeUserID` Cookie。
- 若 B 站页面结构大改，封面按钮位置可能需要调整选择器逻辑。

### BILI-002 `[Bilibili] 收藏页卡片一键取消收藏`

文件：`scripts/bilibili/bilibili-favlist-quick-unfavorite.user.js`

功能说明：

- 在收藏页每个视频卡片注入“🚫取消收藏”按钮。
- 点击后自动执行：打开卡片菜单 -> 点击“取消收藏” -> 尝试确认弹窗。
- 对懒加载和翻页后的新卡片同样有效（MutationObserver 持续监听）。

使用步骤：

1. 打开任意收藏夹列表页：`https://space.bilibili.com/<uid>/favlist`。
2. 在目标视频卡片点击“🚫取消收藏”。
3. 若按钮短暂变为忙碌状态，表示脚本正在自动点击菜单流程。
4. 如果页面结构或文案变化导致失败，按钮会短暂提示“没点到…/取消”。

注意事项：

- 该脚本通过模拟页面按钮点击完成操作，不直接调用收藏接口。
- 若页面菜单文案、层级或按钮类名变化，可能需要更新脚本中的候选选择器。

## 命名与目录规范（面向后续扩展）

### 目录规范

- 统一放在：`scripts/<site>/`
- 当前站点目录：`scripts/bilibili/`

### 文件命名规范

推荐格式：

`<site>-<page>-<action>.user.js`

示例：

- `bilibili-dynamic-quick-favorite.user.js`
- `bilibili-favlist-quick-unfavorite.user.js`

命名原则：

- `site`：站点名（如 `bilibili`）。
- `page`：页面场景（如 `dynamic`、`favlist`、`video`）。
- `action`：动作与目标（如 `quick-favorite`、`batch-hide`）。

### 脚本头部元数据建议

- `@name`：`[Site] 页面 + 功能`，例如 `[Bilibili] 动态页封面一键收藏`
- `@namespace`：建议统一为仓库地址
- `@version`：遵循语义化版本（功能新增升次版本，修复升补丁版本）

## 新增脚本时建议流程

1. 按命名规范创建 `.user.js` 文件并补齐头部元数据。
2. 在目标页面完成功能验证（至少覆盖首次加载 + 懒加载场景）。
3. 在“脚本清单”表新增一行，补充适用页面与核心功能。
4. 在 README 增加该脚本“详细功能与用法”章节。

## 免责声明

本仓库脚本仅用于个人效率增强与学习交流。请遵守 Bilibili 平台条款与当地法律法规，谨慎使用自动化功能。
