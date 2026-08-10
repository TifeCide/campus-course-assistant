# 分析结论

  当前用户端的首要瓶颈是数据加载与解析，不是 JS/CSS 包体积。

  - 生产 JS：275.8KB，gzip 83.3KB
  - CSS：44.4KB，gzip 8.8KB
  - 首屏同时读取两份 JSON：原始共 12.6MB；Brotli 约 281KB，但浏览器仍须解压、完整 JSON 解析并保留对象。
  - schedule-index.json 中 entries、courseEntries、teacherEntries 合计约 5.78MB，存在较明显的数据重复。

  npm run build 已通过，无 bundle size 告警。

  最高优先级

  1. 分阶段加载数据
     /D:/Projects/campus-course-assistant/src/App.jsx:2200 使用 Promise.all，导致“空闲教室”首屏必须等待课程、教师、班级索引完成。
     应先加载 classroom-data.json + setting.json 并渲染教室页；仅在切换课程/教师/班级视图、打开命令面板时再加载 schedule-index.json。这会直接缩短可交互时间并减少无效流量。

  2. 重构 schedule-index.json
     /D:/Projects/campus-course-assistant/scripts/parse-schedule.js:201 输出三套记录数组。建议先校验 entries 是否能完整覆盖课程与教师查询；若可行，保留一份规范化课程记录，并生成
     byCourse、byTeacher、byClass 的 ID 索引。
     收益不仅是传输体积，更重要的是降低 JSON 解析、内存占用和 GC 压力。

  3. 为数据文件引入版本化缓存
     当前 /data/*.json 文件名固定，缓存策略只能设得较短，更新与命中率互相冲突。
     建议发布 data-manifest.json（短缓存），由它指向带 hash 的数据文件，例如 schedule-index.abc123.json（Cache-Control: public, max-age=31536000, immutable）。首屏只校验很小的
     manifest，历史数据可长期复用缓存。

  交互性能

  4. 去掉根组件每秒更新
     /D:/Projects/campus-course-assistant/src/App.jsx:2270 每秒 setCurrentNow 一次；根组件重渲染时，当前可见的全部 RoomCard 都会参与 reconciliation。
     时钟只显示到分钟，应改为按分钟对齐更新；或抽成独立的时钟组件。再将 /D:/Projects/campus-course-assistant/src/App.jsx:978 用 React.memo 包装，并确保收藏/打开回调稳定。

  5. 限制无关视图的全量检索
     /D:/Projects/campus-course-assistant/src/App.jsx:2440 无论当前是否处于课程页都会扫描 courseEntries。只在课程视图或命令面板打开时计算。
     教师/班级结果也建议使用 useDeferredValue 或 150-250ms 防抖；再配合上面的索引，可避免每次输入扫描数千到上万条记录。

  6. 缓存实体详情查询
     /D:/Projects/campus-course-assistant/src/App.jsx:1731 实体弹窗每次重渲染都会从源数组过滤对应实体。预先建立 Map<实体名, entries[]>，可避免弹窗打开后重复扫描。

  7. 视口外内容延迟渲染
     /D:/Projects/campus-course-assistant/src/App.jsx:3050 会直接渲染全部匹配教室卡片。当前 283 间尚可，但移动端和未来数据增长会明显影响布局与滚动。
     优先尝试 content-visibility: auto；若数据继续增长，再使用虚拟列表或按楼栋展开渲染。

  资源与渲染

  8. 优化第三方字体与统计脚本
     /D:/Projects/campus-course-assistant/src/styles.css:1 的 CSS @import 会额外串行请求 Google Fonts。改为 HTML 的 preconnect + stylesheet，或自托管必要字重并使用 font-display:
     swap。
     /D:/Projects/campus-course-assistant/index.html:13 的 51.LA 脚本在 <head> 中同步执行，建议异步并在首屏稳定后加载，避免第三方网络影响 LCP/TBT。

  9. 控制模糊效果
     /D:/Projects/campus-course-assistant/src/styles.css:95 的固定顶部 backdrop-filter 会增加滚动合成成本。可在低端设备、小屏或 prefers-reduced-motion 下退化为半透明纯色背景。

  非用户运行时问题

  根目录四个原始课表 HTML 合计约 90MB，且被 Git 跟踪。它们不会进入 dist，不影响访问者，但会拖慢 clone、CI checkout 和部署构建。可将原始文件移至 Git LFS、构建专用存储，或让 CI 直接
  使用已生成的数据文件。

  建议实施顺序：分阶段加载 -> 数据去重/索引 -> 版本化缓存 -> 时钟与列表渲染优化。

# 数据结构更换：
  根目录实际有 4 个 kbxx_*.html 源文件。它们应当从“运行时依赖”变成“离线构建输入”，不应继续影响主仓库 clone、CI checkout 或网页首次加载。

  我建议不要简单地把当前两个大 JSON 拆成“4 个大 JSON”。更合理的是按用户操作路径拆分。

  data/v2/
    manifest.json
    common.json
    rooms.json
    availability/
      week-01.json
      ...
      week-18.json
    room-details/
      building-houde-a.json
      ...
    directory/
      index.json
      courses-00.json
      teachers-00.json
      classes-00.json

  数据职责

  - manifest.json：数据版本、hash、各文件 URL。短缓存。
  - common.json：学期、节次、星期、楼栋等公共配置。
  - rooms.json：教室 ID、名称、楼栋、楼层、区域等静态元数据，不含完整课表。
  - availability/week-xx.json：每周 7 天 × 6 节次的占用教室 ID 列表。默认页面只加载当前周对应文件。
  - room-details/*.json：按楼栋或固定数量教室分片，点击教室详情时才加载完整课程。
  - directory/index.json：课程、教师、班级的名称、ID、统计信息和所在分片，进入目录页时加载。
  - directory/*-xx.json：实体的详细课表，用户点击具体课程/教师/班级后再取。

  这样默认“教室”页不再下载课程、教师、班级目录，也不需要完整的每间教室课表。

  占用数据的推荐格式

  当前 weeks 数组、课程文本和重复字段占了大量 JSON 体积。教室列表页实际上只需判断“某教室在某周/星期/节次是否占用”。

  先从易维护的格式开始：

  {
    "week": 1,
    "slots": {
      "1-0102": [3, 17, 28],
      "1-0304": [5, 17],
      "2-0102": [3, 9]
    }
  }

  其中数组是被占用的 roomId。选择多节次时对这些数组做并集，再从全部教室中排除即可。

  后续如需继续压缩，可将每个时间段的占用情况编码成 bitset。项目只有 283 间教室，一个时间段仅需约 36 字节的位图；但这会提高解析和调试复杂度，建议在基础分片方案落地后再做。

  课程记录的规范化

  离线解析阶段应使用数字 ID 和紧凑字段，避免重复中文文本：

  {
    "r": 17,
    "c": 42,
    "t": 108,
    "g": 63,
    "d": 1,
    "p": 0,
    "w": 131071
  }

  - r/c/t/g 分别指向教室、课程、教师、班级字典。
  - d/p 是星期和节次索引。
  - w 是 18 周的位掩码，替代 weeks: [1,2,3,...]。
  - weekText、起止周、单双周标签可由位掩码在前端派生。

  目录页的索引只保留显示和筛选需要的信息，例如名称、统计数、详情分片位置；不要在索引里内嵌全部课程记录。

  解析脚本改造

  保留四份 HTML 作为解析输入，但让脚本输出多个模块化数据文件：

  1. parse-classrooms.js 输出 rooms.json、按周的 availability、按楼栋的 room-details。
  2. parse-schedule.js 输出实体名称索引和详情分片。
  3. 增加一个统一 build-data.js，负责 ID 字典、schema version、hash manifest 和跨文件一致性检查。
  4. 所有文件名加内容 hash，manifest.json 指向最新版本。

  源文件管理

  最实用的做法是将原始 HTML 放到 Git 忽略目录，例如 .source-data/，或单独的数据仓库/Release 附件中。主仓库仅保留解析脚本与生成后的 public/data/v2。

  目前 GitHub Actions 会解析课表，因此需要调整为：

  - 日常前端部署：直接使用已提交或下载的生成数据，不下载 90MB 原始 HTML。
  - 数据更新流程：专门的本地命令或手动工作流下载原始文件、生成数据、校验后提交数据产物。

  若这四个大文件已经进入 Git 历史，仅删除工作区文件无法减小 clone 体积；需要后续单独评估是否用 git filter-repo 清理历史并 force-push。

  迁移建议

  先并行生成 data/v2，保留旧格式。然后对 18 周、7 天、6 个节次的空闲教室结果做自动比对，同时比对课程、教师、班级查询结果。验证通过后切换前端读取 v2，最后删除旧 JSON 和根目录源文件
  依赖。

# 工作建议
public/
  └── data/
      └── v2/
          ├── manifest.json
          ├── common.json
          ├── rooms.json
          ├── availability.json
          ├── schedule.json
          └── directory.json
   1. manifest.json
   作用：
   版本入口 + 缓存控制
   这是唯一短缓存文件。
   2. common.json
   作用：
   公共字典数据："weekdays""timeSlots"等
   不会经常变。
   3. rooms.json
   作用：
   教室基础信息，注意"zone""building""floor""roomNumber"与原规则对应
   4. availability.json
   这个是最大优化点。
   作用：
   快速查询某时间有哪些教室被占用。
   5. schedule.json
   作用：
   保存完整课程记录。
   用于：
   教室详情
   课程查询
   老师查询
   班级查询
   这里不要存中文。
   设计：
   字典

   电科25B班,旅游25AB班,电信25A班,电信25B班,法学25CD班,法学25AB班,通信25A班,通信25B班,电科25A班,自动化25A班,自动化25B班,25日语A
