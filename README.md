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

解析课表：

```bash
npm run parse
```

解析课程、教师和班级索引：

```bash
npm run parse-schedule
```

生成并校验 v2 模块化数据：

```bash
npm run build-data-v2
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

`npm run update-data` 会依次执行 `npm run parse`、`npm run parse-schedule`、`npm run build-data-v2` 和 `npm run build`。推荐在更新课表或准备部署时使用。

## 项目结构

```text
.
├─ .github/workflows/deploy-pages.yml   GitHub Pages 部署流程
├─ public/
│  └─ data/
│     ├─ classroom-data.json            教室、时间段和占用数据
│     ├─ schedule-index.json            课程、教师和班级索引
│     ├─ setting.json                   网站运行配置
│     └─ v2/                            模块化数据产物
├─ scripts/
│  ├─ parse-classrooms.js               教室课表解析器
│  └─ parse-schedule.js                 课程、教师和班级索引解析器
│  ├─ build-data-v2.js                  v2 数据构建器
│  ├─ verify-data-v2.js                 v2 一致性校验
│  └─ class-normalization.json          班级别名和拆分规则
├─ src/
│  ├─ App.jsx                           页面组件和主要业务逻辑
│  ├─ main.jsx                          React 应用入口
│  └─ styles.css                        全部页面样式
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

将新的教室课表 HTML 文件放到 `.source-data/`，文件名保持以下格式：

```text
kbxx_classroom_ifr_2026-2027-1.html
```

解析器会查找所有匹配以下模式的文件：

```text
kbxx_classroom_ifr_*.html
```

PowerShell 中先指定课表目录：

```powershell
$env:SCHEDULE_SOURCE_DIR = ".source-data"
```

不带参数运行时，`parse-classrooms.js` 会按文件名排序并自动选择最新教室课表：

```bash
npm run parse
```

如果根目录中有多个课表文件，也可以明确指定输入文件：

```bash
npm run parse -- kbxx_classroom_ifr_2026-2027-1.html
```

### 2. 生成前端数据

解析器读取课表中的：

```html
<table id="kbtable">
```

并生成：

```text
public/data/classroom-data.json
```

解析器支持以下两类 HTML：

1. 教务系统直接保存的原始 HTML。
2. 浏览器“查看源代码”后保存的、包含 `line-wrap` 包装结构的 HTML。

执行成功后会输出教室数量、课程记录数量和检测到的最大周次。

### 3. 生成课程索引

将课程、教师和行政班课表放在同一个课表目录：

```text
kbxx_kc_ifr_*.html
kbxx_teacher_ifr_*.html
kbxx_xzb_ifr_*.html
```

执行：

```bash
npm run parse-schedule
```

解析器会为三类文件分别选择文件名排序后最新的文件，合并生成：

```text
public/data/schedule-index.json
```

该文件供课程、教师和班级检索，以及实体周课表使用。

### 4. 一次完成更新和构建

```bash
npm run update-data
```

执行后会同时更新 `classroom-data.json`、`schedule-index.json`、`public/data/v2/` 并生成生产构建。

### 5. 构建并检查

```bash
npm run update-data
```

执行后建议检查：

- `public/data/classroom-data.json` 的 `generatedAt`
- `sourceFile` 是否是预期文件
- `summary.totalRooms` 是否合理
- `summary.totalEntries` 是否合理
- `summary.maxWeek` 是否合理
- `public/data/schedule-index.json` 的 `generatedAt`、`sourceFiles` 和 `summary` 是否合理
- `npm run verify-data-v2` 是否通过

GitHub Actions 只构建已提交的数据，不再解析原始 HTML。因此更新课表后，必须在本地运行 `npm run update-data`，并提交生成后的数据文件。

### v2 模块化数据

前端已使用 `public/data/v2/`：首屏读取 `manifest.json`、`common.json`、`rooms.json` 和 `availability.json`；打开教室详情、实体课表或命令面板时才读取 `schedule.json`；普通课程、教师和班级搜索先使用 `directory.json` 的倒排索引。旧 JSON 仅保留为解析兼容产物。

