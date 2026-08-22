import { useEffect, useMemo, useRef } from "react";
import { BookOpen, DoorOpen, Search, X } from "lucide-react";
import { cn } from "../utils/misc";
import { Modal } from "./ui";

/* 创建一个命令对话框组件，提供搜索教室和课程的功能，并显示匹配结果。接受打开状态、打开状态变化回调函数、数据、命令查询、命令查询变化回调函数、选择教室回调函数、可用教室列表和课程结果作为属性： */
export function CommandDialog({
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
      for (const entry of room.entries ?? []) {
        const text = [entry.courseName, entry.teacher, entry.classGroup, room.name].join(" ").toLowerCase();
        if (text.includes(normalizedQuery)) {
          hits.push({ room, entry });
        }
      }
    }
    return hits;
  }, [data, normalizedQuery]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} className="max-h-[80dvh] max-w-[860px]">
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
        <Search size={16} className="shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          value={commandQuery}
          onChange={(event) => setCommandQuery(event.target.value)}
          placeholder="搜索教室、课程、教师或班级"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        <button className="icon-btn h-7 w-7" onClick={() => onOpenChange(false)} type="button" aria-label="关闭" title="关闭">
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[calc(80dvh-57px)] overflow-y-auto p-3">
        {!normalizedQuery ? (
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <section>
              <div className="px-1.5 pb-1.5 text-xs font-medium text-gray-400">查询教室结果</div>
              <div>
                {availableRooms.slice(0, 8).map((room) => (
                  <button
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-100 hover:bg-gray-50"
                    key={room.name}
                    onClick={() => onPickRoom(room)}
                    type="button"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600">
                      <DoorOpen size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-medium text-gray-800">{room.name}</strong>
                      <small className="block truncate text-xs text-gray-400">
                        {room.building} · {room.floor} 层
                      </small>
                    </span>
                  </button>
                ))}
                {!availableRooms.length ? (
                  <div className="px-2 py-6 text-center text-xs text-gray-400">当前没有查询教室结果</div>
                ) : null}
              </div>
            </section>
            <section>
              <div className="px-1.5 pb-1.5 text-xs font-medium text-gray-400">课程结果</div>
              <div>
                {courseResults.slice(0, 8).map(({ entry, room }, index) => (
                  <button
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-100 hover:bg-gray-50"
                    key={`${room.name}-${entry.courseName}-${index}`}
                    onClick={() => onPickRoom(room)}
                    type="button"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                      <BookOpen size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-medium text-gray-800">{entry.courseName}</strong>
                      <small className="block truncate text-xs text-gray-400">
                        {entry.teacher || "未标注教师"} · {room.name}
                      </small>
                    </span>
                  </button>
                ))}
                {!courseResults.length ? (
                  <div className="px-2 py-6 text-center text-xs text-gray-400">输入关键词搜索课程</div>
                ) : null}
              </div>
            </section>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between px-1.5 pb-1.5">
              <span className="text-xs font-medium text-gray-400">匹配结果</span>
              <span className="text-xs tabular-nums text-gray-400">{roomHits.length + courseHits.length} 条</span>
            </div>

            <div>
              {roomHits.slice(0, 10).map((room) => (
                <button
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-100 hover:bg-gray-50"
                  key={room.name}
                  onClick={() => onPickRoom(room)}
                  type="button"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600">
                    <DoorOpen size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-medium text-gray-800">{room.name}</strong>
                    <small className="block truncate text-xs text-gray-400">
                      {room.building} · {room.floor} 层 · {room.zone.replace("普通教学区", "教学区")}
                    </small>
                  </span>
                </button>
              ))}

              {courseHits.slice(0, 10).map(({ entry, room }, index) => (
                <button
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-100 hover:bg-gray-50"
                  key={`${room.name}-${entry.courseName}-${index}`}
                  onClick={() => onPickRoom(room)}
                  type="button"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <BookOpen size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-medium text-gray-800">{entry.courseName}</strong>
                    <small className="block truncate text-xs text-gray-400">
                      {entry.teacher || "未标注教师"} · {room.name} · {entry.weekdayLabel}
                    </small>
                  </span>
                </button>
              ))}

              {!roomHits.length && !courseHits.length ? (
                <div className="py-10 text-center text-sm text-gray-400">没有匹配项</div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
