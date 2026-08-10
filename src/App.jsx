import React, { Component, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
/*从 lucide-react 导入所需的图标组件 */
import {
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock3,
  Command,
  Copy,
  Database,
  DoorOpen,
  Eye,
  EyeOff,
  Filter,
  Heart,
  History,
  Info,
  LayoutGrid,
  LoaderCircle,
  MapPin,
  PanelTop,
  Search,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  UserRound,
  ArrowUpToLine,
  Users,
  X,
  Github,
} from "lucide-react";

function BrandMarkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%" aria-hidden="true" focusable="false">
      <rect x="32" y="32" width="448" height="448" rx="100" fill="#1769e0" />
      <g fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round">
        <path d="M160 128V160" strokeWidth="28" />
        <path d="M352 128V160" strokeWidth="28" />
        <rect x="112" y="144" width="288" height="256" rx="32" strokeWidth="28" />
        <path d="M112 216H400" strokeWidth="24" opacity="0.9" />
        <circle cx="184" cy="272" r="14" fill="#FFFFFF" stroke="none" />
        <circle cx="256" cy="272" r="14" fill="#FFFFFF" stroke="none" opacity="0.4" />
        <circle cx="328" cy="272" r="14" fill="#FFFFFF" stroke="none" />
        <circle cx="184" cy="336" r="14" fill="#FFFFFF" stroke="none" opacity="0.4" />
        <circle cx="256" cy="336" r="16" fill="#7DD3FC" stroke="none" />
        <circle cx="328" cy="336" r="14" fill="#FFFFFF" stroke="none" opacity="0.4" />
      </g>
    </svg>
  );
}

/*使用不同的资源源可以提高访问速度和稳定性，尤其是在不同地区的用户访问时： */
const GITHUB_USER = 'TifeCide';
const GITHUB_REPO = 'campus-course-assistant';
const RESOURCE_SOURCES = {
  /* Cloudflare Pages */
  CF: import.meta.env.BASE_URL,
  
  /*JsDelivr CDN */
  JSD:
    `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@main/public/`,
  
  /* GitHub Pages */
  GHP:
    `https://tifecide.github.io/${GITHUB_REPO}/`,
};
const RESOURCE_SOURCE_LABELS = ["Cloudflare Pages", "JsDelivr CDN", "GitHub Pages"];

const DATA_URLS = [
  `${RESOURCE_SOURCES.CF}data/classroom-data.json`,
  `${RESOURCE_SOURCES.JSD}data/classroom-data.json`,
  `${RESOURCE_SOURCES.GHP}data/classroom-data.json`,
];

const SCHEDULE_URLS = [
  `${RESOURCE_SOURCES.CF}data/schedule-index.json`,
  `${RESOURCE_SOURCES.JSD}data/schedule-index.json`,
  `${RESOURCE_SOURCES.GHP}data/schedule-index.json`,
];

const SETTINGS_URLS = [
  `${RESOURCE_SOURCES.CF}data/setting.json`,
  `${RESOURCE_SOURCES.JSD}data/setting.json`,
  `${RESOURCE_SOURCES.GHP}data/setting.json`,
];

/* 按当前 public/data 文件大小估算整体加载进度，避免小设置文件占用虚假的进度比例。 */
const LOAD_RESOURCE_SIZE_ESTIMATES = {
  data: 6_843_889,
  schedule: 5_797_967,
  settings: 1_295,
};
const LOAD_TOTAL_SIZE = Object.values(LOAD_RESOURCE_SIZE_ESTIMATES).reduce((sum, size) => sum + size, 0);
const LOAD_RESOURCE_LABELS = {
  data: "数据文件",
  schedule: "课程索引",
  settings: "设置",
};

/*浏览器LocalStorage的键名，用于存储用户的收藏教室、最近查询和已关闭的通知等信息： */
const FAVORITES_STORAGE_KEY = "classroom-favorites";
const RECENT_QUERIES_STORAGE_KEY = "classroom-recent-queries";
const DISMISSED_NOTIFICATIONS_STORAGE_KEY = "classroom-dismissed-notifications";

/*默认的周次、星期几和节次设置，以及考试周的数量： */
const DEFAULT_WEEK = 1;
const DEFAULT_WEEKDAY = 1;
const DEFAULT_PERIOD = "0102";
const EXAM_WEEK_COUNT = 3;

/*默认的应用设置，包括学期开始和结束日期、信息显示模式、默认视图、搜索结果限制等： */
const DEFAULT_SETTINGS = {
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
const DEFAULT_MASK_MESSAGE = {
  title: "内容已隐藏",
  text: "当前 infoDisplay = 0，results-section 已按配置遮罩。",
};
const SHANGHAI_TZ = "Asia/Shanghai";
const BUILD_TIME = __BUILD_TIME__;

const cn = (...classes) => classes.filter(Boolean).join(" ");

/*读取和写入浏览器的 LocalStorage，处理 JSON 数据，并提供默认值以防止错误： */
function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

/* 写入 LocalStorage 时，使用 JSON.stringify 将值转换为字符串，并捕获可能的错误（例如在隐私模式下或嵌入环境中 LocalStorage 不可用）： */
function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage may be unavailable in private browsing or restricted embeds. */
  }
}

/* 获取通知类型，如果传入的值不是 "info"、"warning" 或 "error"，则默认返回 "info"： */
function getNotificationType(value) {
  return ["info", "warning", "error"].includes(value) ? value : "info";
}

/* 检查通知是否启用了双重提醒，接受布尔值或数字 1 表示启用： */
function isNotificationTwiceEnabled(value) {
  return value === true || Number(value) === 1;
}

/* 将通知对象标准化为统一的格式，确保所有必需字段存在且有效，并返回一个包含通知信息的对象： */
function normalizeNotification(value) {
  if (!value || typeof value !== "object") return null;

  const notifyNo = Number(value.notifyNo);
  const notifyStartDate = String(value.notifyStartDate ?? "").trim();
  const notifyEndDate = String(value.notifyEndDate ?? "").trim();
  const notifyTitle = String(value.notifyTitle ?? "").trim();
  const notifyText = String(value.notifyText ?? "").trim();

  if (!Number.isFinite(notifyNo) || !notifyTitle || !notifyText) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(notifyStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(notifyEndDate)) return null;

  const notifyType = getNotificationType(value.notifyType);
  const notifyInDate = Number(value.notifyInDate) === 1 ? 1 : 0;
  const notifyTwice = isNotificationTwiceEnabled(value.notifyTwice);
  const notificationKey = String(notifyNo);

  return {
    notifyNo,
    notifyType,
    notifyTitle,
    notifyText,
    notifyStartDate,
    notifyEndDate,
    notifyInDate,
    notifyTwice,
    notificationKey,
  };
}

/* 检查通知是否在指定日期范围内触发，默认使用当前日期。根据通知的开始和结束日期以及是否在日期范围内显示，返回布尔值： */
function isNotificationTriggered(notification, date = new Date()) {
  const currentDate = getShanghaiParts(date).dateLabel;
  const inRange = currentDate >= notification.notifyStartDate && currentDate <= notification.notifyEndDate;
  return notification.notifyInDate === 1 ? inRange : !inRange;
}

/* 获取已关闭通知的键集合，从 LocalStorage 中读取数据并返回一个 Set 对象，确保只包含字符串类型的键： */
function getDismissedNotificationKeys() {
  const value = readStorage(DISMISSED_NOTIFICATIONS_STORAGE_KEY, {});
  if (Array.isArray(value)) return new Set(value.filter((key) => typeof key === "string"));
  if (!value || typeof value !== "object") return new Set();
  return new Set(Object.keys(value).filter((key) => value[key] === true));
}

/* 将通知标记为已关闭，并将其键存储在 LocalStorage 中，以便在后续访问中不再显示该通知： */
function dismissNotificationPersistently(notificationKey) {
  const value = readStorage(DISMISSED_NOTIFICATIONS_STORAGE_KEY, {});
  const dismissed = value && !Array.isArray(value) && typeof value === "object" ? value : {};
  dismissed[notificationKey] = true;
  writeStorage(DISMISSED_NOTIFICATIONS_STORAGE_KEY, dismissed);
}

/* 将日期时间值格式化为 "YYYY-MM-DD HH:mm:ss" 的字符串，使用上海时区进行格式化。如果输入值无效或无法解析，则返回 "未知"： */
function formatDateTime(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

/* 将数值限制在指定的最小值和最大值之间，如果数值小于最小值则返回最小值，大于最大值则返回最大值，否则返回原始数值： */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getOverallLoadProgress(resourceProgresses) {
  const loadedSize = Object.entries(LOAD_RESOURCE_SIZE_ESTIMATES).reduce(
    (total, [resourceKey, resourceSize]) =>
      total + resourceSize * clamp(Number(resourceProgresses[resourceKey]) || 0, 0, 1),
    0,
  );
  return clamp(loadedSize / LOAD_TOTAL_SIZE, 0, 1);
}

/* 将数值格式化为两位数的字符串，如果数值小于 10，则在前面补零： */
function pad2(value) {
  return String(value).padStart(2, "0");
}

/* 将时间字符串（格式为 "HH:mm"）转换为总分钟数，方便进行时间比较和计算： */
function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
}

/* 获取指定日期在上海时区的各个时间部分，包括年、月、日、小时、分钟、星期几索引以及格式化的日期和时间标签。如果无法使用国际化 API，则使用本地时间作为回退： */
function getShanghaiParts(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: SHANGHAI_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    });

    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      weekdayIndex: weekdayMap[parts.weekday] ?? 1,
      dateLabel: `${parts.year}-${parts.month}-${parts.day}`,
      timeLabel: `${parts.hour}:${parts.minute}`,
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      weekdayIndex: ((date.getDay() + 6) % 7) + 1,
      dateLabel: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
      timeLabel: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
    };
  }
}

