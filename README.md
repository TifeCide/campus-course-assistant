# 课室查询 · ZSC

一个基于 React 和 Vite 的纯前端课室查询系统，用于查询校园教室在指定周次、日期和节次下的空闲情况，也支持按课程、教师和班级检索课表。

项目不需要后端服务或数据库，页面运行时读取静态 JSON 数据。生产环境可以部署到 GitHub Pages、Cloudflare Pages 或其他静态文件服务器。

数据资源配置了多个来源：当前部署路径、jsDelivr CDN 和 GitHub Pages。单个来源加载失败时，页面会提示失败来源并自动切换到下一个来源。

## 功能

- 查询指定周次、星期和节次的空闲教室
- 支持按具体日期查询
- 支持单节次或多节次筛选
- 支持按楼栋、楼层和区域筛选
- 支持课程、教师、班级和教室检索
- 查看教室课程安排、每周概览和下一节课程
- 收藏教室，并保存最近查询
- 支持通知中心和配置化通知
- 支持命令面板和 `Ctrl / Cmd + K` 快速搜索
- 查询条件同步到 URL，便于分享和恢复
- 支持结果区域遮罩
- 支持数据文件多来源加载、失败提示和自动重试
- 响应式布局，适配桌面端和移动端

## 技术栈

- React 19
- Vite 6
- Tailwind CSS v4
- lucide-react
- 原生 `fetch`、`localStorage` 和浏览器 URL API
- GitHub Actions + GitHub Pages
- Cloudflare Pages、jsDelivr CDN 和 GitHub Pages 多来源静态资源回退

## 环境要求

- Node.js 20 或更高版本
- npm

安装依赖：

```bash
npm install
```

CI 和部署环境使用锁定版本安装依赖：

```bash
npm ci
```

## 常用命令

启动开发服务器：

```bash
npm run dev
```

默认情况下，Vite 会在本地启动开发地址，并在终端输出访问 URL。

解析课表并生成 v2 数据：

```bash
npm run build-data
```

校验 v2 数据：

```bash
npm run verify-data-v2
```

生产构建：

```bash
npm run build
```

本地预览生产构建：

```bash
npm run preview
```

解析课表并构建：

```bash
npm run update-data
```

`npm run update-data` 会依次执行 `npm run build-data` 和 `npm run build`。推荐在更新课表或准备部署时使用。

## 项目结构

```text
.
├─ .github/workflows/deploy-pages.yml   GitHub Pages 部署流程
├─ public/
│  └─ data/
│     ├─ setting.json                   网站运行配置
│     └─ v2/                            前端读取的模块化数据产物
├─ scripts/
│  ├─ build-data.js                     统一构建器：解析课表 HTML 并直接生成 v2 数据
│  ├─ verify-data-v2.js                 v2 一致性校验
│  ├─ class-normalization.json          班级别名和拆分规则
│  ├─ parse-classrooms.js               （旧版）教室课表解析器，回退用
│  ├─ parse-schedule.js                 （旧版）课程、教师和班级索引解析器，回退用
│  └─ build-data-v2.js                  （旧版）v2 数据构建器，回退用
├─ src/
│  ├─ App.jsx                           应用主组件：数据加载编排、筛选逻辑与页面组合
│  ├─ main.jsx                          React 应用入口
│  ├─ styles/
│  │  └─ tokens.css                     Tailwind v4 主题令牌、基础样式与组件类
│  ├─ config.js                         多源资源地址、加载进度估算和构建时间
│  ├─ constants.js                      默认设置与存储键等常量
│  ├─ components/                       可复用 UI 组件（对话框、卡片、选择器、通知等）
│  ├─ hooks/                            useClock、useFavorites、useRecentQueries 等状态钩子
│  └─ utils/                            时间、教室占用、查询快照、v2 数据转换等纯函数
├─ CNAME                                GitHub Pages 自定义域名
├─ index.html                           HTML 入口
├─ package.json                         脚本和依赖配置
├─ package-lock.json                    依赖锁定文件
├─ vite.config.js                       Vite 配置
└─ README.md                            项目说明
```

