import { useEffect, useMemo, useRef } from "react";
import { BookOpen, DoorOpen, Search, X } from "lucide-react";
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
    <Modal open={open} onOpenChange={onOpenChange} className="dialog dialog-command">
      <div className="command-bar">
        <Search size={16} />
        <input
          ref={inputRef}
          value={commandQuery}
          onChange={(event) => setCommandQuery(event.target.value)}
          placeholder="搜索教室、课程、教师或班级"
        />
        <button className="icon-button command-close" onClick={() => onOpenChange(false)} type="button" aria-label="关闭" title="关闭">
          <X size={18} />
        </button>
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
