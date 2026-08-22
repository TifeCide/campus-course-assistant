import { DISMISSED_NOTIFICATIONS_STORAGE_KEY } from "../constants";
import { getShanghaiParts } from "./datetime";
import { readStorage, writeStorage } from "./storage";

/* 获取通知类型，如果传入的值不是 "info"、"warning" 或 "error"，则默认返回 "info"： */
export function getNotificationType(value) {
  return ["info", "warning", "error"].includes(value) ? value : "info";
}

/* 检查通知是否启用了双重提醒，接受布尔值或数字 1 表示启用： */
function isNotificationTwiceEnabled(value) {
  return value === true || Number(value) === 1;
}

/* 将通知对象标准化为统一的格式，确保所有必需字段存在且有效，并返回一个包含通知信息的对象： */
export function normalizeNotification(value) {
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
export function isNotificationTriggered(notification, date = new Date()) {
  const currentDate = getShanghaiParts(date).dateLabel;
  const inRange = currentDate >= notification.notifyStartDate && currentDate <= notification.notifyEndDate;
  return notification.notifyInDate === 1 ? inRange : !inRange;
}

/* 获取已关闭通知的键集合，从 LocalStorage 中读取数据并返回一个 Set 对象，确保只包含字符串类型的键： */
export function getDismissedNotificationKeys() {
  const value = readStorage(DISMISSED_NOTIFICATIONS_STORAGE_KEY, {});
  if (Array.isArray(value)) return new Set(value.filter((key) => typeof key === "string"));
  if (!value || typeof value !== "object") return new Set();
  return new Set(Object.keys(value).filter((key) => value[key] === true));
}

/* 将通知标记为已关闭，并将其键存储在 LocalStorage 中，以便在后续访问中不再显示该通知： */
export function dismissNotificationPersistently(notificationKey) {
  const value = readStorage(DISMISSED_NOTIFICATIONS_STORAGE_KEY, {});
  const dismissed = value && !Array.isArray(value) && typeof value === "object" ? value : {};
  dismissed[notificationKey] = true;
  writeStorage(DISMISSED_NOTIFICATIONS_STORAGE_KEY, dismissed);
}
