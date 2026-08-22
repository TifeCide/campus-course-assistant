import { CalendarDays, Check } from "lucide-react";
import { cn } from "../utils/misc";
import { SelectField } from "./ui";

/* 创建一个时间选择器组件，允许用户在周次模式和日期模式之间切换，并选择特定的周次、星期几或日期。根据当前模式渲染相应的选择字段，并提供快速选择当前时间的按钮： */
export function TemporalPicker({
  mode,
  onToday,
  onModeChange,
  selectedWeek,
  selectedWeekday,
  selectedDate,
  onWeekChange,
  onWeekdayChange,
  onDateChange,
  weekdays,
  maxWeek,
  dateRange,
}) {
  return (
    <div className="temporal-picker">
      {onToday ? (
        <div className="temporal-now-row">
          <button className="button button-outline panel-now-button" onClick={onToday} type="button">
            快速选择当前时间
          </button>
        </div>
      ) : null}
      <div className="field-label-row">
        <span className="field-label">日期选择</span>
        <div className="binary-toggle" role="group" aria-label="周次或日期">
          <button className={cn(mode === "week" && "is-active")} onClick={() => onModeChange("week")} type="button">
            周次
          </button>
          <button className={cn(mode === "date" && "is-active")} onClick={() => onModeChange("date")} type="button">
            日期
          </button>
        </div>
      </div>

      {mode === "week" ? (
        <div className="temporal-fields">
          <SelectField
            label=""
            value={String(selectedWeek)}
            onChange={(value) => onWeekChange(Number(value))}
            icon={CalendarDays}
            options={Array.from({ length: maxWeek }, (_, index) => ({
              value: String(index + 1),
              label: `第 ${index + 1} 周`,
            }))}
          />
          <SelectField
            label=""
            value={String(selectedWeekday)}
            onChange={(value) => onWeekdayChange(Number(value))}
            options={weekdays.map((day) => ({ value: String(day.index), label: day.label }))}
          />
        </div>
      ) : (
        <label className="date-input-wrap">
          <CalendarDays size={16} />
          <input
            type="date"
            value={selectedDate}
            min={dateRange.min}
            max={dateRange.max}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </label>
      )}
    </div>
  );
}

/* 创建一个节次选择器组件，允许用户在单选和多选模式之间切换，并选择特定的节次。根据当前模式渲染相应的节次按钮，并在点击时切换选中状态： */
export function PeriodPicker({ timeSlots, selectedPeriods, selectionMode, onModeChange, onChange }) {
  /* 切换节次的选中状态，根据当前的选择模式（单选或多选）更新选中的节次列表，并调用 onChange 回调函数传递新的选中节次： */
  function togglePeriod(code) {
    if (selectionMode === "single") {
      onChange([code]);
      return;
    }

    const next = selectedPeriods.includes(code)
      ? selectedPeriods.filter((selectedCode) => selectedCode !== code)
      : [...selectedPeriods, code];
    onChange(next.length ? next : [code]);
  }

  return (
    <div className="period-picker">
      <div className="field-label-row">
        <span className="field-label">节次</span>
        <div className="binary-toggle" role="group" aria-label="节次单选或多选">
          <button className={cn(selectionMode === "single" && "is-active")} onClick={() => onModeChange("single")} type="button">
            单选
          </button>
          <button className={cn(selectionMode === "multiple" && "is-active")} onClick={() => onModeChange("multiple")} type="button">
            多选
          </button>
        </div>
      </div>
      <div className="period-options">
        {timeSlots.map((slot) => {
          const selected = selectedPeriods.includes(slot.code);
          return (
            <button className={cn("period-option", selected && "is-selected")} onClick={() => togglePeriod(slot.code)} type="button" key={slot.code}>
              <span>{slot.label}</span>
              <small>
                {slot.start}-{slot.end}
              </small>
              {selected ? <Check size={14} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
