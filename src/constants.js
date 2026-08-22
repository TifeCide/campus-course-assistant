/*浏览器LocalStorage的键名，用于存储用户的收藏教室、最近查询和已关闭的通知等信息： */
export const FAVORITES_STORAGE_KEY = "classroom-favorites";
export const RECENT_QUERIES_STORAGE_KEY = "classroom-recent-queries";
export const DISMISSED_NOTIFICATIONS_STORAGE_KEY = "classroom-dismissed-notifications";

/*默认的周次、星期几和节次设置，以及考试周的数量： */
export const DEFAULT_WEEK = 1;
export const DEFAULT_WEEKDAY = 1;
export const DEFAULT_PERIOD = "0102";
export const EXAM_WEEK_COUNT = 3;
export const OCCUPIED_ENTRY = Object.freeze({ courseName: "课程安排", teacher: "", classGroup: "" });

/*默认的应用设置，包括学期开始和结束日期、信息显示模式、默认视图、搜索结果限制等： */
export const DEFAULT_SETTINGS = {
  semesterStartDate: "",
  semesterEndDate: "",
  infoDisplay: 1,
  maskMessage: {
    title: "内容已隐藏",
    text: "当前 infoDisplay = 0，results-section 已按配置遮罩。",
  },
  defaultView: "available",
  defaultOnlyAvailable: true,
  defaultPeriodMode: "single",
  searchResultLimit: 80,
  enableCommandPalette: true,
  enableBackToTop: true,
  stickyFilters: true,
  schoolTimeZone: "Asia/Shanghai",
  notify: [],
};
export const DEFAULT_MASK_MESSAGE = {
  title: "内容已隐藏",
  text: "当前 infoDisplay = 0，results-section 已按配置遮罩。",
};
export const SHANGHAI_TZ = "Asia/Shanghai";