班级组合文本按逗号分段，段末的 `班` 仅作为分隔标记移除，例如 `工业设计26班,电信26B班` 生成 `工业设计26` 和 `电信26B`。`新闻26AB`、`新闻26CD` 等带字母后缀的班级保持原样；只有在 `scripts/class-normalization.json` 的 `splits` 中显式配置时才会拆分。

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
| `stickyFilters` | 布尔值 | 是否启用筛选栏吸顶 |
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

考试周和假期只是顶部的显示状态。内部课程查询仍使用数字周次，并继续受 `classroom-data.json` 中 `summary.maxWeek` 限制，不会把“考试周”或“假期”作为课程查询周次传入数据层。

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

1. `src/App.jsx` 中的 `DEFAULT_SETTINGS`。
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

调试时如需清除这些状态，可以在浏览器控制台执行：

```js
localStorage.removeItem("classroom-favorites");
localStorage.removeItem("classroom-recent-queries");
localStorage.removeItem("classroom-dismissed-notifications");
```

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

- `public/data/classroom-data.json` 已经是最新版本。
- `public/data/setting.json` 已经包含当前学期配置。
- `public/data/schedule-index.json` 和 `public/data/v2/` 已通过本地数据更新流程生成。
- GitHub 仓库的 Pages 发布源配置为 GitHub Actions。
- 如果使用自定义域名，`CNAME` 内容和域名 DNS 配置正确。

### Vite 基础路径

`vite.config.js` 默认使用相对基础路径 `./`，适合部署到静态文件服务器和 GitHub Pages。需要部署到指定子路径时，可以设置：

```bash
VITE_BASE_PATH=/your-path/ npm run build
```

项目运行时会根据构建后的基础路径读取当前部署路径下的 `data/` 资源。

## 修改代码时的入口

主要业务逻辑集中在 `src/App.jsx`：

| 区域 | 主要内容 |
| --- | --- |
| 日期和周次函数 | `getAcademicWeek`、`getAcademicPhase`、`getRoomDateValue`、`getTemporalFromDate` |
| 数据加载 | `fetchJsonWithProgress`、`fetchJsonFromUrls` 及 `App` 内的资源加载逻辑 |
| 加载进度 | `getOverallLoadProgress` 和 `LOAD_RESOURCE_SIZE_ESTIMATES` |
| 空闲教室筛选 | `getRoomEntries`、`getRoomEntriesForPeriods`、`filteredRooms`、`availableRooms` |
| 课程检索 | `courseResults` 及 `CommandDialog` |
| 教室卡片和详情 | `RoomCard`、`RoomDialog` |
| 时间选择 | `TemporalPicker`、`PeriodPicker` |
| 通知 | `normalizeNotification`、`NotificationCenter`、`NotificationCenterDialog` |
| URL 和最近查询 | `createQuerySnapshot`、`getQuerySnapshotFromUrl`、`getQueryUrl` |

修改筛选、时间或数据结构后，至少运行：

```bash
npm run build
```

如果修改了课表解析器，还应运行：

```bash
npm run parse
```

并检查生成数据的摘要信息。

## 常见问题

### 页面显示旧课表

依次检查：

1. `public/data/classroom-data.json` 是否已经更新。
2. `dist/data/classroom-data.json` 是否已经更新。
3. 浏览器是否需要强制刷新。
4. 静态服务器是否缓存了旧 JSON 文件。

建议对以下文件设置较短缓存时间，或在重新部署后主动刷新缓存：

```text
/data/classroom-data.json
/data/setting.json
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
4. 执行 npm run verify-data-v2，并检查解析输出、generatedAt、sourceFile/sourceFiles 和 summary。
5. 执行 npm run build，确认构建通过。
6. 提交生成后的数据、配置和代码变更；原始课表不应提交到主仓库。
7. 推送到 main，等待 GitHub Pages 工作流完成。
```

## 许可和数据说明

本项目是一个校园课室查询前端。课室占用信息根据教务系统课程安排整理生成，不保证反映临时调课、考试安排、活动申请等实时变化。实际使用前应以现场情况和学校最新通知为准。