以下 HTML 文件是解析器的输入，不是浏览器运行时直接读取的数据。推荐放入已忽略的 `.source-data/` 目录；不设置环境变量时，仍兼容从项目根目录读取：

```text
kbxx_classroom_ifr_*.html   教室课表
kbxx_kc_ifr_*.html          课程课表
kbxx_teacher_ifr_*.html     教师课表
kbxx_xzb_ifr_*.html          行政班课表
```

## 更新课表数据

### 1. 放置原始课表

将新的课表 HTML 文件放到 `.source-data/`，文件名保持以下格式：

```text
kbxx_classroom_ifr_2026-2027-1.html
```

构建器会查找所有匹配以下模式的文件：

```text
kbxx_classroom_ifr_*.html
kbxx_kc_ifr_*.html
kbxx_teacher_ifr_*.html
kbxx_xzb_ifr_*.html
```

PowerShell 中先指定课表目录：

```powershell
$env:SCHEDULE_SOURCE_DIR = ".source-data"
```

不带参数运行时，`build-data.js` 会为每类文件按文件名排序并自动选择最新的教室课表：

```bash
npm run build-data
```

如果课表目录中有多个教室课表文件，也可以明确指定输入文件：

```bash
npm run build-data -- kbxx_classroom_ifr_2026-2027-1.html
```

### 2. 生成 v2 数据

构建器读取四类课表中的：

```html
<table id="kbtable">
```

解析后直接生成：

```text
public/data/v2/
```

解析器支持以下两类 HTML：

1. 教务系统直接保存的原始 HTML。
2. 浏览器“查看源代码”后保存的、包含 `line-wrap` 包装结构的 HTML。

执行成功后会输出教室数量、课程记录数量、检测到的最大周次，以及 v2 各文件的统计与校验计数。

### 3. 一次完成更新和构建

```bash
npm run update-data
```

执行后会更新 `public/data/v2/` 并生成生产构建。

### 4. 构建并检查

```bash
npm run update-data
```

执行后建议检查：

- 构建输出中的教室数量、课程事件数量和最大周次是否合理
- `public/data/v2/common.json` 的 `sourceFiles` 是否是预期文件
- `public/data/v2/manifest.json` 的 `summary` 是否合理
- `npm run verify-data-v2` 是否通过

GitHub Actions 只构建已提交的数据，不再解析原始 HTML。因此更新课表后，必须在本地运行 `npm run update-data`，并提交生成后的数据文件。

### v2 模块化数据

前端已使用 `public/data/v2/`：首屏读取 `manifest.json`、`common.json`、`rooms.json` 和 `availability.json`；打开教室详情、实体课表或命令面板时才读取 `schedule.json`；普通课程、教师和班级搜索先使用 `directory.json` 的倒排索引。旧版 `classroom-data.json` 与 `schedule-index.json` 已不再生成；如需回退旧管道，可使用保留的 `parse`、`parse-schedule` 和 `build-data-v2` 脚本。

班级组合文本按逗号分段，段末的 `班` 仅作为分隔标记移除，例如 `工业设计26班,电信26B班` 生成 `工业设计26` 和 `电信26B`。`新闻26AB`、`新闻26CD` 等带字母后缀的班级保持原样；只有在 `scripts/class-normalization.json` 的 `splits` 中显式配置时才会拆分。

各 v2 文件的职责与加载时机：

