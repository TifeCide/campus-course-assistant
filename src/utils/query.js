import { DEFAULT_PERIOD, DEFAULT_WEEK, DEFAULT_WEEKDAY } from "../constants";

/* 创建一个查询快照对象，包含当前的视图、时间模式、选定的周次、星期几、日期、节次、建筑物、楼层、区域以及搜索查询和实体标签等信息。返回一个包含这些信息的对象： */
export function createQuerySnapshot({
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
export function getQuerySnapshotFromUrl(search) {
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
export function getViewLabel(view) {
  return {
    available: "教室",
    courses: "课程",
    teachers: "教师",
    classes: "班级",
  }[view] || "教室";
}

/* 根据视图类型返回对应的搜索标签文本，如果视图类型不在预定义的列表中，则默认返回 "搜索教室"： */
export function getViewSearchLabel(view) {
  return {
    available: "搜索教室",
    courses: "搜索课程",
    teachers: "搜索教师",
    classes: "搜索行政班",
  }[view] || "搜索教室";
}

/* 将视图类型标准化为预定义的列表中的值，如果不在列表中，则默认返回 "available"： */
export function normalizeView(value) {
  return ["available", "courses", "teachers", "classes"].includes(value) ? value : "available";
}

export function normalizeDetailStack(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (item?.type === "room" && item.name) {
        return { type: "room", name: String(item.name) };
      }
      if (item?.type === "entity" && item.label) {
        return {
          type: "entity",
          view: normalizeView(item.view),
          label: String(item.label),
          courseFilter: item.courseFilter || "",
          teacherFilter: item.teacherFilter || "",
          classFilter: item.classFilter || "",
        };
      }
      return null;
    })
    .filter(Boolean);
}

export function areSameDetails(left, right) {
  if (!left || !right || left.type !== right.type) return false;
  if (left.type === "room") return left.name === right.name;
  return left.view === right.view && left.label === right.label;
}

/*根据查询快照对象生成对应的 URL 查询字符串，包含视图、时间模式、周次、星期几、日期、节次、建筑物、楼层、区域以及搜索查询和实体标签等信息。返回一个完整的 URL 字符串，包括路径、查询参数和哈希值： */
export function getQueryUrl(snapshot) {
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

  const queryString = params.toString();
  return `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
}

/* 根据查询快照对象和数据生成最近查询的标签文本。如果存在实体标签，则返回视图类型和实体标签的组合；否则，根据选定的周次、星期几、节次和位置范围生成一个描述性的标签文本： */
export function getRecentQueryLabel(snapshot, data) {
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
