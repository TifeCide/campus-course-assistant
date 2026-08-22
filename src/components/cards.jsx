import { ArrowUpRight, BookOpen, Heart, UserRound, Users } from "lucide-react";
import { cn } from "../utils/misc";
import { getRoomEntriesForPeriods } from "../utils/rooms";

/* 创建一个教室卡片组件，显示教室的占用状态、名称、建筑物、楼层、区域以及收藏状态。接受教室对象、打开回调函数、选定的周次、星期几、节次、收藏状态和收藏切换回调函数作为属性： */
export function RoomCard({
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

/* 创建一个实体链接组件，显示实体的标签，并在点击时调用导航回调函数。接受标签、视图类型、导航回调函数、是否静音和自定义类名作为属性： */
export function EntityLink({ label, view, onNavigate, muted = false, className = "" }) {
  if (!label) return null;
  return (
    <button className={cn("entity-link", muted && "is-muted", className)} onClick={() => onNavigate(view, label)} type="button">
      {label}
    </button>
  );
}

/* 创建一个实体结果卡片组件，显示实体的图标、标签、课程数、教师数、班级数和教室数，并提供查看周课表的操作。接受视图类型、标签、条目列表和打开回调函数作为属性： */
export function EntityResultCard({ view, label, entries, eventCount, onOpen }) {
  if (eventCount !== undefined) {
    const Icon = view === "courses" ? BookOpen : view === "teachers" ? UserRound : Users;
    return (
      <button className="entity-result-card" onClick={() => onOpen(view, label)} type="button">
        <span className="entity-result-icon"><Icon size={18} /></span>
        <span className="entity-result-copy">
          <strong>{label}</strong>
          <small>{eventCount} 项课表安排</small>
        </span>
        <span className="entity-result-action">查看周课表 <ArrowUpRight size={15} /></span>
      </button>
    );
  }

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