| 文件 | 首屏是否读取 | 主要内容 |
| --- | --- | --- |
| `manifest.json` | 是 | v2 文件入口、版本摘要、各文件哈希与大小 |
| `common.json` | 是 | 学期与时间段字典、课程/教师/班级名称字典 |
| `rooms.json` | 是 | 教室基础信息（楼栋、楼层、区域等） |
| `availability.json` | 是 | 按周/星期/节次组织的占用位图索引，用于空闲教室筛选 |
| `directory.json` | 否（按需） | 课程/教师/班级目录索引，供搜索入口快速筛选 |
| `schedule.json` | 否（按需） | 规范化课程事件明细，供教室详情和实体课表使用 |

补充细节：

- 首屏进度条按资源估算大小加权，当前估算包含 `manifest/common/rooms/availability/setting`，不包含按需加载文件。
- 当某个来源失败时，加载页会显示“失败来源 -> 正在切换到下一个来源”的提示，便于判断是当前部署、CDN 还是 GitHub Pages 故障。
- `manifest.json` 的 `files.*.path` 是前端后续读取路径的唯一入口，手工改文件名时必须同步更新 manifest。
- 目录检索优先使用 `directory.json` 的实体索引；一旦启用位置筛选（楼栋/楼层/区域），会切换到完整课表数据做精确过滤。

### 数据源回退顺序（运行时）

所有运行时 JSON（`setting.json` 和 v2 文件）都使用同一回退顺序：

1. 当前部署路径（`import.meta.env.BASE_URL`，例如 Cloudflare Pages 的当前站点）
2. jsDelivr CDN（`https://cdn.jsdelivr.net/gh/TifeCide/campus-course-assistant@main/public/`）
3. GitHub Pages（`https://tifecide.github.io/campus-course-assistant/`）

补充细节：

- 回退是“单资源独立回退”：例如 `availability.json` 失败会单独回退，不会重置已成功的 `common.json`。
- 若三个来源都失败，页面会进入加载失败状态，需检查文件发布状态、仓库路径、跨域策略和 JSON 格式。
- `vite.config.js` 默认 `base: "./"`，因此项目可部署到根路径和子路径；若部署到子路径，建议用 `VITE_BASE_PATH=/your-path/ npm run build` 重新构建。

## 网站配置

配置文件：

```text
public/data/setting.json
```

当前配置字段如下：

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `semesterStartDate` | 字符串 | 学期第一周周一，格式为 `YYYY-MM-DD` |
| `semesterEndDate` | 字符串 | 教学周最后一天，格式为 `YYYY-MM-DD` |
| `notify` | 数组 | 通知中心中的通知配置 |
| `infoDisplay` | 数字 | `1` 显示结果，`0` 对结果区域启用遮罩 |
| `maskMessage.title` | 字符串 | 结果遮罩标题 |
| `maskMessage.text` | 字符串 | 结果遮罩说明 |
| `defaultView` | 字符串 | 默认视图，可选 `available` 或 `courses` |
| `defaultOnlyAvailable` | 布尔值 | 是否默认只显示空闲教室 |
| `defaultPeriodMode` | 字符串 | 默认节次模式，可选 `single` 或 `multiple` |
| `searchResultLimit` | 数字 | 课程检索最多显示的结果数量 |
| `enableCommandPalette` | 布尔值 | 是否启用命令面板和快速搜索 |
| `enableBackToTop` | 布尔值 | 是否启用回到顶部按钮 |
| `stickyFilters` | 布尔值 | 保留的历史配置字段，当前筛选栏固定为随页面滚动，滚动到结果区时自动收起 |
| `schoolTimeZone` | 字符串 | 学校时区配置字段，当前时间计算固定使用 `Asia/Shanghai` |

当前配置示例：

```json
{
  "semesterStartDate": "2026-08-31",
  "semesterEndDate": "2026-12-20",
  "defaultView": "available",
  "defaultOnlyAvailable": false,
  "defaultPeriodMode": "single",
  "searchResultLimit": 75,
  "enableCommandPalette": true,
  "enableBackToTop": true,
  "stickyFilters": true,
  "schoolTimeZone": "Asia/Shanghai"
}
```

配置优先级与容错：

