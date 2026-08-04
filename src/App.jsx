import React, { Component, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  ArrowUp,
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
  Moon,
  PanelTop,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TriangleAlert,
  Users,
  X,
  Github,
} from "lucide-react";

const DATA_URL = `${import.meta.env.BASE_URL}data/classroom-data.json`;
const SETTINGS_URL = `${import.meta.env.BASE_URL}data/setting.json`;
const FAVORITES_STORAGE_KEY = "classroom-favorites";
const RECENT_QUERIES_STORAGE_KEY = "classroom-recent-queries";
const DISMISSED_NOTIFICATIONS_STORAGE_KEY = "classroom-dismissed-notifications";
const DEFAULT_WEEK = 1;
const DEFAULT_WEEKDAY = 1;
const DEFAULT_PERIOD = "0102";
const EXAM_WEEK_COUNT = 3;
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

const cn = (...classes) => classes.filter(Boolean).join(" ");

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable in private browsing or restricted embeds.
  }
}

function getNotificationType(value) {
  return ["info", "warning", "error"].includes(value) ? value : "info";
}

function isNotificationTwiceEnabled(value) {
  return value === true || Number(value) === 1;
}

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

function isNotificationTriggered(notification, date = new Date()) {
  const currentDate = getShanghaiParts(date).dateLabel;
  const inRange = currentDate >= notification.notifyStartDate && currentDate <= notification.notifyEndDate;
  return notification.notifyInDate === 1 ? inRange : !inRange;
}

function getDismissedNotificationKeys() {
  const value = readStorage(DISMISSED_NOTIFICATIONS_STORAGE_KEY, {});
  if (Array.isArray(value)) return new Set(value.filter((key) => typeof key === "string"));
  if (!value || typeof value !== "object") return new Set();
  return new Set(Object.keys(value).filter((key) => value[key] === true));
}

function dismissNotificationPersistently(notificationKey) {
  const value = readStorage(DISMISSED_NOTIFICATIONS_STORAGE_KEY, {});
  const dismissed = value && !Array.isArray(value) && typeof value === "object" ? value : {};
  dismissed[notificationKey] = true;
  writeStorage(DISMISSED_NOTIFICATIONS_STORAGE_KEY, dismissed);
}

function formatDataUpdatedAt(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
}

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

function getShanghaiDate(year, month, day, hour = 0, minute = 0) {
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00+08:00`);
}

function getFirstMondayOfSeptember(year) {
  let candidate = getShanghaiDate(year, 9, 1);
  for (let index = 0; index < 7; index += 1) {
    if (getShanghaiParts(candidate).weekdayIndex === 1) return candidate;
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  return candidate;
}

function parseDateAtShanghaiNoon(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return getShanghaiDate(Number(match[1]), Number(match[2]), Number(match[3]), 12, 0);
}

function getAcademicWeek(date = new Date(), semesterStartDate = "") {
  const parts = getShanghaiParts(date);
  const termStart = parseDateAtShanghaiNoon(semesterStartDate) ?? getFirstMondayOfSeptember(parts.year);
  const current = getShanghaiDate(parts.year, parts.month, parts.day, 12, 0);

  if (current < termStart) return 1;

  const diffDays = Math.floor((current - termStart) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

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

function getRoomEntries(room, weekday, periodCode, week) {
  return room?.slots?.[String(weekday)]?.[periodCode]?.filter((entry) => entry.weeks.includes(Number(week))) ?? [];
}

function getRoomEntriesForPeriods(room, weekday, periodCodes, week) {
  return periodCodes.flatMap((periodCode) => getRoomEntries(room, weekday, periodCode, week));
}

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
  onProgress?.(1);
  return JSON.parse(text);
}

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
  };
}

function getQuerySnapshotFromUrl(search) {
  const params = new URLSearchParams(search);
  const parseList = (key) => params.get(key)?.split(",").filter(Boolean) ?? [];

  return {
    activeView: params.get("view") === "courses" ? "courses" : "available",
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
  };
}

function getQueryUrl(snapshot) {
  const params = new URLSearchParams();

  if (snapshot.activeView === "courses") params.set("view", "courses");
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

  const queryString = params.toString();
  return `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
}

