/*读取和写入浏览器的 LocalStorage，处理 JSON 数据，并提供默认值以防止错误： */
export function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

/* 写入 LocalStorage 时，使用 JSON.stringify 将值转换为字符串，并捕获可能的错误（例如在隐私模式下或嵌入环境中 LocalStorage 不可用）： */
export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage may be unavailable in private browsing or restricted embeds. */
  }
}
