# 课室查询系统维护备忘录

更新时间：2026-08-22

## 1. 项目概览

这是一个纯前端课室查询系统，使用 React、Vite、Tailwind CSS v4 和 lucide-react 构建。

系统运行时从以下文件读取数据：

```text
public/data/setting.json
public/data/v2/
public/data/room-attributes.json   （可选，教室属性徽章）
```

不需要后端服务，也不需要鉴权。

`public/data/v2/` 包含公共字典、教室、占用索引、规范化课程事件和目录索引。前端首屏读取教室与占用索引，目录和完整课表按交互延迟加载。

## 2. 常用命令

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

预览生产构建：

```bash
npm run preview
```

## 3. 更新课表数据

### 自动选择课表文件

将新的教务系统课表文件放到已忽略的 `.source-data/` 目录，文件名保持类似格式：

```text
kbxx_classroom_ifr_2026-2027-1.html
```

然后执行：

```bash
npm run build-data
```

PowerShell 中先设置：

```powershell
$env:SCHEDULE_SOURCE_DIR = ".source-data"
```

构建器会自动查找该目录中名称匹配以下格式的文件：

```text
kbxx_classroom_ifr_*.html
kbxx_kc_ifr_*.html
kbxx_teacher_ifr_*.html
kbxx_xzb_ifr_*.html
```

每类文件默认使用文件名排序后最新的文件，并直接生成：

```text
public/data/v2/
```

### 指定课表文件

如果课表目录中有多个教室课表文件，可以手动指定教室课表：

```bash
npm run build-data -- kbxx_classroom_ifr_2026-2027-1.html
```

### 解析并重新构建

部署前推荐执行：

```bash
npm run update-data
```

该命令会依次执行：

1. 解析四份 HTML 课表并生成 `public/data/v2/` 模块化数据。
2. 执行 `npm run build`。

生成后执行：

```bash
npm run verify-data-v2
```

该校验会从课程事件重建全部 756 个周次、星期和节次占用结果并与 `availability.json` 比对，同时验证 manifest 哈希与目录索引。

解析成功后会输出教室数量、课程记录数量、最大周次和 v2 各文件的统计与校验计数。

## 4. 配置文件

配置文件位置：

```text
public/data/setting.json
```

当前支持的配置项：

| 配置项 | 类型 | 作用 |
| --- | --- | --- |
| `semesterStartDate` | 字符串 | 学期第一周周一，格式为 `YYYY-MM-DD` |
| `semesterEndDate` | 字符串 | 教学周最后一天，格式为 `YYYY-MM-DD`；结束后的 3 周显示为考试周 |
| `infoDisplay` | 数字 | `1` 显示结果，`0` 隐藏结果区域 |
| `maskMessage.title` | 字符串 | 结果遮罩标题 |
| `maskMessage.text` | 字符串 | 结果遮罩说明 |
| `defaultView` | 字符串 | 默认视图，可选 `available` 或 `courses` |
| `defaultOnlyAvailable` | 布尔值 | 是否默认只显示空闲教室 |
| `defaultPeriodMode` | 字符串 | 默认节次模式，可选 `single` 或 `multiple` |
| `searchResultLimit` | 数字 | 课程检索最多显示的结果数量 |
| `enableCommandPalette` | 布尔值 | 是否启用搜索面板和 `Ctrl / Cmd + K` |
| `enableBackToTop` | 布尔值 | 是否启用右下角回顶按钮 |
| `stickyFilters` | 布尔值 | 保留的历史配置字段，已不生效；筛选栏始终显示并随页面滚动 |
| `schoolTimeZone` | 字符串 | 学校时区，当前默认使用 `Asia/Shanghai` |

修改配置后不需要重新解析课表，但部署前仍建议重新执行：

```bash
npm run build
```

`maskMessage` 当前优先读取 `title`，同时兼容旧配置中的 `tittle`。

### 教室属性徽章（room-attributes.json）

人工维护的外挂数据，用于给机房、不开门的大教室等特殊教室显示提醒徽章。结构为 `roomtype` 类型字典 + `list` 教室映射，完整 schema 见 README「教室属性徽章」一节。修改后只需重新执行 `npm run build` 发布；文件缺失或加载失败时页面静默降级。

## 5. 主要文件