function getRecentQueryLabel(snapshot, data) {
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

function getRoomDateValue(week, weekday, semesterStartDate, fallbackYear = new Date().getFullYear()) {
  const start = parseDateAtShanghaiNoon(semesterStartDate) ?? getFirstMondayOfSeptember(fallbackYear);
  const offsetDays = (Number(week) - 1) * 7 + (Number(weekday) - 1);
  const date = new Date(start.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = getShanghaiParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

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

function getTemporalFromDate(value, semesterStartDate, maxWeek) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = getShanghaiDate(Number(match[1]), Number(match[2]), Number(match[3]), 12, 0);
  return {
    week: clamp(getAcademicWeek(date, semesterStartDate), 1, Number(maxWeek)),
    weekday: getShanghaiParts(date).weekdayIndex,
  };
}

function compareRooms(a, b) {
  const buildingDiff = a.building.localeCompare(b.building, "zh-Hans-u-co-pinyin");
  if (buildingDiff !== 0) return buildingDiff;
  const floorDiff = Number(a.floor) - Number(b.floor);
  if (floorDiff !== 0) return floorDiff;
  return a.name.localeCompare(b.name, "zh-Hans-u-co-pinyin", { numeric: true });
}

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

function getUniqueSorted(values) {
  return [...new Set(values)].sort((a, b) =>
    String(a).localeCompare(String(b), "zh-Hans-u-co-pinyin", { numeric: true }),
  );
}

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

function TemporalPicker({
  mode,
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
      <div className="field-label-row">
        <span className="field-label">时间定位</span>
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

function PeriodPicker({ timeSlots, selectedPeriods, selectionMode, onModeChange, onChange }) {
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

function EmptyState({ hasQuery, onReset }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <DoorOpen size={28} strokeWidth={1.5} />
      </div>
      <h3>{hasQuery ? "没有符合条件的教室" : "当前时段暂无空闲教室"}</h3>
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

function CourseRow({ entry, room, onOpen }) {
  return (
    <button className="course-row" onClick={() => onOpen(room)} type="button">
      <div className="course-main">
        <span className="course-name">{entry.courseName || "未命名课程"}</span>
        <span className="course-room">{room.name}</span>
      </div>
      <div className="course-info">
        <span>
          <Users size={14} />
          {entry.teacher || "未标注教师"}
        </span>
        <span>
          <CalendarDays size={14} />
          {entry.weekdayLabel} · {entry.periodCode}
        </span>
        <span>{entry.weekText || "未标注周次"}</span>
      </div>
      <ArrowUpRight className="course-arrow" size={16} />
    </button>
  );
}

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

function NotificationIcon({ type, size = 18 }) {
  const Icon = type === "error" || type === "warning" ? TriangleAlert : Info;
  return <Icon size={size} />;
}

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

  function requestDismiss() {
    if (closingRef.current) return;
    closingRef.current = true;
    if (isMobile) {
      dismissRef.current();
    } else {
      setClosing(true);
    }
  }

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

  if (isMobile) {
    return (
      <Modal open onOpenChange={requestDismiss} className="dialog notification-dialog">
        {content}
      </Modal>
    );
  }

  return createPortal(<div className="notification-toast-viewport">{content}</div>, document.body);
}

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

function RoomDialog({
  room,
  data,
  selectedWeek,
  selectedWeekday,
  selectedPeriods,
  onClose,
  isFavorite,
  onToggleFavorite,
}) {
  if (!room) return null;

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
                      <strong>{entries[0].courseName}</strong>
                      <span>{entries[0].teacher || "未标注教师"}</span>
                      {entries.length > 1 ? <small>+{entries.length - 1} 项安排</small> : null}
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

function CommandDialog({
  open,
  onOpenChange,
  data,
  commandQuery,
  setCommandQuery,
  onPickRoom,
  onPickAction,
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

  const quickActions = [
    {
      label: "定位现在",
      description: "回到当前日期、星期和节次",
      icon: CalendarDays,
      action: () => onPickAction("today"),
    },
    {
      label: "切到空闲教室",
      description: "回到默认首页视图",
      icon: LayoutGrid,
      action: () => onPickAction("available"),
    },
    {
      label: "切到课程检索",
      description: "按课程 / 教师 / 班级搜索",
      icon: BookOpen,
      action: () => onPickAction("courses"),
    },
    {
      label: "清空筛选",
      description: "重置楼栋、楼层、区域和关键词",
      icon: Filter,
      action: () => onPickAction("reset"),
    },
  ];

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
          <>
            <div className="command-group">
              <div className="command-group-title">快速操作</div>
              <div className="command-list">
                {quickActions.map((item) => (
                  <button className="command-item" key={item.label} onClick={item.action} type="button">
                    <span className="command-item-icon">
                      <item.icon size={15} />
                    </span>
                    <span className="command-item-copy">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="command-group command-columns">
              <div>
                <div className="command-group-title">空闲教室</div>
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
                </div>
              </div>
            </div>
          </>
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

function LoadingScreen({ progress, stage }) {
  return (
    <main className="load-state">
      <div className="loading-card">
        <div className="loading-card-head">
          <div className="brand-mark">
            <DoorOpen size={19} strokeWidth={2.2} />
          </div>
          <div>
            <strong>教室查询 · ZSC</strong>
            <span>正在准备数据</span>
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

function App() {
  const isMac = typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStage, setLoadStage] = useState("正在准备数据...");
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
  const [isDark, setIsDark] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [favorites, setFavorites] = useState(() => {
    const value = readStorage(FAVORITES_STORAGE_KEY, []);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  });
  const [recentQueries, setRecentQueries] = useState(() => {
    const value = readStorage(RECENT_QUERIES_STORAGE_KEY, []);
    return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
  });
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [urlInitialized, setUrlInitialized] = useState(false);
  const autoInitialized = useRef(false);
  const [currentNow, setCurrentNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    async function loadResources() {
      try {
        setLoadStage("正在加载教室数据...");
        const dataValue = await fetchJsonWithProgress(DATA_URL, (progress) => {
          if (!cancelled) {
            setLoadProgress(progress * 0.86);
            setLoadStage(`正在加载教室数据 ${Math.round(progress * 100)}%`);
          }
        });

        if (cancelled) return;
        setData(dataValue);
        setLoadStage("正在读取网站配置...");

        const settingsValue = await fetchJsonWithProgress(SETTINGS_URL, (progress) => {
          if (!cancelled) {
            setLoadProgress(0.86 + progress * 0.14);
            setLoadStage(`正在读取网站配置 ${Math.round(progress * 100)}%`);
          }
        });

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

  useEffect(() => {
    if (!data || !settingsLoaded || urlInitialized) return;

    const params = new URLSearchParams(window.location.search);
    const hasSharedState = ["view", "mode", "week", "weekday", "date", "periods", "periodMode", "available", "buildings", "floors", "zones", "q"]
      .some((key) => params.has(key));
    const shared = getQuerySnapshotFromUrl(window.location.search);
    const validPeriods = shared.selectedPeriods.filter((code) => data.timeSlots.some((slot) => slot.code === code));
    const nextPeriods = validPeriods.length ? validPeriods : [DEFAULT_PERIOD];

    if (hasSharedState) {
      const validWeek = clamp(shared.selectedWeek, 1, data.summary.maxWeek);
      const validWeekday = clamp(shared.selectedWeekday, 1, data.weekdays.length);
      setActiveView(shared.activeView);
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

  useEffect(() => {
    const nextFloors = selectedFloors.filter((floor) => floors.includes(floor));
    if (nextFloors.length !== selectedFloors.length) {
      setSelectedFloors(nextFloors);
    }
  }, [floors, selectedFloors]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

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

  useEffect(() => {
    const updateScrollProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      setScrollProgress(Number.isFinite(progress) ? clamp(progress, 0, 1) : 0);
    };

    updateScrollProgress();
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("resize", updateScrollProgress);
    return () => {
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, []);

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

  const courseResults = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const matches = [];
    for (const room of data.rooms) {
      if (selectedBuildings.length > 0 && !selectedBuildings.includes(room.building)) continue;
      if (selectedFloors.length > 0 && !selectedFloors.includes(room.floor)) continue;
      if (selectedZones.length > 0 && !selectedZones.includes(room.zone)) continue;

      for (const entry of room.entries) {
        const searchText = [
          entry.courseName,
          entry.teacher,
          entry.classGroup,
          room.name,
          room.building,
          room.zone,
        ]
          .join(" ")
          .toLowerCase();

        if (!searchText.includes(normalizedQuery)) continue;
        if (!entry.weeks.includes(Number(selectedWeek))) continue;
        if (entry.weekday !== Number(selectedWeekday)) continue;
        if (!selectedPeriods.includes(entry.periodCode)) continue;

        matches.push({ entry, room });
      }
    }

    return matches;
  }, [data, query, selectedBuildings, selectedFloors, selectedZones, selectedPeriods, selectedWeek, selectedWeekday]);

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
  }, [querySnapshot, urlInitialized]);

  function resetFilters() {
    setQuery("");
    setSelectedBuildings([]);
    setSelectedFloors([]);
    setSelectedZones([]);
  }

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
    resetFilters();
  }

  function useToday() {
    if (!data) return;
    const today = getAutoTemporalState(data, settings);
    setSelectedWeek(today.week);
    setSelectedWeekday(today.weekday);
    setSelectedPeriods([today.period]);
    setTemporalMode("date");
    setActiveView("available");
  }

  function handleDateChange(value) {
    const temporal = getTemporalFromDate(value, settings.semesterStartDate, data.summary.maxWeek);
    if (!temporal) return;
    setSelectedWeek(temporal.week);
    setSelectedWeekday(temporal.weekday);
    setTemporalMode("date");
  }

  function handlePeriodModeChange(mode) {
    setPeriodSelectionMode(mode);
    if (mode === "single" && selectedPeriods.length > 1) {
      setSelectedPeriods([selectedPeriods[0]]);
    }
  }

  function toggleFavorite(roomName) {
    setFavorites((current) =>
      current.includes(roomName)
        ? current.filter((name) => name !== roomName)
        : [...current, roomName],
    );
  }

  function applyRecentQuery(snapshot) {
    if (!snapshot) return;
    setActiveView(snapshot.activeView === "courses" ? "courses" : "available");
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

  function saveRecentQuery(snapshot = querySnapshot) {
    setRecentQueries((current) => {
      const serialized = JSON.stringify(snapshot);
      const next = [snapshot, ...current.filter((item) => JSON.stringify(item) !== serialized)].slice(0, 6);
      writeStorage(RECENT_QUERIES_STORAGE_KEY, next);
      return next;
    });
  }

  function handleCommandAction(action) {
    if (action === "today") {
      useToday();
    } else if (action === "available") {
      setActiveView("available");
    } else if (action === "courses") {
      setActiveView("courses");
    } else if (action === "reset") {
      resetFilters();
      setCommandQuery("");
    }
    setCommandOpen(false);
  }

  function openRoom(room) {
    setSelectedRoom(room);
    setCommandOpen(false);
  }

  if (loadError) {
    return (
      <main className="load-state">
        <div className="load-card">
          <CircleHelp size={30} />
          <h1>数据加载失败</h1>
          <p>{loadError}.<br />如多次出现此问题，请联系<a href="https://github.com/TifeCide" target="_blank" rel="noopener noreferrer">开发者</a>。
          </p>
          <button className="button button-primary" onClick={() => window.location.reload()} type="button">
            重新加载
          </button>
        </div>
      </main>
    );
  }

  if (!data || !settingsLoaded) {
    return <LoadingScreen progress={loadProgress} stage={loadStage} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
            <a className="brand" href={import.meta.env.BASE_URL}>
          <div className="brand-mark">
            <DoorOpen size={19} strokeWidth={2.2} />
          </div>
          <div>
            <strong>教室查询</strong>
            <span>ZSC</span>
          </div>
        </a>
        <div className="topbar-actions">
          {settings.enableCommandPalette ? (
            <button className="button button-outline topbar-command" onClick={() => setCommandOpen(true)} type="button">
              <Command size={15} />
              <span>搜索</span>
              <kbd>{isMac ? "⌘ K" : "Ctrl + K"}</kbd>
            </button>
          ) : null}
          <div className="data-status">
            <span className="status-dot" />
            <span>数据正常</span>
            <small>更新于 {formatDataUpdatedAt(data.generatedAt)}</small>
          </div>
          <button
            className="icon-button notification-center-button"
            onClick={() => setNotificationCenterOpen(true)}
            type="button"
            aria-label="打开通知中心"
            title="通知中心"
          >
            <Bell size={18} />
          </button>
          <button
            className="icon-button theme-toggle"
            onClick={() => setIsDark((value) => !value)}
            type="button"
            aria-label="切换主题"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="page-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14} /> 开放教室查询
            </div>
            <h1>
              找到一个
              <br />
              <em>适合使用</em>的教室
            </h1>
            <p>默认展示空教室，支持日期定位、节次多选、楼栋分组和课程检索。</p>
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
          <section className={cn("query-panel", settings.stickyFilters && "is-sticky")}>
          <div className="panel-topline">
            <div className="view-tabs">
              <button
                className={cn("view-tab", activeView === "available" && "is-active")}
                onClick={() => setActiveView("available")}
                type="button"
              >
                <LayoutGrid size={16} />
                空闲教室
              </button>
              <button
                className={cn("view-tab", activeView === "courses" && "is-active")}
                onClick={() => setActiveView("courses")}
                type="button"
              >
                <BookOpen size={16} />
                课程检索
              </button>
            </div>
            <div className="panel-actions">
              <button className="button button-outline panel-now-button" onClick={useToday} type="button">
                现在
              </button>
              {settings.enableCommandPalette ? (
                <button className="button button-primary" onClick={() => setCommandOpen(true)} type="button">
                  <Search size={14} />
                  快速搜索
                </button>
              ) : null}
              <button
                className="icon-button filter-visibility-button"
                onClick={() => setFiltersVisible(false)}
                type="button"
                aria-label="隐藏筛选栏"
                title="隐藏筛选栏"
              >
                <EyeOff size={16} />
              </button>
            </div>
          </div>

          <div className="query-fields">
            <TemporalPicker
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
            <label className="search-field">
              <span className="field-label">{activeView === "courses" ? "搜索课程 / 教师 / 班级" : "搜索教室"}</span>
              <span className="search-input-wrap">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={activeView === "courses" ? "例如：高等数学、张老师、计算机..." : "输入教室号或楼栋..."}
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
          <div className={cn("filter-collapsed-bar", settings.stickyFilters && "is-sticky")}>
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
          <section className="recent-query-strip" aria-label="最近查询">
            <div className="recent-query-title">
              <History size={15} />
              最近查询
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

        <section className={cn("results-section", settings.infoDisplay === 0 && "is-masked")}>
          <div className="results-content">
            <div className="results-heading">
            <div>
              <div className="section-kicker">
                <span className="live-pulse" />
                {activeView === "available" ? `实时${onlyAvailable ? "可用" : ""}情况` : "课程结果"}
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
                    ? `当前仅统计第 ${selectedWeek} 周 ${activeDay?.shortLabel} ${activePeriodLabel} 的课程安排`
                    : "支持课程名称、教师姓名、班级和教室编号"}
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
            ) : (
              <div className="course-results">
                {courseResults.length ? (
                  courseResults.slice(0, settings.searchResultLimit).map(({ entry, room }, index) => (
                    <CourseRow
                      key={`${room.name}-${entry.courseName}-${entry.periodCode}-${index}`}
                      entry={entry}
                      room={room}
                      onOpen={setSelectedRoom}
                    />
                  ))
                ) : (
                  <EmptyState hasQuery={Boolean(query)} onReset={() => setQuery("")} />
                )}
                {courseResults.length > settings.searchResultLimit ? (
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
          <span>数据更新于 {formatDataUpdatedAt(data.generatedAt)}</span>
        </div>

        <div className="footer-row">
          <a 
            href="https://github.com/TifeCide" 
            target="_blank" 
            rel="noopener noreferrer"
            className="footer-link"
          >
            <Github size={16} />
            <span>TifeCide</span>
          </a>
        </div>

        <div className="footer-row footer-powered">
          <span>Powered by GitHub Pages</span>
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
          onPickAction={handleCommandAction}
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
    </div>
  );
}

function ShieldIcon() {
  return (
    <div className="results-mask-icon">
      <Sparkles size={18} />
    </div>
  );
}

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

export default App;
