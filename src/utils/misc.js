import { SHANGHAI_TZ } from "../constants";

export const cn = (...classes) => classes.filter(Boolean).join(" ");

/* 将数值限制在指定的最小值和最大值之间，如果数值小于最小值则返回最小值，大于最大值则返回最大值，否则返回原始数值： */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* 将数值格式化为两位数的字符串，如果数值小于 10，则在前面补零： */
export function pad2(value) {
  return String(value).padStart(2, "0");
}

/* 将时间字符串（格式为 "HH:mm"）转换为总分钟数，方便进行时间比较和计算： */
export function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
}

/* 将日期时间值格式化为 "YYYY-MM-DD HH:mm:ss" 的字符串，使用上海时区进行格式化。如果输入值无效或无法解析，则返回 "未知"： */
export function formatDateTime(value) {
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

/* 获取唯一且排序后的值列表，首先使用 Set 去重，然后按拼音顺序进行排序。如果值是数字或字符串，则按字符串形式进行比较，并使用中文拼音排序规则： */
export function getUniqueSorted(values) {
  return [...new Set(values)].sort((a, b) =>
    String(a).localeCompare(String(b), "zh-Hans-u-co-pinyin", { numeric: true }),
  );
}
