import { DEFAULT_PERIOD, EXAM_WEEK_COUNT } from "../constants";
import { clamp, pad2, timeToMinutes } from "./misc";

/* 获取指定日期在上海时区的各个时间部分，包括年、月、日、小时、分钟、星期几索引以及格式化的日期和时间标签。如果无法使用国际化 API，则使用本地时间作为回退： */
export function getShanghaiParts(date = new Date()) {
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
export function getShanghaiDate(year, month, day, hour = 0, minute = 0) {
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00+08:00`);
}

/* 获取指定年份的九月的第一个星期一，如果九月一日不是星期一，则向后查找直到找到第一个星期一： */
export function getFirstMondayOfSeptember(year) {
  let candidate = getShanghaiDate(year, 9, 1);
  for (let index = 0; index < 7; index += 1) {
    if (getShanghaiParts(candidate).weekdayIndex === 1) return candidate;
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  return candidate;
}

/* 将日期字符串（格式为 "YYYY-MM-DD"）解析为上海时区的 Date 对象，并将时间设置为中午 12 点。如果输入无效或无法解析，则返回 null： */
export function parseDateAtShanghaiNoon(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return getShanghaiDate(Number(match[1]), Number(match[2]), Number(match[3]), 12, 0);
}

/* 根据指定的日期和学期开始日期，计算当前的学术周次。如果当前日期在学期开始之前，则返回第 1 周；否则，根据日期差计算当前周次，并确保返回值不小于 1： */
export function getAcademicWeek(date = new Date(), semesterStartDate = "") {
  const parts = getShanghaiParts(date);
  const termStart = parseDateAtShanghaiNoon(semesterStartDate) ?? getFirstMondayOfSeptember(parts.year);
  const current = getShanghaiDate(parts.year, parts.month, parts.day, 12, 0);

  if (current < termStart) return 1;

  const diffDays = Math.floor((current - termStart) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/* 根据指定的日期和学期设置，确定当前的学术阶段（教学周、考试周或假期）。如果当前日期在学期开始和结束之间，则返回教学阶段；如果在考试周范围内，则返回考试阶段；否则，返回假期阶段： */
export function getAcademicPhase(date = new Date(), settings = {}) {
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
export function getCurrentPeriodCode(timeSlots, date = new Date()) {
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
export function getAutoTemporalState(data, settings, date = new Date()) {
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

/* 根据指定的学术周次、星期几和学期开始日期，计算对应的日期值（格式为 "YYYY-MM-DD"）。如果学期开始日期无效，则使用指定的回退年份来计算九月的第一个星期一作为学期开始日期。返回一个格式化的日期字符串： */
export function getRoomDateValue(week, weekday, semesterStartDate, fallbackYear = new Date().getFullYear()) {
  const start = parseDateAtShanghaiNoon(semesterStartDate) ?? getFirstMondayOfSeptember(fallbackYear);
  const offsetDays = (Number(week) - 1) * 7 + (Number(weekday) - 1);
  const date = new Date(start.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = getShanghaiParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/* 根据学期开始日期和最大周次，计算学期的日期范围（最小日期和最大日期）。如果学期开始日期无效，则使用指定的回退年份来计算九月的第一个星期一作为学期开始日期。返回一个包含最小日期和最大日期的对象： */
export function getDateRange(semesterStartDate, maxWeek, fallbackYear = new Date().getFullYear()) {
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
export function getTemporalFromDate(value, semesterStartDate, maxWeek) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = getShanghaiDate(Number(match[1]), Number(match[2]), Number(match[3]), 12, 0);
  return {
    week: clamp(getAcademicWeek(date, semesterStartDate), 1, Number(maxWeek)),
    weekday: getShanghaiParts(date).weekdayIndex,
  };
}