| 文件 | 作用 |
| --- | --- |
| `src/App.jsx` | 应用主组件：数据加载编排、筛选逻辑与页面组合 |
| `src/config.js` | 多源资源地址、加载进度估算和构建时间 |
| `src/constants.js` | 默认设置与存储键等常量 |
| `src/components/` | 可复用 UI 组件（ui、pickers、cards、room-dialog、entity-schedule、notifications 等） |
| `src/hooks/` | useClock、useFavorites、useRecentQueries 状态钩子 |
| `src/utils/` | 时间日期、教室占用、查询快照、v2 数据转换、通知归一化等纯函数 |
| `src/styles/tokens.css` | Tailwind v4 主题令牌（色阶/阴影/动效）、基础样式与 .btn/.card 等组件类 |
| `src/main.jsx` | React 应用入口 |
| `public/data/v2/` | 前端实际读取的模块化数据 |
| `public/data/setting.json` | 网站行为配置 |
| `public/data/room-attributes.json` | 教室属性徽章外挂数据（人工维护，可选） |
| `scripts/build-data.js` | 课表 HTML 解析与 v2 数据构建的统一入口 |
| `scripts/verify-data-v2.js` | v2 一致性校验 |
| `scripts/class-normalization.json` | 班级别名和拆分配置 |
| `scripts/parse-classrooms.js` | （旧版）教室课表解析器，回退用 |
| `scripts/parse-schedule.js` | （旧版）课程、教师和班级索引解析器，回退用 |
| `scripts/build-data-v2.js` | （旧版）v2 数据构建器，回退用 |
| `package.json` | 项目命令和依赖配置 |
| `dist/` | 生产构建输出目录 |

## 6. 课表解析器说明

解析器支持两类 HTML：

1. 教务系统直接保存的原始 HTML。
2. 浏览器“查看源代码”后保存的带 `line-wrap` 包装 HTML。

解析器会读取：

```html
<table id="kbtable">
```

课表文件需要包含该表格，否则会报错：

```text
Could not find #kbtable in source HTML.
```

课程时间段目前由 `scripts/build-data.js` 中的 `TIME_SLOT_MAP` 定义。如果教务系统增加或修改节次，需要同步修改该映射。

## 7. 前端本地数据

浏览器使用 `localStorage` 保存以下内容：

| Key | 内容 |
| --- | --- |
| `classroom-favorites` | 收藏的教室编号 |
| `classroom-recent-queries` | 最近查询条件（查询状态通过 URL 稳定保持 5 秒后才写入） |
| `classroom-dismissed-notifications` | 已关闭的通知编号 |

如果调试时发现旧筛选条件、收藏或通知状态影响页面，可以在浏览器控制台执行：

```js
localStorage.removeItem("classroom-favorites");
localStorage.removeItem("classroom-recent-queries");
localStorage.removeItem("classroom-dismissed-notifications");
```

## 8. 修改功能时的建议

修改筛选逻辑时，重点检查以下内容：

- `filteredRooms`
- `availableRooms`
- `courseResults`
- `getRoomEntries`
- `getRoomEntriesForPeriods`

修改时间或周次逻辑时，重点检查：

- `getAcademicWeek`
- `getRoomDateValue`
- `getTemporalFromDate`
- `getAutoTemporalState`

修改课室详情时，重点检查：

- `RoomCard`
- `RoomDialog`
- `getWeeklyRoomOverview`
- `getNextCourse`

新增配置项时，需要同时修改：

1. `DEFAULT_SETTINGS`。
2. `public/data/setting.json`。
3. 配置读取时的类型归一化逻辑。
4. 实际使用配置的组件或逻辑。

## 9. 部署流程

推荐流程：

```bash
npm run update-data
```

然后将 `dist/` 目录部署到静态服务器。

如果网页仍显示旧课表，依次检查：

1. `public/data/v2/` 是否已经更新。
2. `dist/data/v2/` 是否已经更新。
3. 浏览器是否需要强制刷新。
4. 静态服务器是否缓存了旧 JSON。

生产服务器建议为以下 JSON 文件设置较短缓存时间或使用重新部署后的缓存刷新策略：

```text
/data/setting.json
/data/v2/manifest.json
```

## 10. 快速更新清单

以后更新课表时只需要：

```text
1. 将新的 kbxx_classroom_ifr_*.html、kbxx_kc_ifr_*.html、kbxx_teacher_ifr_*.html 和 kbxx_xzb_ifr_*.html 放到 `.source-data/`。
2. 执行 npm run update-data。
3. 执行 npm run verify-data-v2。
4. 检查构建输出的教室数量、课程事件数量和 v2 统计。
5. 部署 dist/ 目录。
6. 浏览器强制刷新并检查当前学期起始日期配置。
```
