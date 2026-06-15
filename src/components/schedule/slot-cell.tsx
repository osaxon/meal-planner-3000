import type { MealWithCategory } from "#/domains/meals/meals.zod";
import type { ScheduleWithSlots, Slot } from "#/domains/schedule/schedule.zod";
import { DIET_DOT } from "./diet";

/** A single grid cell: renders a Filled, Leftover, or Empty Slot. */
export function SlotCell({
  slot,
  mealById,
  onClick,
}: {
  slot: ScheduleWithSlots["slots"][number] | undefined;
  mealById: Map<number, MealWithCategory>;
  onClick: (slot: Slot) => void;
}) {
  const base =
    "flex h-16 w-full cursor-pointer overflow-hidden text-left transition-opacity hover:opacity-80 active:opacity-60";

  if (!slot || slot.type === "empty") {
    return (
      <button
        type="button"
        onClick={() => slot && onClick(slot)}
        className={`${base} items-center justify-center rounded border border-dashed`}
      >
        <span className="text-xs text-muted-foreground/50">{slot ? "Edit" : "—"}</span>
      </button>
    );
  }

  const meal = slot.mealId !== null ? mealById.get(slot.mealId) : undefined;
  const name = meal?.name ?? "Unknown meal";

  if (slot.type === "leftover") {
    return (
      <button
        type="button"
        onClick={() => onClick(slot)}
        className={`${base} flex-col justify-center rounded border border-muted bg-muted/30 px-2 py-1`}
      >
        <span className="text-[11px] font-medium leading-tight line-clamp-2">{name}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5 shrink-0">↩ Leftovers</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick(slot)}
      className={`${base} flex-col justify-center rounded border bg-card px-2 py-1`}
    >
      <div className="flex items-start gap-1.5 min-w-0">
        {meal && (
          <span
            className={`mt-0.5 size-2 shrink-0 rounded-full ${DIET_DOT[meal.diet]}`}
            title={meal.diet}
          />
        )}
        <span className="text-[11px] font-medium leading-tight line-clamp-2">{name}</span>
      </div>
      {meal && (
        <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 pl-3.5">
          {meal.categoryName}
        </span>
      )}
    </button>
  );
}
