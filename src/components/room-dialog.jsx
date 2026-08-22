import {
  BookOpen,
  Check,
  Clock3,
  Heart,
  LayoutGrid,
  LoaderCircle,
  MapPin,
  X,
} from "lucide-react";
import { cn } from "../utils/misc";
import {
  getNextCourse,
  getRoomEntries,
  getRoomEntriesForPeriods,
  getWeeklyRoomOverview,
} from "../utils/rooms";
import { DetailBackButton, ExpandableScheduleEntries } from "./ui";
import { ScheduleClassGroup } from "./entity-schedule";

const SCHEDULE_GRID_COLS = "[grid-template-columns:72px_repeat(7,minmax(0,1fr))]";

/* 创建一个教室详情对话框组件，显示教室的详细信息、当前状态、本周概览和下一次课程。接受教室对象、数据、选定的周次、星期几、节次、关闭回调函数、收藏状态、收藏切换回调函数和导航回调函数作为属性： */
export function RoomDialog({
  room,
  data,
  selectedWeek,
  selectedWeekday,
  selectedPeriods,
  onClose,
  onBack,
  canGoBack,
  backDepth,
  isFavorite,
  onToggleFavorite,
  onNavigate,
  onPreviewEntry,
  scheduleReady,
  scheduleError,
}) {
  if (!room) return null;
  if (!scheduleReady) {
    return (
      <>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DetailBackButton canGoBack={canGoBack} depth={backDepth} onBack={onBack} />
              <div className="text-[11px] font-medium tracking-wide text-gray-400">教室详情</div>
            </div>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-gray-900">{room.name}</h2>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-gray-500">
              <MapPin size={13} className="text-gray-400" />
              {room.building} · {room.floor} 层 · {room.zone.replace("普通教学区", "教学区")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button className="icon-btn" onClick={onClose} type="button" aria-label="关闭">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="m-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center">
          <LoaderCircle size={24} className="loading-spinner animate-spin text-primary-500" />
          <h3 className="mt-3 text-base font-semibold text-gray-900">{scheduleError ? "课表加载失败" : "正在加载完整课表"}</h3>
          <p className="mt-1 text-sm text-gray-500">{scheduleError || "请稍候"}</p>
        </div>
      </>
    );
  }
  /* 获取教室在当前选定的周次、星期几和节次的占用情况，并根据选定的节次获取对应的时间段信息。然后根据选定的星期几获取对应的星期信息，并将选定的节次标签拼接成字符串。接着获取教室在当前周次的每一天的空闲情况概览，以及教室在当前周次、星期几和节次之后的下一次课程信息： */
  const occupied = getRoomEntriesForPeriods(room, selectedWeekday, selectedPeriods, selectedWeek);
  const selectedSlots = data.timeSlots.filter((slot) => selectedPeriods.includes(slot.code));
  const selectedDay = data.weekdays.find((day) => day.index === Number(selectedWeekday));
  const selectedPeriodLabel = selectedSlots.map((slot) => slot.label).join("、");
  const weeklyOverview = getWeeklyRoomOverview(room, data, selectedWeek);
  const nextCourse = getNextCourse(room, data, selectedWeek, selectedWeekday, selectedPeriods);

  return (
    <>
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <DetailBackButton canGoBack={canGoBack} depth={backDepth} onBack={onBack} />
            <div className="text-[11px] font-medium tracking-wide text-gray-400">教室详情</div>
          </div>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-gray-900">{room.name}</h2>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-gray-500">
            <MapPin size={13} className="text-gray-400" />
            {room.building} · {room.floor} 层 · {room.zone.replace("普通教学区", "教学区")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            className={cn(
              "icon-btn",
              isFavorite && "bg-danger-50/70 text-danger-500 hover:bg-danger-100 hover:text-danger-600",
            )}
            onClick={() => onToggleFavorite(room.name)}
            type="button"
            aria-label={isFavorite ? "取消收藏" : "收藏教室"}
            title={isFavorite ? "取消收藏" : "收藏教室"}
          >
            <Heart size={17} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <button className="icon-btn" onClick={onClose} type="button" aria-label="关闭">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="block text-[11px] text-gray-500">当前周次</span>
            <strong className="block text-sm font-semibold text-gray-900">第 {selectedWeek} 周</strong>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="block text-[11px] text-gray-500">当前定位</span>
            <strong className="block truncate text-sm font-semibold text-gray-900">
              {selectedDay?.shortLabel} · {selectedPeriodLabel}
            </strong>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="block text-[11px] text-gray-500">当前状态</span>
            <strong className={cn("block text-sm font-semibold", occupied.length ? "text-warning-600" : "text-success-700")}>
              {occupied.length ? "占用" : "空闲"}
            </strong>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium",
            occupied.length ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700",
          )}
        >
          {occupied.length ? (
            <BookOpen size={15} className="shrink-0" />
          ) : (
            <Check size={15} className="shrink-0" />
          )}
          <span className="min-w-0 truncate">
            {occupied.length
              ? `${occupied[0].courseName} / ${occupied[0].teacher || "未标注教师"}`
              : `当前筛选时段空闲 · ${selectedPeriodLabel}`}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <section className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="block text-[11px] font-medium text-gray-400">本周概览</span>
                <strong className="block text-sm font-semibold text-gray-900">第 {selectedWeek} 周空闲情况</strong>
              </div>
              <LayoutGrid size={16} className="text-gray-300" />
            </div>
            <div className="mt-3 space-y-1.5">
              {weeklyOverview.map((day) => (
                <div className="flex items-center gap-2.5" key={day.index}>
                  <span className="w-7 shrink-0 text-xs text-gray-500">{day.shortLabel}</span>
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span
                      className="block h-full rounded-full bg-primary-500"
                      style={{ width: `${(day.free / day.total) * 100}%` }}
                    />
                  </div>
                  <small className="w-10 shrink-0 text-right text-[11px] tabular-nums text-gray-400">
                    {day.free}/{day.total}
                  </small>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="block text-[11px] font-medium text-gray-400">下一次课程</span>
                <strong className="block text-sm font-semibold text-gray-900">
                  {nextCourse ? nextCourse.entry.courseName : "暂无后续安排"}
                </strong>
              </div>
              <Clock3 size={16} className="text-gray-300" />
            </div>
            {nextCourse ? (
              <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5">
                <span className="block text-xs font-medium text-gray-700">
                  {nextCourse.day.shortLabel} · {nextCourse.slot.label} · {nextCourse.slot.start}-{nextCourse.slot.end}
                </span>
                <small className="mt-0.5 block text-xs text-gray-500">
                  {nextCourse.entry.teacher || "未标注教师"}
                  {nextCourse.entry.classGroup ? ` · ${nextCourse.entry.classGroup}` : ""}
                </small>
              </div>
            ) : (
              <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5">
                <span className="block text-xs text-gray-500">当前学期没有检测到后续课程</span>
              </div>
            )}
          </section>
        </div>

        <p className="mb-1.5 text-right text-[10px] text-gray-300 sm:hidden">← 左右滑动查看整周课表 →</p>
        <div className="overflow-x-auto">
          <div className="min-w-[740px] overflow-hidden rounded-xl border border-gray-200">
            <div className={cn("grid bg-gray-50/80", SCHEDULE_GRID_COLS)}>
              <div className="px-2.5 py-2 text-left text-[11px] font-medium text-gray-400">节次</div>
              {data.weekdays.map((day) => (
                <div className="border-l border-gray-100 px-1 py-2 text-center text-xs font-medium text-gray-600" key={day.index}>
                  {day.shortLabel}
                </div>
              ))}
            </div>
          {data.timeSlots.map((slot) => (
            <div className={cn("grid border-t border-gray-100", SCHEDULE_GRID_COLS)} key={slot.code}>
              <div className="flex flex-col justify-center border-r border-gray-100 bg-gray-50/60 px-2 py-1.5">
                <strong className="text-[11px] font-semibold text-gray-700">{slot.label}</strong>
                <span className="text-[10px] tabular-nums text-gray-400">
                  {slot.start} - {slot.end}
                </span>
              </div>
              {data.weekdays.map((day) => {
                const entries = getRoomEntries(room, day.index, slot.code, selectedWeek);
                return (
                  <div
                    className={cn(
                      "min-h-[54px] border-r border-gray-100 p-1 last:border-r-0",
                      entries.length && "bg-primary-50/40",
                    )}
                    key={`${day.index}-${slot.code}`}
                  >
                    {entries.length ? (
                      <div className="schedule-course-preview relative h-full rounded-md p-0.5 transition-shadow duration-150 hover:shadow-sm hover:ring-1 hover:ring-primary-200">
                        <button
                          className="absolute inset-0 z-10 rounded-md"
                          onClick={(event) => onPreviewEntry(entries[0], event.currentTarget)}
                          type="button"
                          aria-label={`预览${entries[0]?.courseName || "课程"}安排`}
                        />
                        <ExpandableScheduleEntries
                          entries={entries}
                          collapsedCount={1}
                          renderEntry={(entry, index) => (
                            <div className="pointer-events-none space-y-0.5" key={`${entry.courseName}-${entry.teacher}-${entry.classGroup}-${index}`}>
                              <button className="block max-w-full truncate text-left text-[11px] font-semibold text-primary-700" onClick={() => onNavigate("courses", entry.courseName)} type="button" tabIndex={-1}>
                                {entry.courseName}
                              </button>
                              <button className="block max-w-full truncate text-left text-[11px] text-gray-500" onClick={() => onNavigate("teachers", entry.teacher)} type="button" tabIndex={-1}>
                                {entry.teacher || "未标注教师"}
                              </button>
                              {entry.classGroup ? (
                                <ScheduleClassGroup classGroup={entry.classGroup} onNavigate={onNavigate} />
                              ) : null}
                            </div>
                          )}
                        />
                      </div>
                    ) : (
                      <span className="flex h-full min-h-[46px] items-center justify-center text-[11px] text-gray-300">空闲</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          </div>
        </div>
      </div>
    </>
  );
}
