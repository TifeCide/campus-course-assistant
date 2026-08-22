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
    <div className="min-w-0">
      {onToday ? (
        <div className="mb-2.5">
          <button
            className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 shadow-xs transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
            onClick={onToday}
            type="button"
          >
            快速选择当前时间
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">日期选择</span>
        <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5" role="group" aria-label="周次或日期">
          <button
            className={cn(
              "h-7 rounded-md px-3 text-xs font-medium transition-all duration-150",
              mode === "week" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800",
            )}
            onClick={() => onModeChange("week")}
            type="button"
          >
            周次
          </button>
          <button
            className={cn(
              "h-7 rounded-md px-3 text-xs font-medium transition-all duration-150",
              mode === "date" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800",
            )}
            onClick={() => onModeChange("date")}
            type="button"
          >
            日期
          </button>
        </div>
      </div>

      {mode === "week" ? (
        <div className="mt-1.5 grid grid-cols-2 gap-2">
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
        <label className="relative mt-1.5 block">
          <CalendarDays size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            min={dateRange.min}
            max={dateRange.max}
            onChange={(event) => onDateChange(event.target.value)}
            className="field-input h-9 pl-9"
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
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">节次</span>
        <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5" role="group" aria-label="节次单选或多选">
          <button
            className={cn(
              "h-7 rounded-md px-3 text-xs font-medium transition-all duration-150",
              selectionMode === "single" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800",
            )}
            onClick={() => onModeChange("single")}
            type="button"
          >
            单选
          </button>
          <button
            className={cn(
              "h-7 rounded-md px-3 text-xs font-medium transition-all duration-150",
              selectionMode === "multiple" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800",
            )}
            onClick={() => onModeChange("multiple")}
            type="button"
          >
            多选
          </button>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
        {timeSlots.map((slot) => {
          const selected = selectedPeriods.includes(slot.code);
          return (
            <button
              className={cn(
                "relative flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition-all duration-150",
                selected
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                  : "border-gray-200 bg-white hover:border-gray-300",
              )}
              onClick={() => togglePeriod(slot.code)}
              type="button"
              key={slot.code}
            >
              <span className={cn("text-[13px] font-semibold", selected ? "text-primary-700" : "text-gray-700")}>
                {slot.label}
              </span>
              <small className="text-[11px] tabular-nums text-gray-400">
                {slot.start}-{slot.end}
              </small>
              {selected ? <Check size={13} className="absolute top-1.5 right-1.5 text-primary-600" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