/* 创建一个指定日期和时间的上海时区 Date 对象，使用 ISO 8601 格式的字符串表示，并在末尾添加 "+08:00" 时区偏移： */
function getShanghaiDate(year, month, day, hour = 0, minute = 0) {
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00+08:00`);
}

/* 获取指定年份的九月的第一个星期一，如果九月一日不是星期一，则向后查找直到找到第一个星期一： */
function getFirstMondayOfSeptember(year) {
  let candidate = getShanghaiDate(year, 9, 1);
  for (let index = 0; index < 7; index += 1) {
    if (getShanghaiParts(candidate).weekdayIndex === 1) return candidate;
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  return candidate;
}

/* 将日期字符串（格式为 "YYYY-MM-DD"）解析为上海时区的 Date 对象，并将时间设置为中午 12 点。如果输入无效或无法解析，则返回 null： */
function parseDateAtShanghaiNoon(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return getShanghaiDate(Number(match[1]), Number(match[2]), Number(match[3]), 12, 0);
}

/* 根据指定的日期和学期开始日期，计算当前的学术周次。如果当前日期在学期开始之前，则返回第 1 周；否则，根据日期差计算当前周次，并确保返回值不小于 1： */
function getAcademicWeek(date = new Date(), semesterStartDate = "") {
  const parts = getShanghaiParts(date);
  const termStart = parseDateAtShanghaiNoon(semesterStartDate) ?? getFirstMondayOfSeptember(parts.year);
  const current = getShanghaiDate(parts.year, parts.month, parts.day, 12, 0);

  if (current < termStart) return 1;

  const diffDays = Math.floor((current - termStart) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/* 根据指定的日期和学期设置，确定当前的学术阶段（教学周、考试周或假期）。如果当前日期在学期开始和结束之间，则返回教学阶段；如果在考试周范围内，则返回考试阶段；否则，返回假期阶段： */
function getAcademicPhase(date = new Date(), settings = {}) {
  const semesterStart = parseDateAtShanghaiNoon(settings?.semesterStartDate);
  const semesterEnd = parseDateAtShanghaiNoon(settings?.semesterEndDate);

  if (!semesterStart || !semesterEnd || semesterEnd < semesterStart) {
    return null;
  }

  const parts = getShanghaiParts(date);
  const current = getShanghaiDate(parts.year, parts.month, parts.day, 12, 0);
  const examStart = new Date(semesterEnd.getTime() + 24 * 60 * 60 * 1000);
  const examEnd = new Date(
    examStart.getTime() + (EXAM_WEEK_COUNT * 7 - 1) * 24 * 60 * 60 * 1000,
  );

  if (current >= semesterStart && current <= semesterEnd) {
    return { type: "teaching", label: "" };
  }

  if (current >= examStart && current <= examEnd) {
    return { type: "exam", label: "考试周" };
  }

  return { type: "holiday", label: "假期" };
}

/* 根据当前时间和提供的时间段列表，确定当前所在的节次代码。如果当前时间不在任何时间段内，则返回下一个即将开始的节次代码；如果没有下一个节次，则返回最后一个节次代码： */
function getCurrentPeriodCode(timeSlots, date = new Date()) {
  if (!timeSlots?.length) return DEFAULT_PERIOD;

  const parts = getShanghaiParts(date);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const currentSlot = timeSlots.find((slot) => {
    const start = timeToMinutes(slot.start);
    const end = timeToMinutes(slot.end);
    return currentMinutes >= start && currentMinutes < end;
  });

  if (currentSlot) return currentSlot.code;

  const upcomingSlot = timeSlots.find((slot) => currentMinutes < timeToMinutes(slot.start));
  return upcomingSlot?.code ?? timeSlots[timeSlots.length - 1].code;
}

/* 根据提供的数据、设置和日期，自动生成当前的学术周次、星期几、学术阶段、节次代码以及格式化的日期和时间标签。返回一个包含这些信息的对象： */
function getAutoTemporalState(data, settings, date = new Date()) {
  const parts = getShanghaiParts(date);
  const week = clamp(getAcademicWeek(date, settings?.semesterStartDate), 1, data?.summary?.maxWeek ?? 18);
  const phase = getAcademicPhase(date, settings);

  return {
    week,
    weekday: parts.weekdayIndex,
    phase: phase?.type ?? "unknown",
    phaseLabel: phase?.label ?? "",
    period: getCurrentPeriodCode(data?.timeSlots ?? [], date),
    dateLabel: `${parts.year}年${parts.month}月${parts.day}日`,
    timeLabel: parts.timeLabel,
  };
}

/* 获取指定教室在特定周次、星期几和节次代码下的所有课程条目。如果教室或相关数据不存在，则返回一个空数组： */
function getRoomEntries(room, weekday, periodCode, week) {
  return room?.slots?.[String(weekday)]?.[periodCode]?.filter((entry) => entry.weeks.includes(Number(week))) ?? [];
}

/* 获取指定教室在特定周次、星期几和多个节次代码下的所有课程条目。通过调用 getRoomEntries 函数并将结果展平为一个数组返回： */
function getRoomEntriesForPeriods(room, weekday, periodCodes, week) {
  return periodCodes.flatMap((periodCode) => getRoomEntries(room, weekday, periodCode, week));
}

/* 异步函数，用于从指定的 URL 获取 JSON 数据，并在下载过程中提供进度回调。如果响应不包含内容长度或流式读取不可用，则直接解析 JSON；否则，使用流式读取并计算下载进度，最终返回解析后的 JSON 对象： */
async function fetchJsonWithProgress(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`加载失败：${url}`);

  if (!response.body || !response.headers.get("content-length")) {
    const value = await response.json();
    onProgress?.(1);
    return value;
  }

  const total = Number(response.headers.get("content-length"));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
    onProgress?.(Math.min(received / total, 0.98));
  }

  text += decoder.decode();
  const value = JSON.parse(text);
  onProgress?.(1);
  return value;
}

async function fetchJsonFromUrls(urls, { onProgress, onFallback } = {}) {
  let lastError = null;
  let highestProgress = 0;

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    try {
      return await fetchJsonWithProgress(url, (progress) => {
        highestProgress = Math.max(highestProgress, progress);
        onProgress?.(highestProgress);
      });
    } catch (error) {
      lastError = error;
      if (index < urls.length - 1) {
        onFallback?.({
          sourceIndex: index,
          nextSourceIndex: index + 1,
          url,
          nextUrl: urls[index + 1],
          error,
        });
      }
    }
  }

  throw lastError ?? new Error("加载失败");
}

/* 创建一个查询快照对象，包含当前的视图、时间模式、选定的周次、星期几、日期、节次、建筑物、楼层、区域以及搜索查询和实体标签等信息。返回一个包含这些信息的对象： */
function createQuerySnapshot({
  activeView,
  temporalMode,
  selectedWeek,
  selectedWeekday,
  selectedDate,
  selectedPeriods,
  periodSelectionMode,
  onlyAvailable,
  selectedBuildings,
  selectedFloors,
  selectedZones,
  query,
  entityLabel = "",
}) {
  return {
    activeView,
    temporalMode,
    selectedWeek,
    selectedWeekday,
    selectedDate,
    selectedPeriods,
    periodSelectionMode,
    onlyAvailable,
    selectedBuildings,
    selectedFloors,
    selectedZones,
    query,
    entityLabel,
  };
}

/* 从 URL 查询字符串中解析出查询快照对象，提取视图、时间模式、周次、星期几、日期、节次、建筑物、楼层、区域以及搜索查询和实体标签等信息。返回一个包含这些信息的对象： */
function getQuerySnapshotFromUrl(search) {
  const params = new URLSearchParams(search);
  const parseList = (key) => params.get(key)?.split(",").filter(Boolean) ?? [];

  return {
    activeView: ["available", "courses", "teachers", "classes"].includes(params.get("view"))
      ? params.get("view")
      : "available",
    temporalMode: params.get("mode") === "date" ? "date" : "week",
    selectedWeek: Number(params.get("week")) || DEFAULT_WEEK,
    selectedWeekday: Number(params.get("weekday")) || DEFAULT_WEEKDAY,
    selectedDate: params.get("date") || "",
    selectedPeriods: parseList("periods").length ? parseList("periods") : [DEFAULT_PERIOD],
    periodSelectionMode: params.get("periodMode") === "multiple" ? "multiple" : "single",
    onlyAvailable: params.get("available") !== "0",
    selectedBuildings: parseList("buildings"),
    selectedFloors: parseList("floors"),
    selectedZones: parseList("zones"),
    query: params.get("q") || "",
    entityLabel: params.get("entity") || "",
  };
}

/* 根据视图类型返回对应的标签文本，如果视图类型不在预定义的列表中，则默认返回 "教室"： */
function getViewLabel(view) {
  return {
    available: "教室",
    courses: "课程",
    teachers: "教师",
    classes: "班级",
  }[view] || "教室";
}

/* 根据视图类型返回对应的搜索标签文本，如果视图类型不在预定义的列表中，则默认返回 "搜索教室"： */
function getViewSearchLabel(view) {
  return {
    available: "搜索教室",
    courses: "搜索课程",
    teachers: "搜索教师",
    classes: "搜索行政班",
  }[view] || "搜索教室";
}

/* 将视图类型标准化为预定义的列表中的值，如果不在列表中，则默认返回 "available"： */
function normalizeView(value) {
  return ["available", "courses", "teachers", "classes"].includes(value) ? value : "available";
}

/*根据查询快照对象生成对应的 URL 查询字符串，包含视图、时间模式、周次、星期几、日期、节次、建筑物、楼层、区域以及搜索查询和实体标签等信息。返回一个完整的 URL 字符串，包括路径、查询参数和哈希值： */
function getQueryUrl(snapshot) {
  const params = new URLSearchParams();

  if (snapshot.activeView !== "available") params.set("view", snapshot.activeView);
  if (snapshot.temporalMode === "date") {
    params.set("mode", "date");
    if (snapshot.selectedDate) params.set("date", snapshot.selectedDate);
  } else {
    if (snapshot.selectedWeek !== DEFAULT_WEEK) params.set("week", String(snapshot.selectedWeek));
    if (snapshot.selectedWeekday !== DEFAULT_WEEKDAY) params.set("weekday", String(snapshot.selectedWeekday));
  }
  if (snapshot.selectedPeriods.join(",") !== DEFAULT_PERIOD) {
    params.set("periods", snapshot.selectedPeriods.join(","));
  }
  if (snapshot.periodSelectionMode === "multiple") params.set("periodMode", "multiple");
  if (!snapshot.onlyAvailable) params.set("available", "0");
  if (snapshot.selectedBuildings.length) params.set("buildings", snapshot.selectedBuildings.join(","));
  if (snapshot.selectedFloors.length) params.set("floors", snapshot.selectedFloors.join(","));
  if (snapshot.selectedZones.length) params.set("zones", snapshot.selectedZones.join(","));
  if (snapshot.query) params.set("q", snapshot.query);
  if (snapshot.entityLabel) params.set("entity", snapshot.entityLabel);

  const queryString = params.toString();
  return `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
}

/* 根据查询快照对象和数据生成最近查询的标签文本。如果存在实体标签，则返回视图类型和实体标签的组合；否则，根据选定的周次、星期几、节次和位置范围生成一个描述性的标签文本： */
function getRecentQueryLabel(snapshot, data) {
  if (snapshot.entityLabel) {
    const viewLabel = snapshot.activeView === "courses" ? "课程" : snapshot.activeView === "teachers" ? "教师" : "班级";
    return `${viewLabel} · ${snapshot.entityLabel}`;
  }
  const day = data?.weekdays.find((item) => item.index === Number(snapshot.selectedWeekday));
  const periods = snapshot.selectedPeriods.join("、");
  const scope = [
    ...snapshot.selectedBuildings,
    ...snapshot.selectedFloors.map((floor) => `${floor}层`),
    ...snapshot.selectedZones.map((zone) => zone.replace("普通教学区", "教学区")),
  ];
  const location = scope.length ? scope.join("、") : "全部范围";
  const time = snapshot.temporalMode === "date"
    ? snapshot.selectedDate || "日期"
    : `第${snapshot.selectedWeek}周 ${day?.shortLabel ?? ""}`;
  return `${time} · ${periods} · ${location}`;
}

/* 获取指定教室在当前时间之后的下一个课程条目。如果教室或数据不存在，则返回 null。通过计算当前节次的位置，并遍历所有时间段和星期几，找到下一个课程条目并返回： */
function getNextCourse(room, data, week, weekday, periodCodes) {
  if (!room || !data) return null;

  const currentSlotIndex = Math.max(
    0,
    data.timeSlots.findIndex((slot) => slot.code === periodCodes[0]),
  );
  const currentPosition = (Number(weekday) - 1) * data.timeSlots.length + currentSlotIndex;
  const occurrences = [];

  data.weekdays.forEach((day) => {
    data.timeSlots.forEach((slot, slotIndex) => {
      const entries = getRoomEntries(room, day.index, slot.code, week);
      entries.forEach((entry) => {
        occurrences.push({
          entry,
          day,
          slot,
          position: (day.index - 1) * data.timeSlots.length + slotIndex,
        });
      });
    });
  });

  occurrences.sort((a, b) => a.position - b.position);
  return (
    occurrences.find((item) => item.position > currentPosition) ??
    occurrences[0] ??
    null
  );
}

/* 获取指定教室在一周内的概览信息，包括每个星期几的总节次、已占用节次和空闲节次。返回一个包含每个星期几概览信息的数组： */
function getWeeklyRoomOverview(room, data, week) {
  return data.weekdays.map((day) => {
    const total = data.timeSlots.length;
    const occupied = data.timeSlots.filter(
      (slot) => getRoomEntries(room, day.index, slot.code, week).length > 0,
    ).length;
    return {
      ...day,
      total,
      occupied,
      free: total - occupied,
    };
  });
}

