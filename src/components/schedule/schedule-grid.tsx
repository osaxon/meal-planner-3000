import type { MealWithCategory } from "#/domains/meals/meals.zod";
import type { ScheduleWithSlots, Slot } from "#/domains/schedule/schedule.zod";
import { formatDayHeader, toDateKey } from "#/lib/date-utils";
import { buildScheduleGrid } from "./build-schedule-grid";
import { SlotCell } from "./slot-cell";

const ROW_CLASS = "grid grid-cols-[56px_repeat(7,1fr)] gap-1";

export function ScheduleGrid({
  schedule,
  mealById,
  currentWeek,
  onSlotClick,
}: {
  schedule: ScheduleWithSlots;
  mealById: Map<number, MealWithCategory>;
  currentWeek: number;
  onSlotClick: (slot: Slot) => void;
}) {
  const { days, rows } = buildScheduleGrid(schedule, currentWeek);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header row */}
        <div className={`${ROW_CLASS} mb-1`}>
          <div />
          {days.map((day) => {
            const { weekday, label } = formatDayHeader(day);
            return (
              <div key={toDateKey(day)} className="text-center">
                <p className="text-xs font-medium">{weekday}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            );
          })}
        </div>

        {/* Lunch / Dinner rows */}
        {rows.map((row, rowIndex) => (
          <div
            key={row.mealTime}
            className={`${ROW_CLASS}${rowIndex < rows.length - 1 ? " mb-1" : ""}`}
          >
            <div className="flex items-center">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                {row.mealTime}
              </span>
            </div>
            {row.cells.map(({ day, slot }) => (
              <SlotCell
                key={toDateKey(day)}
                slot={slot}
                mealById={mealById}
                onClick={onSlotClick}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