1. 代码内置默认值（`src/constants.js` 的 `DEFAULT_SETTINGS`）
2. `public/data/setting.json`（运行时覆盖默认值）
3. URL 查询参数（仅覆盖查询条件，不覆盖站点设置项）

补充细节：

- `enableCommandPalette` / `enableBackToTop`：仅当值显式为 `false` 时关闭，缺失时按开启处理。`stickyFilters` 为保留字段，不再控制吸顶。
- `searchResultLimit` 读取时会转为数字，空值或非法值会回退到默认值。
- `maskMessage` 兼容旧字段拼写（`tittle`）并归一化到 `title`。
- `schoolTimeZone` 当前仅作为配置字段保留，应用内部日期判断固定按 `Asia/Shanghai` 执行。

### 学期阶段显示

顶部的当前时间提示会根据 `semesterStartDate` 和 `semesterEndDate` 判断阶段：

```text
教学周：第 n 周 周 x
教学结束后的连续 3 周：考试周 周 x
其他日期：假期 周 x
```

例如当前配置对应：

```text
2026-08-31 至 2026-12-20：第 1 至 16 周
2026-12-21 至 2027-01-10：考试周
其他日期：假期
```

考试周和假期只是顶部的显示状态。内部课程查询仍使用数字周次，并继续受 `manifest.json` 中 `summary.maxWeek` 限制，不会把“考试周”或“假期”作为课程查询周次传入数据层。

### 通知配置

每条通知支持以下字段：

| 字段 | 作用 |
| --- | --- |
| `notifyNo` | 通知编号，用于排序和持久化关闭状态 |
| `notifyType` | `info`、`warning` 或 `error` |
| `notifyTitle` | 通知标题 |
| `notifyText` | 通知正文，可使用 `\\n` 换行 |
| `notifyStartDate` | 生效范围开始日期 |
| `notifyEndDate` | 生效范围结束日期 |
| `notifyInDate` | `1` 表示日期范围内显示，`0` 表示日期范围外显示 |
| `notifyTwice` | 是否允许通知出现两次，当前配置会保留该字段 |

日期使用 `YYYY-MM-DD` 格式，并按当前应用使用的上海时区进行判断。

新增配置字段时，应同步修改：

1. `src/constants.js` 中的 `DEFAULT_SETTINGS`。
2. 设置加载时的类型归一化逻辑。
3. 实际读取该配置的组件或业务逻辑。
4. 本 README 的配置表。

## 浏览器本地数据

系统使用浏览器 `localStorage` 保存用户侧状态：

| Key | 内容 |
| --- | --- |
| `classroom-favorites` | 收藏的教室编号 |
| `classroom-recent-queries` | 最近查询条件 |
| `classroom-dismissed-notifications` | 已关闭的通知编号 |

补充细节：

- 数据按“当前域名 + 浏览器”隔离；同一仓库在不同域名（Cloudflare Pages / GitHub Pages）之间不共享本地状态。
- 隐私模式、受限 WebView 或浏览器策略可能禁用 `localStorage`；应用会静默降级为“仅当前会话可见”，不阻断查询功能。
- 最近查询会持久化查询快照，切换视图时可能影响“返回后显示内容”，排查时可先清空 `classroom-recent-queries`。

调试时如需清除这些状态，可以在浏览器控制台执行：

```js
localStorage.removeItem("classroom-favorites");
localStorage.removeItem("classroom-recent-queries");
localStorage.removeItem("classroom-dismissed-notifications");
```

## URL 查询参数

查询条件会同步到 URL，可直接复制链接共享当前筛选状态。当前支持的参数：

