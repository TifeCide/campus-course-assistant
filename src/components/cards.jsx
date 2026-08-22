import { ArrowUpRight, BookOpen, Heart, UserRound, Users } from "lucide-react";
import { cn } from "../utils/misc";
import { getRoomEntriesForPeriods } from "../utils/rooms";

const ATTRIBUTE_TONES = {
  blue: "bg-primary-50 text-primary-700",
  green: "bg-success-50 text-success-700",
  amber: "bg-warning-50 text-warning-700",
  red: "bg-danger-50 text-danger-700",
  gray: "bg-gray-100 text-gray-600",
};

/* 创建一个教室卡片组件，显示教室的占用状态、名称、建筑物、楼层、区域以及收藏状态。接受教室对象、打开回调函数、选定的周次、星期几、节次、收藏状态和收藏切换回调函数作为属性： */
export function RoomCard({
  room,
  onOpen,
  selectedWeek,
  selectedWeekday,
  selectedPeriods,
  isFavorite,
  onToggleFavorite,
  attribute,
}) {
  const occupied = getRoomEntriesForPeriods(room, selectedWeekday, selectedPeriods, selectedWeek);

  return (
    <article className="group relative">
      <button
        className="card block w-full p-4 pr-11 text-left transition-all duration-150 group-hover:border-primary-300 group-hover:shadow-md active:scale-[0.98]"
        onClick={() => onOpen(room)}
        type="button"
      >
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              occupied.length ? "bg-danger-50 text-danger-600" : "bg-success-50 text-success-700",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", occupied.length ? "bg-danger-500" : "bg-success-500")} />
            {occupied.length ? "占用" : "空闲"}
          </span>
          {attribute ? (
            <span
              className={cn(
                "min-w-0 truncate rounded-full border border-white/70 px-2 py-0.5 text-[11px] font-medium",
                ATTRIBUTE_TONES[attribute.tone] ?? ATTRIBUTE_TONES.gray,
              )}
              title={attribute.detail || attribute.label}
            >
              {attribute.label}
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 truncate text-[15px] font-semibold tracking-tight text-gray-900">{room.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
          <span>{room.building}</span>
          <span className="text-gray-300">/</span>
          <span>{room.floor} 层</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
          <span className="min-w-0 truncate text-xs text-gray-400">{room.zone.replace("普通教学区", "教学区")}</span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            查看课表
            <ArrowUpRight size={13} />
          </span>
        </div>
      </button>
      <button
        className={cn(
          "absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.85]",
          isFavorite ? "text-danger-500 hover:bg-danger-50" : "text-gray-300 hover:bg-gray-100 hover:text-danger-400",
        )}
        onClick={() => onToggleFavorite(room.name)}
        type="button"
        aria-label={isFavorite ? `取消收藏 ${room.name}` : `收藏 ${room.name}`}
        title={isFavorite ? "取消收藏" : "收藏教室"}
      >
        <Heart key={isFavorite ? "on" : "off"} size={15} fill={isFavorite ? "currentColor" : "none"} className={cn(isFavorite && "animate-pop")} />
      </button>
    </article>
  );
}

/* 创建一个实体链接组件，显示实体的标签，并在点击时调用导航回调函数。接受标签、视图类型、导航回调函数、是否静音和自定义类名作为属性： */
export function EntityLink({ label, view, onNavigate, muted = false, className = "" }) {
  if (!label) return null;
  return (
    <button
      className={cn(
        "rounded transition-colors duration-100 underline-offset-2 hover:text-primary-600 hover:underline",
        muted ? "text-gray-500" : "font-medium text-gray-800",
        className,
      )}
      onClick={() => onNavigate(view, label)}
      type="button"
    >
      {label}
    </button>
  );
}

/* 创建一个实体结果卡片组件，显示实体的图标、标签、课程数、教师数、班级数和教室数，并提供查看周课表的操作。接受视图类型、标签、条目列表和打开回调函数作为属性： */
export function EntityResultCard({ view, label, entries, eventCount, onOpen }) {
  const Icon = view === "courses" ? BookOpen : view === "teachers" ? UserRound : Users;
  const iconTone =
    view === "courses"
      ? "bg-primary-50 text-primary-600"
      : view === "teachers"
        ? "bg-success-50 text-success-600"
        : "bg-warning-50 text-warning-600";

  let detail;
  if (eventCount !== undefined) {
    detail = `${eventCount} 项课表安排`;
  } else {
    const courseCount = new Set(entries.map((entry) => entry.courseName).filter(Boolean)).size;
    const teacherCount = new Set(entries.map((entry) => entry.teacher).filter(Boolean)).size;
    const classCount = new Set(entries.map((entry) => entry.classGroup).filter(Boolean)).size;
    const roomCount = new Set(entries.map((entry) => entry.roomName).filter(Boolean)).size;
    detail = view === "courses"
      ? `${teacherCount} 位教师 · ${classCount} 个班级 · ${roomCount} 间教室`
      : view === "teachers"
        ? `${courseCount} 门课程 · ${classCount} 个班级 · ${roomCount} 间教室`
        : `${courseCount} 门课程 · ${teacherCount} 位教师 · ${roomCount} 间教室`;
  }

  return (
    <button
      className="card group flex w-full items-center gap-3.5 p-4 text-left transition-all duration-150 hover:border-primary-300 hover:shadow-md active:scale-[0.99]"
      onClick={() => onOpen(view, label)}
      type="button"
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconTone)}>
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold text-gray-900">{label}</strong>
        <small className="mt-0.5 block truncate text-xs text-gray-500">{detail}</small>
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-xs font-medium text-primary-600 sm:inline-flex">
        查看周课表
        <ArrowUpRight size={14} className="transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