/* 根据指定的学术周次、星期几和学期开始日期，计算对应的日期值（格式为 "YYYY-MM-DD"）。如果学期开始日期无效，则使用指定的回退年份来计算九月的第一个星期一作为学期开始日期。返回一个格式化的日期字符串： */
function getRoomDateValue(week, weekday, semesterStartDate, fallbackYear = new Date().getFullYear()) {
  const start = parseDateAtShanghaiNoon(semesterStartDate) ?? getFirstMondayOfSeptember(fallbackYear);
  const offsetDays = (Number(week) - 1) * 7 + (Number(weekday) - 1);
  const date = new Date(start.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = getShanghaiParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/* 根据学期开始日期和最大周次，计算学期的日期范围（最小日期和最大日期）。如果学期开始日期无效，则使用指定的回退年份来计算九月的第一个星期一作为学期开始日期。返回一个包含最小日期和最大日期的对象： */
function getDateRange(semesterStartDate, maxWeek, fallbackYear = new Date().getFullYear()) {
  const start = parseDateAtShanghaiNoon(semesterStartDate) ?? getFirstMondayOfSeptember(fallbackYear);
  const end = new Date(start.getTime() + (Number(maxWeek) * 7 - 1) * 24 * 60 * 60 * 1000);
  const startParts = getShanghaiParts(start);
  const endParts = getShanghaiParts(end);
  return {
    min: `${startParts.year}-${pad2(startParts.month)}-${pad2(startParts.day)}`,
    max: `${endParts.year}-${pad2(endParts.month)}-${pad2(endParts.day)}`,
  };
}

/* 根据指定的日期值（格式为 "YYYY-MM-DD"）、学期开始日期和最大周次，计算对应的学术周次和星期几。如果日期值无效或无法解析，则返回 null。返回一个包含学术周次和星期几索引的对象： */
function getTemporalFromDate(value, semesterStartDate, maxWeek) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = getShanghaiDate(Number(match[1]), Number(match[2]), Number(match[3]), 12, 0);
  return {
    week: clamp(getAcademicWeek(date, semesterStartDate), 1, Number(maxWeek)),
    weekday: getShanghaiParts(date).weekdayIndex,
  };
}

/* 比较两个教室对象的排序顺序，首先按建筑物名称进行拼音排序，如果建筑物相同，则按楼层数字排序，如果楼层也相同，则按教室名称进行拼音排序。返回一个整数值，用于确定排序顺序： */
function compareRooms(a, b) {
  const buildingDiff = a.building.localeCompare(b.building, "zh-Hans-u-co-pinyin");
  if (buildingDiff !== 0) return buildingDiff;
  const floorDiff = Number(a.floor) - Number(b.floor);
  if (floorDiff !== 0) return floorDiff;
  return a.name.localeCompare(b.name, "zh-Hans-u-co-pinyin", { numeric: true });
}


/* 将教室列表按建筑物和楼层进行分组，返回一个包含建筑物、楼层和教室信息的数组。首先按建筑物名称进行拼音排序，然后按楼层数字排序，最后按教室名称进行拼音排序。每个建筑物对象包含楼层信息，每个楼层对象包含对应的教室列表： */
function groupRoomsByBuildingAndFloor(rooms) {
  const buildingMap = new Map();

  for (const room of [...rooms].sort(compareRooms)) {
    if (!buildingMap.has(room.building)) {
      buildingMap.set(room.building, { building: room.building, floors: new Map(), total: 0 });
    }

    const building = buildingMap.get(room.building);
    building.total += 1;

    if (!building.floors.has(room.floor)) {
      building.floors.set(room.floor, []);
    }
    building.floors.get(room.floor).push(room);
  }

  return [...buildingMap.values()]
    .sort((a, b) => a.building.localeCompare(b.building, "zh-Hans-u-co-pinyin"))
    .map((building) => ({
      ...building,
      floors: [...building.floors.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([floor, floorRooms]) => ({
          floor,
          rooms: [...floorRooms].sort(compareRooms),
        })),
    }));
}

/* 获取唯一且排序后的值列表，首先使用 Set 去重，然后按拼音顺序进行排序。如果值是数字或字符串，则按字符串形式进行比较，并使用中文拼音排序规则： */
function getUniqueSorted(values) {
  return [...new Set(values)].sort((a, b) =>
    String(a).localeCompare(String(b), "zh-Hans-u-co-pinyin", { numeric: true }),
  );
}

/* 创建一个选择字段组件，接受标签、值、选项和图标作为属性，并在值变化时调用回调函数。渲染一个带有标签和下拉选择框的表单字段，如果提供了图标，则在选择框前显示图标： */
function SelectField({ label, value, onChange, options, icon: Icon }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="select-wrap">
        {Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="select-chevron" size={15} />
      </span>
    </label>
  );
}

/* 创建一个多选字段组件，接受标签、值、选项和图标作为属性，并在值变化时调用回调函数。渲染一个带有标签和下拉菜单的表单字段，允许用户选择多个选项，并在选择框中显示已选择的标签。如果提供了图标，则在选择框前显示图标： */
function MultiSelectField({ label, values, onChange, options, icon: Icon, placeholder = "全部" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedSet = new Set(values);
  const selectedLabels = options
    .filter((option) => selectedSet.has(option.value))
    .map((option) => option.label);
  const displayText = selectedLabels.length ? selectedLabels.join("、") : placeholder;

  function toggleValue(value) {
    if (selectedSet.has(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  }

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="field multi-select-field">
      <span className="field-label">{label}</span>
      <div className="multi-select-root" ref={rootRef}>
        <button
          className={cn("multi-select-trigger", open && "is-open")}
          onClick={() => setOpen((value) => !value)}
          type="button"
          aria-expanded={open}
        >
          {Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
          <span title={displayText}>{displayText}</span>
          <ChevronDown className="select-chevron" size={15} />
        </button>
        {open ? (
          <div className="multi-select-menu">
            <button className={cn("multi-select-option", values.length === 0 && "is-selected")} onClick={() => onChange([])} type="button">
              <span className="check-box">{values.length === 0 ? <Check size={13} /> : null}</span>
              <span>{placeholder}</span>
            </button>
            {options.map((option) => {
              const selected = selectedSet.has(option.value);
              return (
                <button className={cn("multi-select-option", selected && "is-selected")} key={option.value} onClick={() => toggleValue(option.value)} type="button">
                  <span className="check-box">{selected ? <Check size={13} /> : null}</span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* 创建一个切换开关组件，接受选中状态、变化回调和标签作为属性，并在点击时切换选中状态。渲染一个带有标签和按钮的切换开关，如果选中则显示为激活状态： */
function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle-control">
      <button
        className={cn("toggle-track", checked && "is-checked")}
        onClick={() => onChange(!checked)}
        type="button"
        aria-pressed={checked}
      >
        <span />
      </button>
      <span>{label}</span>
    </label>
  );
}

/* 创建一个时间选择器组件，允许用户在周次模式和日期模式之间切换，并选择特定的周次、星期几或日期。根据当前模式渲染相应的选择字段，并提供快速选择当前时间的按钮： */
function TemporalPicker({
  mode,
  onToday,
  onModeChange,
  selectedWeek,
  selectedWeekday,
  selectedDate,
  onWeekChange,
  onWeekdayChange,
  onDateChange,
  weekdays,
  maxWeek,
  dateRange,
}) {
  return (
    <div className="temporal-picker">
      {onToday ? (
        <div className="temporal-now-row">
          <button className="button button-outline panel-now-button" onClick={onToday} type="button">
            快速选择当前时间
          </button>
        </div>
      ) : null}
      <div className="field-label-row">
        <span className="field-label">日期选择</span>
        <div className="binary-toggle" role="group" aria-label="周次或日期">
          <button className={cn(mode === "week" && "is-active")} onClick={() => onModeChange("week")} type="button">
            周次
          </button>
          <button className={cn(mode === "date" && "is-active")} onClick={() => onModeChange("date")} type="button">
            日期
          </button>
        </div>
      </div>

      {mode === "week" ? (
        <div className="temporal-fields">
          <SelectField
            label=""
            value={String(selectedWeek)}
            onChange={(value) => onWeekChange(Number(value))}
            icon={CalendarDays}
            options={Array.from({ length: maxWeek }, (_, index) => ({
              value: String(index + 1),
              label: `第 ${index + 1} 周`,
            }))}
          />
          <SelectField
            label=""
            value={String(selectedWeekday)}
            onChange={(value) => onWeekdayChange(Number(value))}
            options={weekdays.map((day) => ({ value: String(day.index), label: day.label }))}
          />
        </div>
      ) : (
        <label className="date-input-wrap">
          <CalendarDays size={16} />
          <input
            type="date"
            value={selectedDate}
            min={dateRange.min}
            max={dateRange.max}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </label>
      )}
    </div>
  );
}

/* 创建一个节次选择器组件，允许用户在单选和多选模式之间切换，并选择特定的节次。根据当前模式渲染相应的节次按钮，并在点击时切换选中状态： */
function PeriodPicker({ timeSlots, selectedPeriods, selectionMode, onModeChange, onChange }) {
  /* 切换节次的选中状态，根据当前的选择模式（单选或多选）更新选中的节次列表，并调用 onChange 回调函数传递新的选中节次： */
  function togglePeriod(code) {
    if (selectionMode === "single") {
      onChange([code]);
      return;
    }

    const next = selectedPeriods.includes(code)
      ? selectedPeriods.filter((selectedCode) => selectedCode !== code)
      : [...selectedPeriods, code];
    onChange(next.length ? next : [code]);
  }

  return (
    <div className="period-picker">
      <div className="field-label-row">
        <span className="field-label">节次</span>
        <div className="binary-toggle" role="group" aria-label="节次单选或多选">
          <button className={cn(selectionMode === "single" && "is-active")} onClick={() => onModeChange("single")} type="button">
            单选
          </button>
          <button className={cn(selectionMode === "multiple" && "is-active")} onClick={() => onModeChange("multiple")} type="button">
            多选
          </button>
        </div>
      </div>
      <div className="period-options">
        {timeSlots.map((slot) => {
          const selected = selectedPeriods.includes(slot.code);
          return (
            <button className={cn("period-option", selected && "is-selected")} onClick={() => togglePeriod(slot.code)} type="button" key={slot.code}>
              <span>{slot.label}</span>
              <small>
                {slot.start}-{slot.end}
              </small>
              {selected ? <Check size={14} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 创建一个统计卡片组件，显示图标、标签、数值和详细信息，并根据指定的色调渲染不同的样式。接受图标组件、标签文本、数值、详细信息和色调作为属性： */
function StatCard({ icon: Icon, label, value, detail, tone = "blue" }) {
  return (
    <div className="stat-card">
      <div className={cn("stat-icon", `stat-icon-${tone}`)}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

/* 创建一个教室卡片组件，显示教室的占用状态、名称、建筑物、楼层、区域以及收藏状态。接受教室对象、打开回调函数、选定的周次、星期几、节次、收藏状态和收藏切换回调函数作为属性： */
function RoomCard({
  room,
  onOpen,
  selectedWeek,
  selectedWeekday,
  selectedPeriods,
  isFavorite,
  onToggleFavorite,
}) {
  const occupied = getRoomEntriesForPeriods(room, selectedWeekday, selectedPeriods, selectedWeek);

  return (
    <article className="room-card">
      <button className="room-card-main" onClick={() => onOpen(room)} type="button">
        <div className="room-card-topline">
          <span className={cn("room-status", occupied.length && "is-busy")}>
            <span className="status-dot" />
            {occupied.length ? "占用" : "空闲"}
          </span>
          <ArrowUpRight size={17} />
        </div>
        <div className="room-name">{room.name}</div>
        <div className="room-meta">
          <span>{room.building}</span>
          <span className="meta-divider">/</span>
          <span>{room.floor} 层</span>
        </div>
        <div className="room-card-footer">
          <span>{room.zone.replace("普通教学区", "教学区")}</span>
          <span className="detail-link">查看课表</span>
        </div>
      </button>
      <button
        className={cn("room-favorite", isFavorite && "is-favorite")}
        onClick={() => onToggleFavorite(room.name)}
        type="button"
        aria-label={isFavorite ? `取消收藏 ${room.name}` : `收藏 ${room.name}`}
        title={isFavorite ? "取消收藏" : "收藏教室"}
      >
        <Heart size={15} fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

/* 创建一个空状态组件，根据是否存在查询条件显示不同的提示信息，并提供清除筛选或搜索的按钮。接受 hasQuery 和 onReset 作为属性： */
function EmptyState({ hasQuery, onReset }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <DoorOpen size={28} strokeWidth={1.5} />
      </div>
      <h3>{hasQuery ? "没有符合条件的教室" : "当前时段暂无符合条件的教室"}</h3>
      <p>
        {hasQuery
          ? "试试减少筛选条件，或切换楼栋、楼层和区域。"
          : "可以点击“现在”重新定位到当前日期与节次。"}
      </p>
      {hasQuery ? (
        <button className="button button-outline" onClick={onReset} type="button">
          清除筛选
        </button>
      ) : null}
    </div>
  );
}

/* 创建一个目录空状态组件，根据当前视图类型和是否存在查询条件显示不同的提示信息，并提供清除搜索的按钮。接受 view、hasQuery 和 onReset 作为属性： */
function DirectoryEmptyState({ view, hasQuery, onReset }) {
  const label = view === "courses" ? "课程" : view === "teachers" ? "教师" : "班级";
  return (
    <div className="empty-state">
      <div className="empty-mark">
        {view === "courses" ? <BookOpen size={28} strokeWidth={1.5} /> : view === "teachers" ? <UserRound size={28} strokeWidth={1.5} /> : <Users size={28} strokeWidth={1.5} />}
      </div>
      <h3>{hasQuery ? `没有符合条件的${label}` : `输入${label}名称开始查询`}</h3>
      <p>{hasQuery ? "试试减少关键词，或调整地点筛选。" : `支持搜索${label}姓名或名称。`}</p>
      {hasQuery ? (
        <button className="button button-outline" onClick={onReset} type="button">
          清除搜索
        </button>
      ) : null}
    </div>
  );
}

/* 创建一个实体结果卡片组件，显示实体的图标、标签、课程数、教师数、班级数和教室数，并提供查看周课表的操作。接受视图类型、标签、条目列表和打开回调函数作为属性： */
function EntityResultCard({ view, label, entries, onOpen }) {
  const courseCount = new Set(entries.map((entry) => entry.courseName).filter(Boolean)).size;
  const teacherCount = new Set(entries.map((entry) => entry.teacher).filter(Boolean)).size;
  const classCount = new Set(entries.map((entry) => entry.classGroup).filter(Boolean)).size;
  const roomCount = new Set(entries.map((entry) => entry.roomName).filter(Boolean)).size;
  const Icon = view === "courses" ? BookOpen : view === "teachers" ? UserRound : Users;
  const detail = view === "courses"
    ? `${teacherCount} 位教师 · ${classCount} 个班级`
    : view === "teachers"
      ? `${courseCount} 门课程 · ${classCount} 个班级`
      : `${courseCount} 门课程 · ${teacherCount} 位教师`;

  return (
    <button className="entity-result-card" onClick={() => onOpen(view, label)} type="button">
      <span className="entity-result-icon"><Icon size={18} /></span>
      <span className="entity-result-copy">
        <strong>{label}</strong>
        <small>{detail} · {roomCount} 间教室</small>
      </span>
      <span className="entity-result-action">查看周课表 <ArrowUpRight size={15} /></span>
    </button>
  );
}

/* 创建一个实体链接组件，显示实体的标签，并在点击时调用导航回调函数。接受标签、视图类型、导航回调函数、是否静音和自定义类名作为属性： */
function EntityLink({ label, view, onNavigate, muted = false, className = "" }) {
  if (!label) return null;
  return (
    <button className={cn("entity-link", muted && "is-muted", className)} onClick={() => onNavigate(view, label)} type="button">
      {label}
    </button>
  );
}

/* 创建一个课程行组件，显示课程的名称、教室、教师、班级、星期几、节次和周次等信息，并提供打开教室和导航到实体的操作。接受课程条目、教室对象、打开回调函数和导航回调函数作为属性： */
function CourseRow({ entry, room, onOpen, onNavigate }) {
  const roomName = room?.name || entry.roomName || "未标注教室";
  return (
    <div className="course-row">
      <div className="course-main">
        <EntityLink label={entry.courseName || "未命名课程"} view="courses" onNavigate={onNavigate} className="course-name" />
        {room ? (
          <button className="course-room entity-link" onClick={() => onOpen(room)} type="button">
            {roomName}
          </button>
        ) : (
          <span className="course-room">{roomName}</span>
        )}
      </div>
      <div className="course-info">
        <span>
          <UserRound size={14} />
          <EntityLink label={entry.teacher || "未标注教师"} view="teachers" onNavigate={onNavigate} muted />
        </span>
        <span>
          <Users size={14} />
          <EntityLink label={entry.classGroup || "未标注班级"} view="classes" onNavigate={onNavigate} muted />
        </span>
        <span>
          <CalendarDays size={14} />
          {entry.weekdayLabel} · {entry.periodCode}
        </span>
        <span>{entry.weekText || "未标注周次"}</span>
      </div>
      {room ? <ArrowUpRight className="course-arrow" size={16} /> : null}
    </div>
  );
}

/* 创建一个课程行组件，显示课程的名称、教室、教师或班级、星期几、节次和周次等信息，并提供打开教室和导航到实体的操作。根据当前视图类型（教师或班级）显示相应的信息。接受课程条目、教室对象、打开回调函数、导航回调函数和视图类型作为属性： */
function ScheduleRow({ entry, room, onOpen, onNavigate, view }) {
  const canOpenRoom = Boolean(room);
  const content = (
    <>
      <div className="course-main">
        <EntityLink label={entry.courseName || "未命名课程"} view="courses" onNavigate={onNavigate} className="course-name" />
        {canOpenRoom ? (
          <button className="course-room entity-link" onClick={() => onOpen(room)} type="button">
            {entry.roomName}
          </button>
        ) : (
          <span className="course-room">{entry.roomName || "未标注教室"}</span>
        )}
      </div>
      <div className="course-info">
        <span>
          {view === "teachers" ? <Users size={14} /> : <UserRound size={14} />}
          <EntityLink
            label={view === "teachers" ? entry.classGroup || "未标注班级" : entry.teacher || "未标注教师"}
            view={view === "teachers" ? "classes" : "teachers"}
            onNavigate={onNavigate}
            muted
          />
        </span>
        <span>
          <CalendarDays size={14} />
          {entry.weekdayLabel} · {entry.periodCode}
        </span>
        <span>{entry.weekText || "未标注周次"}</span>
      </div>
      {canOpenRoom ? <ArrowUpRight className="course-arrow" size={16} /> : null}
    </>
  );

  return <div className={cn("course-row", !canOpenRoom && "schedule-row-disabled")}>{content}</div>;
}

/* 创建一个模态对话框组件，接受打开状态、打开状态变化回调、类名和子元素作为属性，并在按下 Escape 键时关闭对话框。使用 createPortal 将对话框渲染到 document.body 中 */
function Modal({ open, onOpenChange, className, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div className="overlay" onMouseDown={() => onOpenChange(false)}>
      <div className={className} onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* 创建一个通知图标组件，根据通知类型（错误、警告或信息）渲染不同的图标，并接受图标大小作为属性： */
function NotificationIcon({ type, size = 18 }) {
  const Icon = type === "error" || type === "warning" ? TriangleAlert : Info;
  return <Icon size={size} />;
}

/* 创建一个通知表面组件，显示通知的标题、文本和剩余时间，并在一定时间后自动关闭。接受通知对象、是否为移动设备和关闭回调函数作为属性： */
function NotificationSurface({ notification, isMobile, onDismiss }) {
  const [remaining, setRemaining] = useState(5);
  const [closing, setClosing] = useState(false);
  const dismissRef = useRef(onDismiss);
  const closingRef = useRef(false);

  dismissRef.current = onDismiss;

  useEffect(() => {
    closingRef.current = false;
    setClosing(false);
    setRemaining(7);
  }, [notification.notificationKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isMobile) {
        dismissRef.current();
      } else {
        setClosing(true);
      }
    }, 7000);
    const countdown = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(countdown);
    };
  }, [isMobile, notification.notificationKey]);

  useEffect(() => {
    if (!closing) return undefined;
    const timer = window.setTimeout(() => dismissRef.current(), 180);
    return () => window.clearTimeout(timer);
  }, [closing]);
  /* 请求关闭通知，如果已经在关闭过程中，则不执行任何操作。根据设备类型（移动设备或非移动设备）调用相应的关闭方法： */
  function requestDismiss() {
    if (closingRef.current) return;
    closingRef.current = true;
    if (isMobile) {
      dismissRef.current();
    } else {
      setClosing(true);
    }
  }

  /* 渲染通知内容，包括图标、标题、文本和剩余时间。如果是移动设备，则显示一个关闭按钮，否则显示一个图标按钮。根据通知类型和关闭状态应用不同的样式类名： */
  const content = (
    <article className={cn("notification-surface", `notification-${notification.notifyType}`, closing && "is-closing")} role="alert">
      <div className="notification-icon" aria-hidden="true">
        <NotificationIcon type={notification.notifyType} />
      </div>
      <div className="notification-copy">
        <strong>{notification.notifyTitle}</strong>
        <p>{notification.notifyText}</p>
        <small>{remaining > 0 ? `${remaining} 秒后自动关闭` : "正在关闭"}</small>
      </div>
      {isMobile ? (
        <div className="notification-actions">
          <button className="button button-outline notification-mobile-close" onClick={requestDismiss} type="button">
            关闭
          </button>
        </div>
      ) : (
        <button className="icon-button notification-close" onClick={requestDismiss} type="button" aria-label="关闭通知" title="关闭通知">
          <X size={16} />
        </button>
      )}
    </article>
  );
  /* 根据设备类型（移动设备或非移动设备）渲染通知内容。如果是移动设备，则使用模态对话框显示通知，否则将通知内容渲染到 document.body 中的一个固定位置： */
  if (isMobile) {
    return (
      <Modal open onOpenChange={requestDismiss} className="dialog notification-dialog">
        {content}
      </Modal>
    );
  }

  return createPortal(<div className="notification-toast-viewport">{content}</div>, document.body);
}

/* 创建一个通知中心对话框组件，显示所有通知的列表，并提供关闭按钮。接受打开状态、通知列表和关闭回调函数作为属性： */
function NotificationCenterDialog({ open, notifications, onClose }) {
  return (
    <Modal open={open} onOpenChange={onClose} className="dialog notification-center-dialog">
      <div className="dialog-header notification-center-header">
        <div>
          <div className="eyebrow">
            <Bell size={14} /> 通知中心
          </div>
          <h2>全部通知</h2>
          <p>共 {notifications.length} 条通知</p>
        </div>
        <button className="icon-button" onClick={onClose} type="button" aria-label="关闭通知中心" title="关闭通知中心">
          <X size={19} />
        </button>
      </div>

      {notifications.length ? (
        <div className="notification-center-list">
          {notifications.map((notification) => (
            <article className={cn("notification-center-item", `notification-${notification.notifyType}`)} key={notification.notificationKey}>
              <div className="notification-icon" aria-hidden="true">
                <NotificationIcon type={notification.notifyType} size={18} />
              </div>
              <div className="notification-copy">
                <strong>{notification.notifyTitle}</strong>
                <p>{notification.notifyText}</p>
                <small>
                  {notification.notifyStartDate} 至 {notification.notifyEndDate}
                </small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="notification-center-empty">
          <Bell size={24} />
          <span>暂无配置通知</span>
        </div>
      )}
    </Modal>
  );
}

/* 创建一个居民通知组件，显示所有居民通知的列表，并根据通知类型应用不同的样式。接受通知列表作为属性： */
function ResidentNotifications({ notifications }) {
  return (
    <div className={cn("resident-notifications", notifications.length > 0 && "has-notifications")} aria-live="polite">
      <div className="resident-notification-list">
        {notifications.map((notification) => (
          <article className={cn("resident-notification", `notification-${notification.notifyType}`)} key={notification.notificationKey} role="status">
            <div className="notification-icon" aria-hidden="true">
              <NotificationIcon type={notification.notifyType} size={17} />
            </div>
            <div className="notification-copy">
              <strong>{notification.notifyTitle}</strong>
              <p>{notification.notifyText}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* 创建一个通知中心组件，管理通知队列和当前显示的通知，并根据设备类型（移动设备或非移动设备）渲染通知表面和居民通知。接受通知列表作为属性： */
function NotificationCenter({ notifications }) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches);
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [residentNotifications, setResidentNotifications] = useState([]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const handleChange = (event) => setIsMobile(event.matches);
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    const dismissed = getDismissedNotificationKeys();
    setQueue(notifications.filter((notification) => !dismissed.has(notification.notificationKey)));
    setCurrent(null);
    setResidentNotifications(
      notifications
        .filter((notification) => notification.notifyTwice && dismissed.has(notification.notificationKey))
        .sort((a, b) => a.notifyNo - b.notifyNo),
    );
  }, [notifications]);

  useEffect(() => {
    if (current || !queue.length) return;
    setCurrent(queue[0]);
  }, [current, queue]);
  /* 定义一个函数，用于持久化地关闭当前通知。首先检查是否存在当前通知，如果不存在则直接返回。然后调用 `dismissNotificationPersistently` 函数将当前通知的键添加到已关闭通知的集合中。如果当前通知设置了 `notifyTwice` 属性，则将其添加到居民通知列表中，并按 `notifyNo` 属性进行排序。最后，从队列中移除当前通知，并将 `current` 状态设置为 `null`： */
  function dismissCurrent() {
    if (!current) return;

    dismissNotificationPersistently(current.notificationKey);
    if (current.notifyTwice) {
      setResidentNotifications((items) => (
        items.some((item) => item.notificationKey === current.notificationKey)
          ? items
          : [...items, current].sort((a, b) => a.notifyNo - b.notifyNo)
      ));
    }
    setQueue((items) => items.slice(1));
    setCurrent(null);
  }

  return (
    <>
      {current ? <NotificationSurface notification={current} isMobile={isMobile} onDismiss={dismissCurrent} /> : null}
      <ResidentNotifications notifications={residentNotifications} />
    </>
  );
}

/* 创建一个教室详情对话框组件，显示教室的详细信息、当前状态、本周概览和下一次课程。接受教室对象、数据、选定的周次、星期几、节次、关闭回调函数、收藏状态、收藏切换回调函数和导航回调函数作为属性： */
function RoomDialog({
  room,
  data,
  selectedWeek,
  selectedWeekday,
  selectedPeriods,
  onClose,
  isFavorite,
  onToggleFavorite,
  onNavigate,
}) {
  if (!room) return null;
  /* 获取教室在当前选定的周次、星期几和节次的占用情况，并根据选定的节次获取对应的时间段信息。然后根据选定的星期几获取对应的星期信息，并将选定的节次标签拼接成字符串。接着获取教室在当前周次的每一天的空闲情况概览，以及教室在当前周次、星期几和节次之后的下一次课程信息： */
  const occupied = getRoomEntriesForPeriods(room, selectedWeekday, selectedPeriods, selectedWeek);
  const selectedSlots = data.timeSlots.filter((slot) => selectedPeriods.includes(slot.code));
  const selectedDay = data.weekdays.find((day) => day.index === Number(selectedWeekday));
  const selectedPeriodLabel = selectedSlots.map((slot) => slot.label).join("、");
  const weeklyOverview = getWeeklyRoomOverview(room, data, selectedWeek);
  const nextCourse = getNextCourse(room, data, selectedWeek, selectedWeekday, selectedPeriods);

  return (
    
    <Modal open={Boolean(room)} onOpenChange={onClose} className="dialog dialog-room">
      <div className="dialog-header">
        <div>
          <div className="eyebrow">教室详情</div>
          <h2>{room.name}</h2>
          <p>
            <MapPin size={14} />
            {room.building} · {room.floor} 层 · {room.zone.replace("普通教学区", "教学区")}
          </p>
        </div>
        <div className="dialog-header-actions">
          <button
            className={cn("icon-button", "dialog-favorite", isFavorite && "is-favorite")}
            onClick={() => onToggleFavorite(room.name)}
            type="button"
            aria-label={isFavorite ? "取消收藏" : "收藏教室"}
            title={isFavorite ? "取消收藏" : "收藏教室"}
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <button className="icon-button" onClick={onClose} type="button" aria-label="关闭">
            <X size={19} />
          </button>
        </div>
      </div>

      <div className="dialog-summary">
        <div>
          <span>当前周次</span>
          <strong>第 {selectedWeek} 周</strong>
        </div>
        <div>
          <span>当前定位</span>
          <strong>
            {selectedDay?.shortLabel} · {selectedPeriodLabel}
          </strong>
        </div>
        <div>
          <span>当前状态</span>
          <strong>{occupied.length ? "占用" : "空闲"}</strong>
        </div>
      </div>

      <div className="dialog-banner">
        <Check size={16} />
        <span>
          {occupied.length
            ? `${occupied[0].courseName} / ${occupied[0].teacher || "未标注教师"}`
            : `当前筛选时段空闲 · ${selectedPeriodLabel}`}
        </span>
      </div>

      <div className="dialog-detail-grid">
        <section className="dialog-detail-card">
          <div className="dialog-detail-heading">
            <div>
              <span className="section-kicker">本周概览</span>
              <strong>第 {selectedWeek} 周空闲情况</strong>
            </div>
            <LayoutGrid size={17} />
          </div>
          <div className="weekly-overview">
            {weeklyOverview.map((day) => (
              <div className="weekly-overview-row" key={day.index}>
                <span>{day.shortLabel}</span>
                <div className="weekly-overview-bar">
                  <span style={{ "--free-progress": `${(day.free / day.total) * 100}%` }} />
                </div>
                <small>
                  {day.free}/{day.total}
                </small>
              </div>
            ))}
          </div>
        </section>

        <section className="dialog-detail-card next-course-card">
          <div className="dialog-detail-heading">
            <div>
              <span className="section-kicker">下一次课程</span>
              <strong>{nextCourse ? nextCourse.entry.courseName : "暂无后续安排"}</strong>
            </div>
            <Clock3 size={17} />
          </div>
          {nextCourse ? (
            <div className="next-course-copy">
              <span>
                {nextCourse.day.shortLabel} · {nextCourse.slot.label} · {nextCourse.slot.start}-{nextCourse.slot.end}
              </span>
              <small>
                {nextCourse.entry.teacher || "未标注教师"}
                {nextCourse.entry.classGroup ? ` · ${nextCourse.entry.classGroup}` : ""}
              </small>
            </div>
          ) : (
            <div className="next-course-copy">
              <span>当前学期没有检测到后续课程</span>
            </div>
          )}
        </section>
      </div>

      <div className="schedule">
        <div className="schedule-head">
          <div className="schedule-corner">节次</div>
          {data.weekdays.map((day) => (
            <div className="schedule-day" key={day.index}>
              {day.shortLabel}
            </div>
          ))}
        </div>
        {data.timeSlots.map((slot) => (
          <div className="schedule-row" key={slot.code}>
            <div className="schedule-slot">
              <strong>{slot.label}</strong>
              <span>
                {slot.start} - {slot.end}
              </span>
            </div>
            {data.weekdays.map((day) => {
              const entries = getRoomEntries(room, day.index, slot.code, selectedWeek);
              return (
                <div className={cn("schedule-cell", entries.length && "is-occupied")} key={`${day.index}-${slot.code}`}>
                  {entries.length ? (
                    <div className="schedule-course">
                      <ExpandableScheduleEntries
                        entries={entries}
                        collapsedCount={1}
                        renderEntry={(entry, index) => (
                          <div className="schedule-entry-copy" key={`${entry.courseName}-${entry.teacher}-${entry.classGroup}-${index}`}>
                            <button className="schedule-entity-link" onClick={() => onNavigate("courses", entry.courseName)} type="button">
                              {entry.courseName}
                            </button>
                            <button className="schedule-entity-link" onClick={() => onNavigate("teachers", entry.teacher)} type="button">
                              {entry.teacher || "未标注教师"}
                            </button>
                            {entry.classGroup ? (
                              <button className="schedule-entity-link" onClick={() => onNavigate("classes", entry.classGroup)} type="button">
                                {entry.classGroup}
                              </button>
                            ) : null}
                          </div>
                        )}
                      />
                    </div>
                  ) : (
                    <span className="schedule-free">空闲</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* 创建一个可展开的课程安排条目组件，显示课程安排的列表，并在超过指定数量时提供展开和收起的按钮。接受课程条目列表、折叠数量和渲染函数作为属性： */
function ExpandableScheduleEntries({ entries, collapsedCount = 2, renderEntry }) {
  const [expanded, setExpanded] = useState(false);
  const visibleEntries = expanded ? entries : entries.slice(0, collapsedCount);
  const hiddenCount = Math.max(0, entries.length - collapsedCount);

  return (
    <div className="schedule-entry-list">
      {visibleEntries.map((entry, index) => renderEntry(entry, index))}
      {hiddenCount > 0 ? (
        <button
          className="schedule-more"
          onClick={() => setExpanded((value) => !value)}
          type="button"
          aria-expanded={expanded}
        >
          {expanded ? "收起安排" : `+${hiddenCount} 项安排`}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      ) : null}
    </div>
  );
}

/* 创建一个函数，根据当前视图类型（课程、教师或班级）从课表数据中获取相应的条目列表。如果视图类型为课程，则返回课程条目列表；如果视图类型为教师，则返回教师条目列表；如果视图类型为班级，则返回班级条目列表；否则返回空数组： */
function getScheduleSourceEntries(scheduleData, view) {
  if (view === "courses") return scheduleData?.courseEntries ?? [];
  if (view === "teachers") return scheduleData?.teacherEntries ?? [];
  if (view === "classes") return scheduleData?.entries ?? [];
  return [];
}

/* 创建一个函数，根据当前视图类型（课程、教师或班级）从条目中获取相应的实体值。如果视图类型为课程，则返回课程名称；如果视图类型为教师，则返回教师名称；如果视图类型为班级，则返回班级组名称；否则返回空字符串： */
function getScheduleEntityValue(entry, view) {
  if (view === "courses") return entry.courseName;
  if (view === "teachers") return entry.teacher;
  if (view === "classes") return entry.classGroup;
  return "";
}

/* 创建一个函数，根据当前视图类型（课程、教师或班级）返回相应的对话框标题。如果视图类型为课程，则返回“课程课表”；如果视图类型为教师，则返回“教师课表”；如果视图类型为班级，则返回“班级课表”；否则返回“课表详情”： */
function getEntityDialogTitle(view) {
  return {
    courses: "课程课表",
    teachers: "教师课表",
    classes: "班级课表",
  }[view] || "课表详情";
}

/* 创建一个函数，根据当前时间和课表数据获取实体的当前状态和下一次课程信息。如果没有条目或数据，或者选定的周次与当前周次不匹配，则返回 null。否则，计算当前时间所在的节次索引、当前定位和下一次课程，并返回包含当前条目、下一次课程和是否为当前周的对象： */
function getEntityScheduleStatus(entries, data, selectedWeek, currentNow, currentTemporal) {
  if (!entries.length || !data || selectedWeek !== currentTemporal?.week) return null;
  const parts = getShanghaiParts(currentNow);
  const currentDay = parts.weekdayIndex;
  const currentMinutes = parts.hour * 60 + parts.minute;
  const slotIndex = data.timeSlots.findIndex((slot) => {
    const start = timeToMinutes(slot.start);
    const end = timeToMinutes(slot.end);
    return currentMinutes >= start && currentMinutes < end;
  });
  const nextSlotIndex = slotIndex >= 0
    ? slotIndex
    : data.timeSlots.findIndex((slot) => currentMinutes < timeToMinutes(slot.start));
  const currentPosition = slotIndex >= 0
    ? (currentDay - 1) * data.timeSlots.length + slotIndex
    : nextSlotIndex >= 0
      ? (currentDay - 1) * data.timeSlots.length + nextSlotIndex
      : currentDay * data.timeSlots.length;
  const sortedEntries = [...entries].sort((left, right) => {
    const leftIndex = data.timeSlots.findIndex((slot) => slot.code === left.periodCode);
    const rightIndex = data.timeSlots.findIndex((slot) => slot.code === right.periodCode);
    return left.weekday - right.weekday || leftIndex - rightIndex;
  });
  const currentEntries = slotIndex >= 0
    ? sortedEntries.filter((entry) => entry.weekday === currentDay && entry.periodCode === data.timeSlots[slotIndex]?.code)
    : [];
  const nextEntry = sortedEntries.find((entry) => {
    const entrySlotIndex = data.timeSlots.findIndex((slot) => slot.code === entry.periodCode);
    const entryPosition = (entry.weekday - 1) * data.timeSlots.length + entrySlotIndex;
    return entryPosition >= currentPosition && !currentEntries.includes(entry);
  }) || sortedEntries[0] || null;

  return {
    currentEntries,
    nextEntry,
    isCurrentWeek: true,
  };
}

/* 创建一个课程安排单元格组件，显示课程的名称、教师或班级、教室等信息，并提供导航和打开教室的操作。根据当前视图类型（课程或教师）显示相应的信息。接受课程条目、视图类型、教室对象、导航回调函数和打开教室回调函数作为属性： */
function EntityScheduleCell({ entry, view, room, onNavigate, onOpenRoom }) {
  const primary = view === "courses" ? entry.classGroup : entry.courseName;
  const secondary = view === "teachers" ? entry.classGroup : entry.teacher;

  return (
    <div className="schedule-course entity-schedule-course">
      {view === "courses" ? (
        <button className="schedule-entity-link" onClick={() => onNavigate("classes", entry.classGroup)} type="button">
          {primary || "未标注班级"}
        </button>
      ) : (
        <button className="schedule-entity-link" onClick={() => onNavigate("courses", entry.courseName)} type="button">
          {primary || "未命名课程"}
        </button>
      )}
      {view !== "teachers" ? (
        <button className="schedule-entity-link" onClick={() => onNavigate("teachers", entry.teacher)} type="button">
          {secondary || "未标注教师"}
        </button>
      ) : (
        <button className="schedule-entity-link" onClick={() => onNavigate("classes", entry.classGroup)} type="button">
          {secondary || "未标注班级"}
        </button>
      )}
      {room ? (
        <button className="schedule-entity-link schedule-room-link" onClick={() => onOpenRoom(room)} type="button">
          {entry.roomName}
        </button>
      ) : (
        <small>{entry.roomName || "未标注教室"}</small>
      )}
    </div>
  );
}

/* 创建一个实体课表对话框组件，显示实体（课程、教师或班级）的课表信息，包括本周安排、关联信息、涉及教室、当前定位和当前状态等。接受实体对象、课表数据、数据、选定的周次、星期几、节次、当前时间、当前学期、最大周次、教室映射对象以及关闭回调函数、周次变化回调函数、筛选变化回调函数、导航回调函数和打开教室回调函数作为属性： */
function EntityScheduleDialog({
  entity,
  scheduleData,
  data,
  selectedWeek,
  selectedWeekday,
  selectedPeriods,
  currentNow,
  currentTemporal,
  maxWeek,
  roomByName,
  onClose,
  onWeekChange,
  onFilterChange,
  onNavigate,
  onOpenRoom,
}) {
  /* 如果实体对象、课表数据或数据不存在，则返回 null，不渲染任何内容： */
  if (!entity || !scheduleData || !data) return null;

  const sourceEntries = getScheduleSourceEntries(scheduleData, entity.view);
  const allEntries = sourceEntries.filter((entry) => getScheduleEntityValue(entry, entity.view) === entity.label);
  const weekEntries = allEntries.filter((entry) => entry.weeks.includes(Number(selectedWeek)));
  const selectedEntries = weekEntries.filter(
    (entry) => entry.weekday === Number(selectedWeekday) && selectedPeriods.includes(entry.periodCode),
  );
  const relatedCourses = [...new Set(weekEntries.map((entry) => entry.courseName).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-Hans-u-co-pinyin"));
  const relatedTeachers = [...new Set(weekEntries.map((entry) => entry.teacher).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-Hans-u-co-pinyin"));
  const relatedClasses = [...new Set(weekEntries.map((entry) => entry.classGroup).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-Hans-u-co-pinyin"));
  const detailEntries = weekEntries.filter((entry) => {
    if (entity.courseFilter && entry.courseName !== entity.courseFilter) return false;
    if (entity.teacherFilter && entry.teacher !== entity.teacherFilter) return false;
    if (entity.classFilter && entry.classGroup !== entity.classFilter) return false;
    return true;
  });
  const liveStatus = getEntityScheduleStatus(detailEntries, data, selectedWeek, currentNow, currentTemporal);
  const courseCount = new Set(weekEntries.map((entry) => entry.courseName).filter(Boolean)).size;
  const teacherCount = new Set(weekEntries.map((entry) => entry.teacher).filter(Boolean)).size;
  const classCount = new Set(weekEntries.map((entry) => entry.classGroup).filter(Boolean)).size;
  const roomCount = new Set(weekEntries.map((entry) => entry.roomName).filter(Boolean)).size;
  const selectedDay = data.weekdays.find((day) => day.index === Number(selectedWeekday));
  const selectedPeriodLabel = data.timeSlots
    .filter((slot) => selectedPeriods.includes(slot.code))
    .map((slot) => slot.label)
    .join("、");
  const selectedEntriesForDisplay = selectedEntries.filter((entry) => detailEntries.includes(entry));
  const relatedLabel = entity.view === "courses"
    ? `${teacherCount} 位教师 / ${classCount} 个班级`
    : entity.view === "teachers"
      ? `${courseCount} 门课程 / ${classCount} 个班级`
      : `${courseCount} 门课程 / ${teacherCount} 位教师`;
  return (
    <Modal open={Boolean(entity)} onOpenChange={onClose} className="dialog dialog-room dialog-entity">
      <div className="dialog-header">
        <div>
          <div className="eyebrow">{getEntityDialogTitle(entity.view)}</div>
          <h2>{entity.label}</h2>
          <p>
            <CalendarDays size={14} />
            第 {selectedWeek} 周完整安排
          </p>
          <label className="entity-week-control">
            <span>查看周次</span>
            <select value={selectedWeek} onChange={(event) => onWeekChange(Number(event.target.value))}>
              {Array.from({ length: maxWeek }, (_, index) => (
                <option value={index + 1} key={index + 1}>
                  第 {index + 1} 周
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="icon-button" onClick={onClose} type="button" aria-label="关闭">
          <X size={19} />
        </button>
      </div>

      <div className="dialog-summary">
        <div>
          <span>本周安排</span>
          <strong>{weekEntries.length} 项</strong>
        </div>
        <div>
          <span>关联信息</span>
          <strong>{relatedLabel}</strong>
        </div>
        <div>
          <span>涉及教室</span>
          <strong>{roomCount} 间</strong>
        </div>
      </div>

      <div className="entity-live-grid">
        <div className="entity-live-item">
          <Clock3 size={16} />
          <div>
            <span>当前定位</span>
            <strong>{selectedDay?.shortLabel} {selectedPeriodLabel}</strong>
            <small>{selectedEntriesForDisplay.length ? `${selectedEntriesForDisplay.length} 项安排` : "暂无安排"}</small>
          </div>
        </div>
        <div className="entity-live-item">
          <ArrowUpRight size={16} />
          <div>
            <span>{liveStatus?.currentEntries.length ? "正在上课" : "下一节课程"}</span>
            <strong>
              {liveStatus?.currentEntries[0]?.courseName || liveStatus?.nextEntry?.courseName || "当前周暂无后续课程"}
            </strong>
            <small>
              {liveStatus?.currentEntries.length
                ? "当前时间段"
                : liveStatus?.nextEntry
                  ? `${data.weekdays.find((day) => day.index === liveStatus.nextEntry.weekday)?.shortLabel ?? ""} · ${liveStatus.nextEntry.periodCode}`
                  : "请选择其他周次查看安排"}
            </small>
          </div>
        </div>
      </div>

      <div className="entity-filter-row">
        <div className="filter-title"><Filter size={15} /> 课表筛选</div>
        {entity.view !== "courses" ? (
          <label className="entity-filter-field">
            <span>课程</span>
            <select value={entity.courseFilter || ""} onChange={(event) => onFilterChange("courseFilter", event.target.value)}>
              <option value="">全部课程</option>
              {relatedCourses.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
        ) : null}
        {entity.view !== "teachers" ? (
          <label className="entity-filter-field">
            <span>教师</span>
            <select value={entity.teacherFilter || ""} onChange={(event) => onFilterChange("teacherFilter", event.target.value)}>
              <option value="">全部教师</option>
              {relatedTeachers.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
        ) : null}
        {entity.view !== "classes" ? (
          <label className="entity-filter-field">
            <span>班级</span>
            <select value={entity.classFilter || ""} onChange={(event) => onFilterChange("classFilter", event.target.value)}>
              <option value="">全部班级</option>
              {relatedClasses.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      <div className="schedule">
        <div className="schedule-head">
          <div className="schedule-corner">节次</div>
          {data.weekdays.map((day) => (
            <div className="schedule-day" key={day.index}>
              {day.shortLabel}
            </div>
          ))}
        </div>
        {data.timeSlots.map((slot) => (
          <div className="schedule-row" key={slot.code}>
            <div className="schedule-slot">
              <strong>{slot.label}</strong>
              <span>
                {slot.start} - {slot.end}
              </span>
            </div>
            {data.weekdays.map((day) => {
              const entries = detailEntries.filter((entry) => entry.weekday === day.index && entry.periodCode === slot.code);
              return (
                <div className={cn("schedule-cell", entries.length && "is-occupied")} key={`${day.index}-${slot.code}`}>
                  {entries.length ? (
                    <ExpandableScheduleEntries
                      entries={entries}
                      renderEntry={(entry, index) => (
                        <EntityScheduleCell
                          key={`${entry.courseName}-${entry.teacher}-${entry.classGroup}-${entry.roomName}-${index}`}
                          entry={entry}
                          view={entity.view}
                          room={roomByName.get(entry.roomName)}
                          onNavigate={onNavigate}
                          onOpenRoom={onOpenRoom}
                        />
                      )}
                    />
                  ) : (
                    <span className="schedule-free">无课</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* 创建一个命令对话框组件，提供搜索教室和课程的功能，并显示匹配结果。接受打开状态、打开状态变化回调函数、数据、命令查询、命令查询变化回调函数、选择教室回调函数、可用教室列表和课程结果作为属性： */
function CommandDialog({
  open,
  onOpenChange,
  data,
  commandQuery,
  setCommandQuery,
  onPickRoom,
  availableRooms,
  courseResults,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return undefined;
  }, [open]);

  const normalizedQuery = commandQuery.trim().toLowerCase();

  const roomHits = useMemo(() => {
    if (!data || !normalizedQuery) return [];
    return data.rooms.filter((room) => {
      const text = [room.name, room.building, room.zone, room.floor].join(" ").toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [data, normalizedQuery]);

  const courseHits = useMemo(() => {
    if (!data || !normalizedQuery) return [];
    const hits = [];
    for (const room of data.rooms) {
      for (const entry of room.entries) {
        const text = [entry.courseName, entry.teacher, entry.classGroup, room.name].join(" ").toLowerCase();
        if (text.includes(normalizedQuery)) {
          hits.push({ room, entry });
        }
      }
    }
    return hits;
  }, [data, normalizedQuery]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} className="dialog dialog-command">
      <div className="command-bar">
        <Search size={16} />
        <input
          ref={inputRef}
          value={commandQuery}
          onChange={(event) => setCommandQuery(event.target.value)}
          placeholder="搜索教室、楼栋、课程、教师或班级"
        />
        <span className="command-shortcut">
          <Command size={12} /> K
        </span>
      </div>

      <div className="command-body">
        {!normalizedQuery ? (
          <div className="command-group command-columns">
            <div>
              <div className="command-group-title">查询教室结果</div>
              <div className="command-list compact">
                {availableRooms.slice(0, 8).map((room) => (
                  <button className="command-item" key={room.name} onClick={() => onPickRoom(room)} type="button">
                    <span className="command-item-icon soft">
                      <DoorOpen size={15} />
                    </span>
                    <span className="command-item-copy">
                      <strong>{room.name}</strong>
                      <small>
                        {room.building} · {room.floor} 层
                      </small>
                    </span>
                  </button>
                ))}
                {!availableRooms.length ? <div className="command-empty">当前没有查询教室结果</div> : null}
              </div>
            </div>
            <div>
              <div className="command-group-title">课程结果</div>
              <div className="command-list compact">
                {courseResults.slice(0, 8).map(({ entry, room }, index) => (
                  <button
                    className="command-item"
                    key={`${room.name}-${entry.courseName}-${index}`}
                    onClick={() => onPickRoom(room)}
                    type="button"
                  >
                    <span className="command-item-icon soft">
                      <BookOpen size={15} />
                    </span>
                    <span className="command-item-copy">
                      <strong>{entry.courseName}</strong>
                      <small>
                        {entry.teacher || "未标注教师"} · {room.name}
                      </small>
                    </span>
                  </button>
                ))}
                {!courseResults.length ? <div className="command-empty">输入关键词搜索课程</div> : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="command-group">
            <div className="command-group-title">
              匹配结果
              <span>{roomHits.length + courseHits.length} 条</span>
            </div>

            <div className="command-list">
              {roomHits.slice(0, 10).map((room) => (
                <button className="command-item" key={room.name} onClick={() => onPickRoom(room)} type="button">
                  <span className="command-item-icon soft">
                    <DoorOpen size={15} />
                  </span>
                  <span className="command-item-copy">
                    <strong>{room.name}</strong>
                    <small>
                      {room.building} · {room.floor} 层 · {room.zone.replace("普通教学区", "教学区")}
                    </small>
                  </span>
                </button>
              ))}

              {courseHits.slice(0, 10).map(({ entry, room }, index) => (
                <button
                  className="command-item"
                  key={`${room.name}-${entry.courseName}-${index}`}
                  onClick={() => onPickRoom(room)}
                  type="button"
                >
                  <span className="command-item-icon soft">
                    <BookOpen size={15} />
                  </span>
                  <span className="command-item-copy">
                    <strong>{entry.courseName}</strong>
                    <small>
                      {entry.teacher || "未标注教师"} · {room.name} · {entry.weekdayLabel}
                    </small>
                  </span>
                </button>
              ))}

              {!roomHits.length && !courseHits.length ? <div className="command-empty">没有匹配项</div> : null}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* 创建一个加载屏幕组件，显示加载进度和当前阶段信息。接受加载进度和当前阶段作为属性： */
function LoadingScreen({ progress, stage, notice }) {
  return (
    <main className="load-state">
      <div className="loading-card">
        <div className="loading-card-head">
          <div className="brand-mark">
            <BrandMarkIcon />
          </div>
          <div>
            <strong>校园课程助手</strong>
            <span>正在准备数据·可能需要较长时间</span>
          </div>
          <LoaderCircle className="loader" size={18} />
        </div>
        <div className="loading-progress">
          <div className="loading-progress-track">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <strong>{Math.round(progress * 100)}%</strong>
        </div>
        <p className="loading-stage">{stage}</p>
        {notice ? (
          <p className="loading-notice" role="status">
            {notice}
          </p>
        ) : null}
        <div className="loading-skeleton-grid">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="loading-skeleton-list">
          <span />
          <span />
          <span />
        </div>
      </div>
    </main>
  );
}

/*这个是应用程序的主组件. */
function App() {
  /*这一系列的状态变量用于管理应用程序的各种状态，包括数据、设置、加载进度、视图类型、筛选条件、命令面板等。它们使用 React 的 useState 钩子来创建和更新状态： */
  const isMac = typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const [data, setData] = useState(null);
  const [scheduleData, setScheduleData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStage, setLoadStage] = useState("正在准备数据...");
  const [loadNotice, setLoadNotice] = useState("");
  const [activeView, setActiveView] = useState("available");
  const [temporalMode, setTemporalMode] = useState("week");
  const [selectedWeek, setSelectedWeek] = useState(DEFAULT_WEEK);
  const [selectedWeekday, setSelectedWeekday] = useState(DEFAULT_WEEKDAY);
  const [selectedPeriods, setSelectedPeriods] = useState([DEFAULT_PERIOD]);
  const [periodSelectionMode, setPeriodSelectionMode] = useState("single");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [selectedFloors, setSelectedFloors] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [favorites, setFavorites] = useState(() => {
    const value = readStorage(FAVORITES_STORAGE_KEY, []);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  });
  const [recentQueries, setRecentQueries] = useState(() => {
    const value = readStorage(RECENT_QUERIES_STORAGE_KEY, []);
    return Array.isArray(value)
      ? value.filter((item) => item && typeof item === "object" && (item.activeView === "available" || item.entityLabel))
      : [];
  });
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [urlInitialized, setUrlInitialized] = useState(false);
  const autoInitialized = useRef(false);
  const [currentNow, setCurrentNow] = useState(() => new Date());

/* 使用 useEffect 钩子在组件挂载时加载数据文件、课程索引和设置文件，并更新加载进度和阶段信息。如果加载过程中发生错误，则设置错误状态。使用取消标志来防止在组件卸载后更新状态： */
  useEffect(() => {
    let cancelled = false;

    async function loadResources() {
      const sourceLabel = (index) => RESOURCE_SOURCE_LABELS[index] ?? `备用源 ${index + 1}`;
      const resourceProgresses = {
        data: 0,
        schedule: 0,
        settings: 0,
      };
      let failed = false;

      const updateResourceProgress = (resourceKey, progress) => {
        resourceProgresses[resourceKey] = clamp(Number(progress) || 0, 0, 1);
        if (cancelled || failed) return;

        setLoadProgress(getOverallLoadProgress(resourceProgresses));
        const pendingStages = Object.entries(resourceProgresses)
          .filter(([, resourceProgress]) => resourceProgress < 1)
          .map(
            ([key, resourceProgress]) =>
              `${LOAD_RESOURCE_LABELS[key]} ${Math.round(resourceProgress * 100)}%`,
          );
        setLoadStage(
          pendingStages.length ? `正在加载：${pendingStages.join("、")}` : "正在处理数据...",
        );
      };

      const loadResource = (resourceKey, urls) =>
        fetchJsonFromUrls(urls, {
          onProgress: (progress) => updateResourceProgress(resourceKey, progress),
          onFallback: ({ sourceIndex, nextSourceIndex }) => {
            if (!cancelled && !failed) {
              setLoadNotice(
                `${LOAD_RESOURCE_LABELS[resourceKey]}：${sourceLabel(sourceIndex)} 加载失败，正在重试 ${sourceLabel(nextSourceIndex)}。`,
              );
            }
          },
        });

      try {
        setLoadNotice("");
        setLoadProgress(0);
        setLoadStage("正在加载：数据文件 0%、课程索引 0%、设置 0%");

        const [dataValue, scheduleValue, settingsValue] = await Promise.all([
          loadResource("data", DATA_URLS),
          loadResource("schedule", SCHEDULE_URLS),
          loadResource("settings", SETTINGS_URLS),
        ]);

        if (cancelled) return;
        setData(dataValue);
        setScheduleData(scheduleValue);
        setLoadNotice("");
        setLoadStage("正在初始化...");

        const rawMaskMessage = settingsValue?.maskMessage ?? {};
        const title =
          typeof rawMaskMessage.title === "string"
            ? rawMaskMessage.title
            : typeof rawMaskMessage.tittle === "string"
              ? rawMaskMessage.tittle
              : DEFAULT_MASK_MESSAGE.title;
        const text = typeof rawMaskMessage.text === "string" ? rawMaskMessage.text : DEFAULT_MASK_MESSAGE.text;

        setSettings({
          ...DEFAULT_SETTINGS,
          ...settingsValue,
          semesterStartDate:
            typeof settingsValue?.semesterStartDate === "string" ? settingsValue.semesterStartDate : "",
          semesterEndDate:
            typeof settingsValue?.semesterEndDate === "string" ? settingsValue.semesterEndDate : "",
          infoDisplay: Number(settingsValue?.infoDisplay ?? DEFAULT_SETTINGS.infoDisplay),
          defaultView: settingsValue?.defaultView === "courses" ? "courses" : "available",
          defaultOnlyAvailable: settingsValue?.defaultOnlyAvailable !== false,
          defaultPeriodMode: settingsValue?.defaultPeriodMode === "multiple" ? "multiple" : "single",
          searchResultLimit: Math.max(
            1,
            Number(settingsValue?.searchResultLimit) || DEFAULT_SETTINGS.searchResultLimit,
          ),
          enableCommandPalette: settingsValue?.enableCommandPalette !== false,
          enableBackToTop: settingsValue?.enableBackToTop !== false,
          stickyFilters: settingsValue?.stickyFilters !== false,
          notify: Array.isArray(settingsValue?.notify) ? settingsValue.notify : [],
          maskMessage: {
            title: title || DEFAULT_MASK_MESSAGE.title,
            text: text || DEFAULT_MASK_MESSAGE.text,
          },
        });
        setSettingsLoaded(true);
        setLoadProgress(1);
        setLoadStage("数据加载完成");
      } catch (error) {
        failed = true;
        if (cancelled) return;
        setLoadError(error.message);
        setSettingsError(error.message);
        setSettings(DEFAULT_SETTINGS);
        setSettingsLoaded(true);
      }
    }

    loadResources();
    return () => {
      cancelled = true;
    };
  }, []);
  
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showResultsJump, setShowResultsJump] = useState(false);
  const queryPanelRef = useRef(null);
  const resultsSectionRef = useRef(null);

  /* 使用 useEffect 钩子在组件挂载时添加滚动事件监听器，计算滚动进度并更新状态变量 scrollProgress 和 showResultsJump。当组件卸载时，移除滚动事件监听器： */
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const autoTemporal = useMemo(() => (data ? getAutoTemporalState(data, settings) : null), [data, settings]);
  const currentTime = useMemo(() => getShanghaiParts(currentNow), [currentNow]);
  const currentTemporal = useMemo(
    () => (data ? getAutoTemporalState(data, settings, currentNow) : null),
    [currentNow, data, settings],
  );
  const currentDateLabel = currentTime.dateLabel;
  const allNotifications = useMemo(
    () => (settings.notify ?? [])
      .map(normalizeNotification)
      .filter(Boolean)
      .sort((a, b) => a.notifyNo - b.notifyNo),
    [settings.notify],
  );
  const notifications = useMemo(
    () => allNotifications
      .filter((notification) => isNotificationTriggered(notification, currentNow))
      .sort((a, b) => a.notifyNo - b.notifyNo),
    [allNotifications, currentDateLabel],
  );
  const currentPhaseLabel = currentTemporal?.phase === "teaching"
    ? `第${currentTemporal.week}周`
    : currentTemporal?.phaseLabel || "";
  const currentDay = data?.weekdays.find((day) => day.index === currentTemporal?.weekday);

  const buildings = useMemo(() => getUniqueSorted(data?.rooms.map((room) => room.building) ?? []), [data]);
  const zones = useMemo(() => getUniqueSorted(data?.rooms.map((room) => room.zone) ?? []), [data]);

  /* 使用 useEffect 钩子在组件挂载时检查 URL 查询参数，并根据参数设置应用程序的状态。如果 URL 中包含共享状态，则使用共享状态更新视图、周次、星期几、节次、筛选条件等。如果 URL 中没有共享状态，则使用默认设置和自动计算的时间状态。设置 autoInitialized 和 urlInitialized 标志，以防止重复初始化： */
  useEffect(() => {
    if (!data || !settingsLoaded || urlInitialized) return;

    const params = new URLSearchParams(window.location.search);
    const hasSharedState = ["view", "mode", "week", "weekday", "date", "periods", "periodMode", "available", "buildings", "floors", "zones", "q", "entity"]
      .some((key) => params.has(key));
    const shared = getQuerySnapshotFromUrl(window.location.search);
    const validPeriods = shared.selectedPeriods.filter((code) => data.timeSlots.some((slot) => slot.code === code));
    const nextPeriods = validPeriods.length ? validPeriods : [DEFAULT_PERIOD];

    if (hasSharedState) {
      const validWeek = clamp(shared.selectedWeek, 1, data.summary.maxWeek);
      const validWeekday = clamp(shared.selectedWeekday, 1, data.weekdays.length);
      setActiveView(normalizeView(shared.activeView));
      setPeriodSelectionMode(shared.periodSelectionMode);
      setSelectedPeriods(shared.periodSelectionMode === "single" ? [nextPeriods[0]] : nextPeriods);
      setOnlyAvailable(shared.onlyAvailable);
      setSelectedBuildings(shared.selectedBuildings.filter((building) => buildings.includes(building)));
      setSelectedZones(shared.selectedZones.filter((zone) => zones.includes(zone)));

      const sharedTemporal = getTemporalFromDate(shared.selectedDate, settings.semesterStartDate, data.summary.maxWeek);
      if (shared.temporalMode === "date" && sharedTemporal) {
        setSelectedWeek(sharedTemporal.week);
        setSelectedWeekday(sharedTemporal.weekday);
        setTemporalMode("date");
      } else {
        setSelectedWeek(validWeek);
        setSelectedWeekday(validWeekday);
        setTemporalMode("week");
      }

      setQuery(shared.query);
      setSelectedFloors(shared.selectedFloors);
      setSelectedEntity(shared.entityLabel ? { view: normalizeView(shared.activeView), label: shared.entityLabel } : null);
    } else {
      const defaultMode = settings.defaultPeriodMode === "multiple" ? "multiple" : "single";
      setActiveView(settings.defaultView === "courses" ? "courses" : "available");
      setOnlyAvailable(settings.defaultOnlyAvailable !== false);
      setPeriodSelectionMode(defaultMode);
      setSelectedPeriods([autoTemporal.period]);
      setSelectedWeek(autoTemporal.week);
      setSelectedWeekday(autoTemporal.weekday);
    }

    autoInitialized.current = true;
    setUrlInitialized(true);
  }, [autoTemporal, data, settings, settingsLoaded, urlInitialized, buildings, zones]);

  const floors = useMemo(() => {
    const scope =
      selectedBuildings.length === 0
        ? data?.rooms ?? []
        : (data?.rooms ?? []).filter((room) => selectedBuildings.includes(room.building));
    return getUniqueSorted(scope.map((room) => room.floor));
  }, [data, selectedBuildings]);

  /* 使用 useEffect 钩子在 selectedFloors 或 floors 发生变化时，检查 selectedFloors 中的楼层是否仍然有效。如果 selectedFloors 中的某些楼层不再存在于 floors 中，则将其从 selectedFloors 中移除： */
  useEffect(() => {
    const nextFloors = selectedFloors.filter((floor) => floors.includes(floor));
    if (nextFloors.length !== selectedFloors.length) {
      setSelectedFloors(nextFloors);
    }
  }, [floors, selectedFloors]);

  useEffect(() => {
    if (!settings.enableCommandPalette) return undefined;

    const handleShortcut = (event) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [settings.enableCommandPalette]);

  /* 使用 useEffect 钩子在组件挂载时添加滚动和调整大小事件监听器，以便在用户滚动页面或调整窗口大小时更新滚动进度和“跳转到结果”按钮的显示状态。当组件卸载时，移除事件监听器： */
  useEffect(() => {
    const updateScrollProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      setScrollProgress(Number.isFinite(progress) ? clamp(progress, 0, 1) : 0);

      const queryPanel = queryPanelRef.current;
      const resultsSection = resultsSectionRef.current;
      if (window.innerWidth <= 720 && queryPanel && resultsSection) {
        const queryRect = queryPanel.getBoundingClientRect();
        const resultsRect = resultsSection.getBoundingClientRect();
        setShowResultsJump(
          filtersVisible
          && queryRect.top <= window.innerHeight - 72
          && queryRect.bottom >= 72
          && resultsRect.top > window.innerHeight - 40,
        );
      } else {
        setShowResultsJump(false);
      }
    };

    updateScrollProgress();
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("resize", updateScrollProgress);
    return () => {
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, [filtersVisible]);

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();

    return data.rooms.filter((room) => {
      const matchesBuilding = selectedBuildings.length === 0 || selectedBuildings.includes(room.building);
      const matchesFloor = selectedFloors.length === 0 || selectedFloors.includes(room.floor);
      const matchesZone = selectedZones.length === 0 || selectedZones.includes(room.zone);
      const searchText = [room.name, room.building, room.zone, room.floor].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || searchText.includes(normalizedQuery);
      return matchesBuilding && matchesFloor && matchesZone && matchesQuery;
    });
  }, [data, query, selectedBuildings, selectedFloors, selectedZones]);

  const availableRooms = useMemo(
    () =>
      filteredRooms.filter(
        (room) =>
          selectedPeriods.every(
            (periodCode) => getRoomEntries(room, selectedWeekday, periodCode, selectedWeek).length === 0,
          ),
      ),
    [filteredRooms, selectedPeriods, selectedWeek, selectedWeekday],
  );

  const roomByName = useMemo(() => new Map((data?.rooms ?? []).map((room) => [room.name, room])), [data]);
  const courseResults = useMemo(() => {
    if (!data || !scheduleData) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return (scheduleData.courseEntries ?? []).filter((entry) => {
      const room = roomByName.get(entry.roomName);
      if (!entry.courseName?.toLowerCase().includes(normalizedQuery)) return false;
      if (selectedBuildings.length && (!room || !selectedBuildings.includes(room.building))) return false;
      if (selectedFloors.length && (!room || !selectedFloors.includes(room.floor))) return false;
      if (selectedZones.length && (!room || !selectedZones.includes(room.zone))) return false;
      return true;
    }).map((entry) => ({ entry, room: roomByName.get(entry.roomName) }));
  }, [data, query, roomByName, scheduleData, selectedBuildings, selectedFloors, selectedZones]);

  const courseCards = useMemo(() => {
    const grouped = new Map();
    courseResults.forEach(({ entry }) => {
      if (!grouped.has(entry.courseName)) grouped.set(entry.courseName, []);
      grouped.get(entry.courseName).push(entry);
    });
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "zh-Hans-u-co-pinyin"))
      .map(([label, entries]) => ({ label, entries }));
  }, [courseResults]);

  const directoryResults = useMemo(() => {
    if (!scheduleData || !["courses", "teachers", "classes"].includes(activeView)) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    const sourceEntries = getScheduleSourceEntries(scheduleData, activeView);

    const grouped = new Map();
    sourceEntries.forEach((entry) => {
      const target = getScheduleEntityValue(entry, activeView);
      if (!target?.toLowerCase().includes(normalizedQuery)) return;

      const room = roomByName.get(entry.roomName);
      if (selectedBuildings.length && (!room || !selectedBuildings.includes(room.building))) return false;
      if (selectedFloors.length && (!room || !selectedFloors.includes(room.floor))) return false;
      if (selectedZones.length && (!room || !selectedZones.includes(room.zone))) return false;
      if (!grouped.has(target)) grouped.set(target, []);
      grouped.get(target).push(entry);
    });

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "zh-Hans-u-co-pinyin"))
      .map(([label, entries]) => ({ label, entries }));
  }, [activeView, query, roomByName, scheduleData, selectedBuildings, selectedFloors, selectedZones]);

  const displayRooms = onlyAvailable ? availableRooms : filteredRooms;
  const roomGroups = useMemo(() => groupRoomsByBuildingAndFloor(displayRooms), [displayRooms]);
  const occupiedCount = filteredRooms.length - availableRooms.length;
  const activeDay = data?.weekdays.find((day) => day.index === Number(selectedWeekday));
  const activeSlots = data?.timeSlots.filter((slot) => selectedPeriods.includes(slot.code)) ?? [];
  const activePeriodLabel = activeSlots.map((slot) => slot.label).join("、");
  const selectedDate = data
    ? getRoomDateValue(selectedWeek, selectedWeekday, settings.semesterStartDate, getShanghaiParts().year)
    : "";
  const dateRange = useMemo(
    () => getDateRange(settings.semesterStartDate, data?.summary?.maxWeek ?? 18, getShanghaiParts().year),
    [data, settings.semesterStartDate],
  );
  const hasFilters = Boolean(query || selectedBuildings.length || selectedFloors.length || selectedZones.length);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const favoriteRooms = useMemo(
    () => (data?.rooms ?? []).filter((room) => favoriteSet.has(room.name)),
    [data, favoriteSet],
  );
  const querySnapshot = useMemo(
    () =>
      /* 创建一个查询快照对象，包含当前的视图、时间模式、选中的周次、星期几、日期、节次、节次选择模式、是否仅显示可用教室、选中的楼栋、楼层、区域和查询字符串，以及选中的实体标签： */
      createQuerySnapshot({
        activeView,
        temporalMode,
        selectedWeek,
        selectedWeekday,
        selectedDate,
        selectedPeriods,
        periodSelectionMode,
        onlyAvailable,
        selectedBuildings,
        selectedFloors,
        selectedZones,
        query,
        entityLabel: selectedEntity?.label ?? "",
      }),
    [
      activeView,
      temporalMode,
      selectedWeek,
      selectedWeekday,
      selectedDate,
      selectedPeriods,
      periodSelectionMode,
      onlyAvailable,
      selectedBuildings,
      selectedFloors,
      selectedZones,
      query,
      selectedEntity?.label,
    ],
  );

  useEffect(() => {
    if (!urlInitialized || !data) return;
    window.history.replaceState({}, "", getQueryUrl(querySnapshot));
  }, [data, querySnapshot, urlInitialized]);

  useEffect(() => {
    writeStorage(FAVORITES_STORAGE_KEY, favorites);
  }, [favorites]);

  useEffect(() => {
    if (!urlInitialized) return undefined;

    if (activeView !== "available") return undefined;

    const timer = window.setTimeout(() => {
      setRecentQueries((current) => {
        const serialized = JSON.stringify(querySnapshot);
        const next = [
          querySnapshot,
          ...current.filter((item) => JSON.stringify(item) !== serialized),
        ].slice(0, 6);
        writeStorage(RECENT_QUERIES_STORAGE_KEY, next);
        return next;
      });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [activeView, querySnapshot, urlInitialized]);
  /*定义了几个函数来处理筛选器的重置、使用今天的日期、处理日期变化、处理节次模式变化、切换收藏教室、应用最近查询、保存最近查询、打开教室、切换视图、导航到实体、打开实体卡片和从实体打开教室等操作： */
  function resetFilters() {
    setQuery("");
    setSelectedBuildings([]);
    setSelectedFloors([]);
    setSelectedZones([]);
  }
  /*用于重置所有筛选器和状态，包括视图、时间模式、周次、星期几、节次、节次选择模式、是否仅显示可用教室、选中的实体和教室等。根据设置中的默认值和自动计算的时间状态来恢复初始状态： */
  function resetAllFilters() {
    const defaultMode = settings.defaultPeriodMode === "multiple" ? "multiple" : "single";
    const defaultTemporal = autoTemporal ?? {
      week: DEFAULT_WEEK,
      weekday: DEFAULT_WEEKDAY,
      period: DEFAULT_PERIOD,
    };

    setActiveView(settings.defaultView === "courses" ? "courses" : "available");
    setTemporalMode("week");
    setSelectedWeek(defaultTemporal.week);
    setSelectedWeekday(defaultTemporal.weekday);
    setSelectedPeriods([defaultTemporal.period]);
    setPeriodSelectionMode(defaultMode);
    setOnlyAvailable(settings.defaultOnlyAvailable !== false);
    setSelectedEntity(null);
    setSelectedRoom(null);
    resetFilters();
  }
  /*使用此函数可以将应用程序的状态设置为当前日期和时间对应的周次、星期几和节次。它会调用 getAutoTemporalState 函数来获取当前时间的自动计算状态，并更新相关的状态变量： */
  function useToday() {
    if (!data) return;
    const today = getAutoTemporalState(data, settings);
    setSelectedWeek(today.week);
    setSelectedWeekday(today.weekday);
    setSelectedPeriods([today.period]);
    setTemporalMode("date");
    setActiveView("available");
    setSelectedEntity(null);
    setSelectedRoom(null);
  }
  /*处理日期变化的函数 */
  function handleDateChange(value) {
    const temporal = getTemporalFromDate(value, settings.semesterStartDate, data.summary.maxWeek);
    if (!temporal) return;
    setSelectedWeek(temporal.week);
    setSelectedWeekday(temporal.weekday);
    setTemporalMode("date");
  }
  /*处理节次模式变化的函数 */
  function handlePeriodModeChange(mode) {
    setPeriodSelectionMode(mode);
    if (mode === "single" && selectedPeriods.length > 1) {
      setSelectedPeriods([selectedPeriods[0]]);
    }
  }
  /*切换收藏教室的函数 */
  function toggleFavorite(roomName) {
    setFavorites((current) =>
      current.includes(roomName)
        ? current.filter((name) => name !== roomName)
        : [...current, roomName],
    );
  }
  /*应用最近查询的函数 */
  function applyRecentQuery(snapshot) {
    if (!snapshot) return;
    setActiveView(normalizeView(snapshot.activeView));
    setSelectedEntity(snapshot.entityLabel ? { view: normalizeView(snapshot.activeView), label: snapshot.entityLabel } : null);
    setSelectedRoom(null);
    setTemporalMode(snapshot.temporalMode === "date" ? "date" : "week");
    setSelectedWeek(clamp(Number(snapshot.selectedWeek) || DEFAULT_WEEK, 1, data.summary.maxWeek));
    setSelectedWeekday(clamp(Number(snapshot.selectedWeekday) || DEFAULT_WEEKDAY, 1, data.weekdays.length));
    setSelectedPeriods(snapshot.selectedPeriods?.length ? snapshot.selectedPeriods : [DEFAULT_PERIOD]);
    setPeriodSelectionMode(snapshot.periodSelectionMode === "multiple" ? "multiple" : "single");
    setOnlyAvailable(snapshot.onlyAvailable !== false);
    setSelectedBuildings(snapshot.selectedBuildings ?? []);
    setSelectedFloors(snapshot.selectedFloors ?? []);
    setSelectedZones(snapshot.selectedZones ?? []);
    setQuery(snapshot.query ?? "");

    const dateTemporal = getTemporalFromDate(snapshot.selectedDate, settings.semesterStartDate, data.summary.maxWeek);
    if (snapshot.temporalMode === "date" && dateTemporal) {
      setSelectedWeek(dateTemporal.week);
      setSelectedWeekday(dateTemporal.weekday);
    }
  }

  /*保存最近查询的函数 */
  function saveRecentQuery(snapshot = querySnapshot) {
    setRecentQueries((current) => {
      const serialized = JSON.stringify(snapshot);
      const next = [snapshot, ...current.filter((item) => JSON.stringify(item) !== serialized)].slice(0, 6);
      writeStorage(RECENT_QUERIES_STORAGE_KEY, next);
      return next;
    });
  }
  /* 打开教室的函数 */
  function openRoom(room) {
    setSelectedRoom(room);
    setSelectedEntity(null);
    setCommandOpen(false);
  }
  /* 切换视图的函数 */
  function changeView(view) {
    setActiveView(normalizeView(view));
    setQuery("");
    setSelectedRoom(null);
    setSelectedEntity(null);
  }
  /* 导航到实体的函数 */
  function navigateToEntity(view, label) {
    if (!label) return;
    const nextView = normalizeView(view);
    setSelectedRoom(null);
    setActiveView(nextView);
    setQuery(label);
    setSelectedEntity({ view: nextView, label });
    setCommandOpen(false);
  }
  /* 打开实体卡片的函数 */
  function openEntityCard(view, label) {
    if (!label) return;
    const nextView = normalizeView(view);
    saveRecentQuery({
      ...querySnapshot,
      activeView: nextView,
      query: label,
      entityLabel: label,
    });
    navigateToEntity(nextView, label);
  }
  /* 从实体打开教室的函数 */
  function openRoomFromEntity(room) {
    setSelectedEntity(null);
    openRoom(room);
  }
  /*如果加载数据时发生错误，则显示一个加载失败的界面，提示用户数据加载失败，并提供重新加载按钮和联系开发者的链接： */
  if (loadError) {
    return (
      <main className="load-state">
        <div className="load-card">
          <CircleHelp size={30} />
          <h1>数据加载失败</h1>
          <p>{loadError}.<br />如多次出现此问题，请<a href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>联系开发者</a>。
          </p>
          <button className="button button-primary" onClick={() => window.location.reload()} type="button">
            重新加载
          </button>
        </div>
      </main>
    );
  }
  /*如果数据尚未加载完成或设置尚未加载完成，则显示一个加载屏幕组件，显示当前的加载进度和阶段信息： */
  if (!data || !scheduleData || !settingsLoaded) {
    return <LoadingScreen progress={loadProgress} stage={loadStage} notice={loadNotice} />;
  }
  /*如果数据和设置都已加载完成，则渲染应用程序的主界面，包括顶部栏、主内容区域、通知中心、筛选栏等。根据当前的状态变量，显示不同的视图和组件： */
  return (
    <div className="app-shell">
      <header className="topbar">
            <a className="brand" href={import.meta.env.BASE_URL}>
          <div className="brand-mark">
            <BrandMarkIcon />
          </div>
          <div>
            <strong>校园课程助手</strong>
            <span>ZSC</span>
          </div>
        </a>
        <div className="topbar-actions">
          {settings.enableCommandPalette ? (
            <button className="button button-outline topbar-command" onClick={() => setCommandOpen(true)} type="button">
              <Search size={15} />
              <span>搜索</span>
              <kbd>{isMac ? "⌘ K" : "Ctrl + K"}</kbd>
            </button>
          ) : null}
          <button
            className="icon-button notification-center-button"
            onClick={() => setNotificationCenterOpen(true)}
            type="button"
            aria-label="打开通知中心"
            title="通知中心"
          >
            <Bell size={18} />
          </button>
        </div>
      </header>

      <main className="page-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14} /> 校园课程助手
            </div>
            <h1>
              查课程
              <br />
              <em>看课表</em>，找教室
            </h1>
            <p>课程、教师、班级与教室，一站式查询。</p>
            <div className="hero-meta" aria-label="更新时间">
              <div className="hero-meta-item">
                <Clock3 size={15} />
                <span>助手更新时间</span>
                <time dateTime={BUILD_TIME}>{formatDateTime(BUILD_TIME)}</time>
              </div>
              <div className="hero-meta-item">
                <Database size={15} />
                <span>数据更新时间</span>
                <time dateTime={data.generatedAt}>{formatDateTime(data.generatedAt)}</time>
              </div>
            </div>
          </div>
          <div className="hero-note">
            <span>现在是</span>
            <strong>
              {currentPhaseLabel} {currentDay?.shortLabel ?? ""}
            </strong>
            <span>
              {currentTime
                ? `${pad2(currentTime.month)}月${pad2(currentTime.day)}日 ${pad2(currentTime.hour)}:${pad2(currentTime.minute)}`
                : ""}
            </span>
          </div>
        </section>

        <NotificationCenter notifications={notifications} />

        {filtersVisible ? (
          <section ref={queryPanelRef} className={cn("query-panel", settings.stickyFilters && "is-sticky")}>
          <div className="panel-topline">
            <div className="view-tabs">
              <button
                className={cn("view-tab", activeView === "available" && "is-active")}
                onClick={() => changeView("available")}
                type="button"
              >
                <LayoutGrid size={16} />
                教室
              </button>
              <button
                className={cn("view-tab", activeView === "courses" && "is-active")}
                onClick={() => changeView("courses")}
                type="button"
              >
                <BookOpen size={16} />
                课程
              </button>
              <button
                className={cn("view-tab", activeView === "teachers" && "is-active")}
                onClick={() => changeView("teachers")}
                type="button"
              >
                <UserRound size={16} />
                教师
              </button>
              <button
                className={cn("view-tab", activeView === "classes" && "is-active")}
                onClick={() => changeView("classes")}
                type="button"
              >
                <Users size={16} />
                班级
              </button>
            </div>
            <div className="panel-actions">
              <button
                className="button button-outline filter-visibility-button"
                onClick={() => setFiltersVisible(false)}
                type="button"
                aria-label="隐藏筛选栏"
                title="隐藏筛选栏"
              >
                <EyeOff size={16} />
                隐藏筛选
              </button>
            </div>
          </div>

          <div className={cn("query-fields", activeView !== "available" && "is-directory-query") }>
            {activeView === "available" ? (
              <>
                <TemporalPicker
                  onToday={useToday}
                  mode={temporalMode}
                  onModeChange={setTemporalMode}
                  selectedWeek={selectedWeek}
                  selectedWeekday={selectedWeekday}
                  selectedDate={selectedDate}
                  onWeekChange={(value) => {
                    setSelectedWeek(value);
                    setTemporalMode("week");
                  }}
                  onWeekdayChange={(value) => {
                    setSelectedWeekday(value);
                    setTemporalMode("week");
                  }}
                  onDateChange={handleDateChange}
                  weekdays={data.weekdays}
                  maxWeek={data.summary.maxWeek}
                  dateRange={dateRange}
                />
                <PeriodPicker
                  timeSlots={data.timeSlots}
                  selectedPeriods={selectedPeriods}
                  selectionMode={periodSelectionMode}
                  onModeChange={handlePeriodModeChange}
                  onChange={setSelectedPeriods}
                />
              </>
            ) : null}
            <label className="search-field">
              <span className="field-label">{getViewSearchLabel(activeView)}</span>
              <span className="search-input-wrap">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    activeView === "available"
                      ? "输入教室号或楼栋..."
                      : activeView === "courses"
                        ? "例如：高等数学、张老师、计算机..."
                        : activeView === "teachers"
                          ? "例如：张老师、王教授..."
                          : "例如：电科23A、26计科AB...(可能需要尝试不同的关键词)"
                  }
                />
                {query ? (
                  <button className="clear-search" onClick={() => setQuery("")} type="button" aria-label="清空搜索">
                    <X size={15} />
                  </button>
                ) : null}
              </span>
            </label>
          </div>

          <div className="filter-row">
            <div className="filter-title">
              <SlidersHorizontal size={15} /> 地点筛选
            </div>
            <MultiSelectField
              label="楼栋"
              values={selectedBuildings}
              onChange={setSelectedBuildings}
              icon={Building2}
              placeholder="全部楼栋"
              options={buildings.map((building) => ({ value: building, label: building }))}
            />
            <MultiSelectField
              label="楼层"
              values={selectedFloors}
              onChange={setSelectedFloors}
              placeholder="全部楼层"
              options={floors.map((floor) => ({ value: floor, label: `${floor} 层` }))}
            />
            <MultiSelectField
              label="区域"
              values={selectedZones}
              onChange={setSelectedZones}
              placeholder="全部区域"
              options={zones.map((zone) => ({ value: zone, label: zone.replace("普通教学区", "教学区") }))}
            />
            {activeView === "available" ? (
              <Toggle checked={onlyAvailable} onChange={setOnlyAvailable} label="仅显示空闲" />
            ) : null}
            {hasFilters ? (
              <button className="button button-outline reset-button" onClick={resetFilters} type="button">
                重置筛选
              </button>
            ) : null}
          </div>
          <div className="query-panel-footer">
            <button className="button button-outline reset-all-button" onClick={resetAllFilters} type="button">
              重置全部筛选规则
            </button>
          </div>
          </section>
        ) : (
          <div ref={queryPanelRef} className={cn("filter-collapsed-bar", settings.stickyFilters && "is-sticky")}>
            <span>
              <PanelTop size={15} />
              筛选栏已隐藏
            </span>
            <button className="button button-outline" onClick={() => setFiltersVisible(true)} type="button">
              <Eye size={14} />
              显示筛选
            </button>
          </div>
        )}

        {favoriteRooms.length ? (
          <section className="favorite-strip" aria-label="收藏教室">
            <div className="favorite-strip-title">
              <Heart size={15} fill="currentColor" />
              收藏教室
            </div>
            <div className="favorite-room-list">
              {favoriteRooms.map((room) => (
                <button className="favorite-room-chip" key={room.name} onClick={() => openRoom(room)} type="button">
                  <span>{room.name}</span>
                  <small>{room.building} · {room.floor}层</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {recentQueries.length ? (
          <section className="recent-query-strip" aria-label="最近查看">
            <div className="recent-query-title">
              <History size={15} />
              最近查看
            </div>
            <div className="recent-query-list">
              {recentQueries.map((snapshot, index) => (
                <button
                  className="recent-query-chip"
                  key={`${JSON.stringify(snapshot)}-${index}`}
                  onClick={() => applyRecentQuery(snapshot)}
                  type="button"
                  title={getRecentQueryLabel(snapshot, data)}
                >
                  {getRecentQueryLabel(snapshot, data)}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section ref={resultsSectionRef} className={cn("results-section", settings.infoDisplay === 0 && "is-masked")}>
          <div className="results-content">
            <div className="results-heading">
            <div>
              <div className="section-kicker">
                <span className="live-pulse" />
                {activeView === "available" ? `实时${onlyAvailable ? "可用" : ""}情况` : `${getViewLabel(activeView)}结果`}
              </div>
              <h2>
                {activeView === "available"
                  ? `${activeDay?.shortLabel} ${activePeriodLabel} 的${onlyAvailable ? "空闲" : "全部"}教室`
                  : query
                    ? `“${query}”的检索结果`
                    : "输入关键词开始检索"}
              </h2>
              <p>
                {activeView === "available"
                  ? `第 ${selectedWeek} 周 · ${activeSlots.length ? `${activeSlots[0].start} - ${activeSlots[activeSlots.length - 1].end}` : ""}`
                  : query
                    ? activeView === "courses"
                      ? "已忽略周次、星期和节次，点击课程卡片查看完整周课表"
                      : activeView === "teachers"
                        ? "已忽略周次、星期和节次，点击教师卡片查看完整周课表"
                        : "已忽略周次、星期和节次，点击班级卡片查看完整周课表"
                    : activeView === "courses"
                      ? "搜索课程名称"
                      : `搜索${activeView === "teachers" ? "教师姓名" : "行政班名称"}`}
              </p>
            </div>
            {activeView === "available" ? (
              <div className="results-count">
                <strong>{displayRooms.length}</strong>
                <span>/ {filteredRooms.length} 间{onlyAvailable ? "空闲" : ""}</span>
              </div>
            ) : null}
            </div>

            {activeView === "available" ? (
              <>
                <div className="stats-grid">
                  <StatCard icon={DoorOpen} label={onlyAvailable ? "空闲教室" : "匹配教室"} value={displayRooms.length} detail="当前筛选范围内" tone="green" />
                  <StatCard icon={Building2} label="涉及楼栋" value={new Set(displayRooms.map((room) => room.building)).size} detail={`共 ${buildings.length} 栋`} tone="blue" />
                  <StatCard icon={Clock3} label="当前时段" value={activePeriodLabel} detail={selectedPeriods.length > 1 ? "多节次筛选" : `${activeSlots[0]?.start ?? ""} - ${activeSlots[0]?.end ?? ""}`} tone="orange" />
                  <StatCard icon={Filter} label="已占用" value={occupiedCount} detail="当前筛选范围内" tone="slate" />
                </div>

                {roomGroups.length ? (
                  <div className="building-groups">
                    {roomGroups.map((buildingGroup) => (
                      <section className="building-group" key={buildingGroup.building}>
                        <div className="group-heading">
                          <div className="group-title">
                            <span className="building-icon">
                              <Building2 size={16} />
                            </span>
                            <strong>{buildingGroup.building}</strong>
                            <span>{buildingGroup.total} 间{onlyAvailable ? "空闲" : "匹配"}</span>
                          </div>
                          <span className="group-line" />
                        </div>

                        {buildingGroup.floors.map((floorGroup) => (
                          <div className="floor-group" key={`${buildingGroup.building}-${floorGroup.floor}`}>
                            <div className="floor-heading">
                              <span className="floor-chip">{floorGroup.floor} 层</span>
                              <span>{floorGroup.rooms.length} 间</span>
                            </div>
                            <div className="room-grid">
                              {floorGroup.rooms.map((room) => (
                                <RoomCard
                                  key={room.name}
                                  room={room}
                                  onOpen={setSelectedRoom}
                                  selectedWeek={selectedWeek}
                                  selectedWeekday={selectedWeekday}
                                  selectedPeriods={selectedPeriods}
                                  isFavorite={favoriteSet.has(room.name)}
                                  onToggleFavorite={toggleFavorite}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                ) : (
                  <EmptyState hasQuery={hasFilters} onReset={resetFilters} />
                )}
              </>
            ) : activeView === "courses" ? (
              <div className="course-results">
                {courseCards.length ? (
                  courseCards.slice(0, settings.searchResultLimit).map(({ label, entries }) => (
                    <EntityResultCard
                      key={label}
                      view="courses"
                      label={label}
                      entries={entries}
                      onOpen={openEntityCard}
                    />
                  ))
                ) : (
                  <DirectoryEmptyState view="courses" hasQuery={Boolean(query)} onReset={() => setQuery("")} />
                )}
                {courseCards.length > settings.searchResultLimit ? (
                  <p className="result-limit">
                    结果较多，仅展示前 {settings.searchResultLimit} 条，请继续缩小搜索范围。
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="course-results">
                {directoryResults.length ? (
                  directoryResults.slice(0, settings.searchResultLimit).map(({ label, entries }) => (
                    <EntityResultCard
                      key={label}
                      view={activeView}
                      label={label}
                      entries={entries}
                      onOpen={openEntityCard}
                    />
                  ))
                ) : (
                  <DirectoryEmptyState view={activeView} hasQuery={Boolean(query)} onReset={() => setQuery("")} />
                )}
                {directoryResults.length > settings.searchResultLimit ? (
                  <p className="result-limit">
                    结果较多，仅展示前 {settings.searchResultLimit} 条，请继续缩小搜索范围。
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {settings.infoDisplay === 0 ? (
            <div className="results-mask" aria-hidden="true">
              <div className="results-mask-card">
                <ShieldIcon />
                <strong>{settings.maskMessage?.title || DEFAULT_MASK_MESSAGE.title}</strong>
                <span>{settings.maskMessage?.text || DEFAULT_MASK_MESSAGE.text}</span>
              </div>
            </div>
          ) : null}
        </section>
      </main>


      <footer className="footer">
        <div className="footer-row">
          <span>数据更新于 {formatDateTime(data.generatedAt)}</span>
        </div>

        <div className="footer-row">
          <a 
          href="https://github.com/TifeCide" target="_blank" rel="noopener noreferrer" className="footer-link"><
          Github size={16} />
          <span>TifeCide</span>
          </a>
        </div>

        <div className="footer-row footer-powered">
          <p>Powered by Cloudflare Pages 51LA</p>
        </div>
      </footer>

      <RoomDialog
        room={selectedRoom}
        data={data}
        selectedWeek={selectedWeek}
        selectedWeekday={selectedWeekday}
        selectedPeriods={selectedPeriods}
        onClose={() => setSelectedRoom(null)}
        isFavorite={selectedRoom ? favoriteSet.has(selectedRoom.name) : false}
        onToggleFavorite={toggleFavorite}
        onNavigate={navigateToEntity}
      />

      <EntityScheduleDialog
        entity={selectedEntity}
        scheduleData={scheduleData}
        data={data}
        selectedWeek={selectedWeek}
        selectedWeekday={selectedWeekday}
        selectedPeriods={selectedPeriods}
        currentNow={currentNow}
        currentTemporal={currentTemporal}
        maxWeek={data.summary.maxWeek}
        roomByName={roomByName}
        onClose={() => setSelectedEntity(null)}
          onWeekChange={(week) => {
          setSelectedWeek(clamp(week, 1, data.summary.maxWeek));
          setTemporalMode("week");
        }}
        onFilterChange={(key, value) => {
          setSelectedEntity((current) => current ? { ...current, [key]: value } : current);
        }}
        onNavigate={navigateToEntity}
        onOpenRoom={openRoomFromEntity}
      />

      <NotificationCenterDialog
        open={notificationCenterOpen}
        notifications={allNotifications}
        onClose={() => setNotificationCenterOpen(false)}
      />

      {settings.enableCommandPalette ? (
        <CommandDialog
          open={commandOpen}
          onOpenChange={setCommandOpen}
          data={data}
          commandQuery={commandQuery}
          setCommandQuery={setCommandQuery}
          onPickRoom={openRoom}
          availableRooms={availableRooms}
          courseResults={courseResults}
        />
      ) : null}

      {settings.enableBackToTop ? (
        <button
          className={cn("back-to-top", scrollProgress > 0.08 && "is-visible")}
          type="button"
          aria-label="回到顶部"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ "--scroll-progress": `${Math.round(scrollProgress * 100)}%` }}
        >
          <span className="back-to-top-ring" aria-hidden="true">
            <span className="back-to-top-core">
              <ArrowUp size={16} className="back-to-top-arrow" />
            </span>
          </span>
        </button>
      ) : null}

      <button
        className={cn("back-to-top results-jump", showResultsJump && "is-visible")}
        type="button"
        aria-label="查看查询结果"
        title="查看查询结果"
        onClick={() => resultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        <span className="back-to-top-ring" aria-hidden="true">
          <span className="back-to-top-core">
            <Check size={16} className="results-check" />
          </span>
        </span>
      </button>
    </div>
  );
}

/*定义了一个 ShieldIcon 组件，用于在结果遮罩中显示一个闪烁的图标： */
function ShieldIcon() {
  return (
    <div className="results-mask-icon">
      <Sparkles size={18} />
    </div>
  );
}

/*定义了一个 AppErrorBoundary 组件，用于捕获应用程序中的错误，并显示一个错误界面： */
export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="load-state">
          <div className="load-card">
            <CircleHelp size={30} />
            <h1>页面运行异常</h1>
            <p>{this.state.error.message}</p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

/*定义了一个 App 组件，它是应用程序的根组件，负责加载数据和设置，并渲染 AppContent 组件： */
export default App;