| 参数 | 含义 | 示例 |
| --- | --- | --- |
| `view` | 视图：`available` / `courses` / `teachers` / `classes` | `view=available` |
| `mode` | 时间模式：`week`（默认）或 `date` | `mode=date` |
| `date` | 指定日期（`YYYY-MM-DD`） | `date=2026-09-07` |
| `week` | 教学周（仅 `mode=week`） | `week=3` |
| `weekday` | 星期（1-7，仅 `mode=week`） | `weekday=2` |
| `periods` | 节次编码，多个值用逗号分隔 | `periods=0304,0506` |
| `periodMode` | 节次模式：`single`（默认）/ `multiple` | `periodMode=multiple` |
| `available` | 是否仅看空闲：`1`（默认）/ `0` | `available=0` |
| `buildings` | 楼栋筛选，多个值用逗号分隔 | `buildings=厚德楼,博学楼` |
| `floors` | 楼层筛选，多个值用逗号分隔 | `floors=2,3` |
| `zones` | 区域筛选，多个值用逗号分隔 | `zones=普通教学区` |

参数默认值与容错规则：

- 缺失 `view` 时默认 `available`；非法值也会回退到 `available`。
- 缺失 `mode` 时默认 `week`。
- `week`、`weekday` 非数字时会回退默认值；初始化后会再次按数据范围钳制（周次在 `1..summary.maxWeek`，星期在 `1..7`）。
- `periods` 为空时默认 `0102`；`periodMode=single` 时只保留一个节次。
- `available` 缺失时等价于 `1`（仅显示空闲）；只有显式 `available=0` 才显示全部匹配教室。
- 当 `mode=date` 时，`date` 参数优先；周次和星期参数不会作为主时间条件参与筛选。

分享链接建议：

1. 如需让对方看到具体教室空闲结果，建议同时包含 `week/weekday/periods`（或 `date/periods`）和位置筛选参数。
2. 课程/教师/班级视图建议带上 `view` 与 `q`（若使用关键词检索）；若是从实体详情进入，建议带 `entity`。
3. 链接参数较多时可先清空无关筛选，避免对方打开后结果“看起来不对”。

## 构建和部署

### 本地构建

```bash
npm run build
```

构建结果位于：

```text
dist/
```

`dist/` 已加入 `.gitignore`，不会被提交到仓库。

### GitHub Pages

工作流文件：

```text
.github/workflows/deploy-pages.yml
```

当前部署流程如下：

1. 推送到 `main` 分支，或手动触发工作流。
2. 使用 Node.js 20。
3. 执行 `npm ci`。
4. 设置 UTC 构建时间并注入页面。
5. 执行 `npm run build`。
6. 发布 `dist/` 到 GitHub Pages。

部署前需要确认：

- `public/data/v2/` 已经是最新版本。
- `public/data/setting.json` 已经包含当前学期配置。
- GitHub 仓库的 Pages 发布源配置为 GitHub Actions。
- 如果使用自定义域名，`CNAME` 内容和域名 DNS 配置正确。

### Vite 基础路径

`vite.config.js` 默认使用相对基础路径 `./`，适合部署到静态文件服务器和 GitHub Pages。需要部署到指定子路径时，可以设置：

```bash
VITE_BASE_PATH=/your-path/ npm run build
```

项目运行时会根据构建后的基础路径读取当前部署路径下的 `data/` 资源。

## 修改代码时的入口

应用主组件在 `src/App.jsx`，负责数据加载编排、筛选逻辑与页面组合；其余逻辑按职责拆分到各模块：

