import {
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
        <div className="dialog-header">
          <div>
            <div className="dialog-eyebrow-row">
              <DetailBackButton canGoBack={canGoBack} depth={backDepth} onBack={onBack} />
              <div className="eyebrow">教室详情</div>
            </div>
            <h2>{room.name}</h2>
            <p>
              <MapPin size={14} />
              {room.building} · {room.floor} 层 · {room.zone.replace("普通教学区", "教学区")}
            </p>
          </div>
          <div className="dialog-header-actions">
            <button className="icon-button dialog-close" onClick={onClose} type="button" aria-label="关闭">
              <X size={19} />
            </button>
          </div>
        </div>
        <div className="empty-state">
          <LoaderCircle size={28} className="loading-spinner" />
          <h3>{scheduleError ? "课表加载失败" : "正在加载完整课表"}</h3>
          <p>{scheduleError || "请稍候"}</p>
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
      <div className="dialog-header">
        <div>
          <div className="dialog-eyebrow-row">
            <DetailBackButton canGoBack={canGoBack} depth={backDepth} onBack={onBack} />
            <div className="eyebrow">教室详情</div>
          </div>
          <h2>{room.name}</h2>
          <p>
            <MapPin size={14} />
            {room.building} · {room.floor} 层 · {room.zone.replace("普通教学区", "教学区")}
          </p>
        </div>
        <div className="dialog-header-actions">
          <button
            className={cn("icon-button", "dialog-favorite", isFavorite && "is-favorite")}
            onClick={() => onToggleFavorite(room.name)}
            type="button"
            aria-label={isFavorite ? "取消收藏" : "收藏教室"}
            title={isFavorite ? "取消收藏" : "收藏教室"}
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <button className="icon-button dialog-close" onClick={onClose} type="button" aria-label="关闭">
            <X size={19} />
          </button>
        </div>
      </div>

      <div className="dialog-summary">
        <div>
          <span>当前周次</span>
          <strong>第 {selectedWeek} 周</strong>
        </div>
        <div>
          <span>当前定位</span>
          <strong>
            {selectedDay?.shortLabel} · {selectedPeriodLabel}
          </strong>
        </div>
        <div>
          <span>当前状态</span>
          <strong>{occupied.length ? "占用" : "空闲"}</strong>
        </div>
      </div>

      <div className="dialog-banner">
        <Check size={16} />
        <span>
          {occupied.length
            ? `${occupied[0].courseName} / ${occupied[0].teacher || "未标注教师"}`
            : `当前筛选时段空闲 · ${selectedPeriodLabel}`}
        </span>
      </div>

      <div className="dialog-detail-grid">
        <section className="dialog-detail-card">
          <div className="dialog-detail-heading">
            <div>
              <span className="section-kicker">本周概览</span>
              <strong>第 {selectedWeek} 周空闲情况</strong>
            </div>
            <LayoutGrid size={17} />
          </div>
          <div className="weekly-overview">
            {weeklyOverview.map((day) => (
              <div className="weekly-overview-row" key={day.index}>
                <span>{day.shortLabel}</span>
                <div className="weekly-overview-bar">
                  <span style={{ "--free-progress": `${(day.free / day.total) * 100}%` }} />
                </div>
                <small>
                  {day.free}/{day.total}
                </small>
              </div>
            ))}
          </div>
        </section>

        <section className="dialog-detail-card next-course-card">
          <div className="dialog-detail-heading">
            <div>
              <span className="section-kicker">下一次课程</span>
              <strong>{nextCourse ? nextCourse.entry.courseName : "暂无后续安排"}</strong>
            </div>
            <Clock3 size={17} />
          </div>
          {nextCourse ? (
            <div className="next-course-copy">
              <span>
                {nextCourse.day.shortLabel} · {nextCourse.slot.label} · {nextCourse.slot.start}-{nextCourse.slot.end}
              </span>
              <small>
                {nextCourse.entry.teacher || "未标注教师"}
                {nextCourse.entry.classGroup ? ` · ${nextCourse.entry.classGroup}` : ""}
              </small>
            </div>
          ) : (
            <div className="next-course-copy">
              <span>当前学期没有检测到后续课程</span>
            </div>
          )}
        </section>
      </div>

      <div className="schedule">
        <div className="schedule-head">
          <div className="schedule-corner">节次</div>
          {data.weekdays.map((day) => (
            <div className="schedule-day" key={day.index}>
              {day.shortLabel}
            </div>
          ))}
        </div>
        {data.timeSlots.map((slot) => (
          <div className="schedule-row" key={slot.code}>
            <div className="schedule-slot">
              <strong>{slot.label}</strong>
              <span>
                {slot.start} - {slot.end}
              </span>
            </div>
            {data.weekdays.map((day) => {
              const entries = getRoomEntries(room, day.index, slot.code, selectedWeek);
              return (
                <div className={cn("schedule-cell", entries.length && "is-occupied")} key={`${day.index}-${slot.code}`}>
                  {entries.length ? (
                    <div
                      className="schedule-course schedule-course-preview"
                    >
                      <button
                        className="schedule-course-preview-target"
                        onClick={(event) => onPreviewEntry(entries[0], event.currentTarget)}
                        type="button"
                        aria-label={`预览${entries[0]?.courseName || "课程"}安排`}
                      />
                      <ExpandableScheduleEntries
                        entries={entries}
                        collapsedCount={1}
                        renderEntry={(entry, index) => (
                          <div className="schedule-entry-copy" key={`${entry.courseName}-${entry.teacher}-${entry.classGroup}-${index}`}>
                            <button className="schedule-entity-link" onClick={() => onNavigate("courses", entry.courseName)} type="button">
                              {entry.courseName}
                            </button>
                            <button className="schedule-entity-link" onClick={() => onNavigate("teachers", entry.teacher)} type="button">
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
                    <span className="schedule-free">空闲</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
