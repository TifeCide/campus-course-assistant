import { useCallback, useState } from "react";
import { RECENT_QUERIES_STORAGE_KEY } from "../constants";
import { readStorage, writeStorage } from "../utils/storage";

export function useRecentQueries() {
  const [recentQueries, setRecentQueries] = useState(() => {
    const value = readStorage(RECENT_QUERIES_STORAGE_KEY, []);
    return Array.isArray(value)
      ? value.filter((item) => item && typeof item === "object" && (item.activeView === "available" || item.entityLabel))
      : [];
  });

  /*保存最近查询的函数 */
  const saveRecentQuery = useCallback((snapshot) => {
    setRecentQueries((current) => {
      const serialized = JSON.stringify(snapshot);
      const next = [snapshot, ...current.filter((item) => JSON.stringify(item) !== serialized)].slice(0, 6);
      writeStorage(RECENT_QUERIES_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return [recentQueries, saveRecentQuery];
}