| 区域 | 主要内容 | 所在文件 |
| --- | --- | --- |
| 日期和周次函数 | `getAcademicWeek`、`getAcademicPhase`、`getRoomDateValue`、`getTemporalFromDate` | `src/utils/datetime.js` |
| 数据加载 | `fetchJsonWithProgress`、`fetchJsonFromUrls` 及 `App` 内的资源加载逻辑 | `src/utils/fetch.js`、`src/App.jsx`、`src/config.js` |
| 加载进度 | `getOverallLoadProgress` 和 `LOAD_RESOURCE_SIZE_ESTIMATES` | `src/config.js` |
| v2 数据转换 | `createInitialDataFromV2`、`createScheduleDataFromV2`、`hydrateRoomsWithSchedule` | `src/utils/v2data.js` |
| 空闲教室筛选 | `getRoomEntries`、`getRoomEntriesForPeriods`、`filteredRooms`、`availableRooms` | `src/utils/rooms.js`、`src/App.jsx` |
| 课程检索 | `courseResults` 及 `CommandDialog` | `src/App.jsx`、`src/components/command-dialog.jsx` |
| 教室卡片和详情 | `RoomCard`、`RoomDialog` | `src/components/cards.jsx`、`src/components/room-dialog.jsx` |
| 实体课表 | `EntityScheduleDialog`、`EntityScheduleCell`、`SchedulePreviewPopover` | `src/components/entity-schedule.jsx` |
| 时间选择 | `TemporalPicker`、`PeriodPicker` | `src/components/pickers.jsx` |
| 通知 | `normalizeNotification`、`NotificationCenter`、`NotificationCenterDialog` | `src/utils/notifications.js`、`src/components/notifications.jsx` |
| URL 和最近查询 | `createQuerySnapshot`、`getQuerySnapshotFromUrl`、`getQueryUrl` | `src/utils/query.js`、`src/hooks/useRecentQueries.js` |
| 收藏与时钟 | `useFavorites`、`useClock` | `src/hooks/` |

修改筛选、时间或数据结构后，至少运行：

```bash
npm run build
```

如果修改了课表解析器，还应运行：

```bash
npm run build-data
```

并检查生成数据的摘要信息。

## 常见问题

### 页面显示旧课表

依次检查：

1. `public/data/v2/` 是否已经更新。
2. `dist/data/v2/` 是否已经更新。
3. 浏览器是否需要强制刷新。
4. 静态服务器是否缓存了旧 JSON 文件。

建议对以下文件设置较短缓存时间，或在重新部署后主动刷新缓存：

```text
/data/setting.json
/data/v2/manifest.json
```

### 解析器提示找不到课表

确认 `SCHEDULE_SOURCE_DIR` 指向的目录，或兼容模式下的项目根目录，存在匹配以下格式的文件：

```text
kbxx_classroom_ifr_*.html
```

并确认 HTML 中包含：

```html
<table id="kbtable">
```

### 页面加载失败

确认以下 v2 文件能够通过部署后的静态路径访问：

```text
data/v2/manifest.json
data/v2/common.json
data/v2/rooms.json
data/v2/availability.json
data/setting.json
```

页面会依次尝试当前部署路径、jsDelivr CDN 和 GitHub Pages。如果某个来源失败，加载页会显示失败来源并自动重试下一个来源。若三个来源都失败，再检查：

1. 对应 JSON 文件是否已提交或已发布。
2. GitHub 仓库名和用户配置是否正确。
3. 静态服务器是否允许跨域读取 JSON。
4. 浏览器开发者工具中的网络请求和 JSON 格式。

## 快速更新清单

更新一个新学期的课表时：

```text
1. 将新的 `kbxx_classroom_ifr_*.html`、`kbxx_kc_ifr_*.html`、`kbxx_teacher_ifr_*.html` 和 `kbxx_xzb_ifr_*.html` 放到 `.source-data/`。
2. 修改 public/data/setting.json 中的 semesterStartDate 和 semesterEndDate。
3. 执行 npm run update-data。
4. 执行 npm run verify-data-v2，并检查构建输出和 manifest 的 sourceFiles 与 summary。
5. 执行 npm run build，确认构建通过。
6. 提交生成后的数据、配置和代码变更；原始课表不应提交到主仓库。
7. 推送到 main，等待 GitHub Pages 工作流完成。
```

## 许可和数据说明

本项目是一个校园课室查询前端。课室占用信息根据教务系统课程安排整理生成，不保证反映临时调课、考试安排、活动申请等实时变化。实际使用前应以现场情况和学校最新通知为准。
