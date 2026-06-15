import { Button } from "#/components/ui/button";
import type { Slot } from "#/domains/schedule/schedule.zod";
import { orpc } from "#/orpc/client";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { GenerateForm } from "./generate-form";
import { ScheduleGrid } from "./schedule-grid";
import { SlotEditorSheet } from "./slot-editor-sheet";

export function SchedulePage() {
  const { data: active } = useQuery(orpc.schedule.getActive.queryOptions());
  const { data: meals } = useSuspenseQuery(orpc.meals.list.queryOptions());
  const [currentWeek, setCurrentWeek] = useState(0);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);

  const mealById = new Map(meals.map((m) => [m.id, m]));
  const totalWeeks = active?.durationWeeks ?? 1;

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active
              ? `${active.durationWeeks}-week schedule from ${new Date(active.startDate).toLocaleDateString()}`
              : "No active schedule."}
          </p>
        </div>
      </div>

      {active ? (
        <>
          {/* Week navigation */}
          {totalWeeks > 1 && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek((w) => w - 1)}
                disabled={currentWeek === 0}
              >
                ← Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Week {currentWeek + 1} of {totalWeeks}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek((w) => w + 1)}
                disabled={currentWeek === totalWeeks - 1}
              >
                Next →
              </Button>
            </div>
          )}

          {/* Grid */}
          <div className="mt-4">
            <ScheduleGrid
              schedule={active}
              mealById={mealById}
              currentWeek={currentWeek}
              onSlotClick={setEditingSlot}
            />
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500" /> Meat
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-sky-500" /> Fish
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500" /> Vegetarian
            </span>
            <span className="flex items-center gap-1">↩ Leftovers</span>
          </div>

          {/* Regenerate (collapsible) */}
          <details className="mt-8 text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
              Regenerate schedule
            </summary>
            <p className="mt-1 mb-4 text-xs text-muted-foreground">
              Replaces the current schedule. The existing schedule is saved as
              &ldquo;previous&rdquo; to inform variety rules.
            </p>
            <GenerateForm onSuccess={() => setCurrentWeek(0)} />
          </details>
        </>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            Generate your first schedule to see it here.
          </p>
          <div className="mt-6 rounded-md border p-5">
            <p className="text-sm font-medium mb-4">Generate schedule</p>
            <GenerateForm onSuccess={() => {}} />
          </div>
        </>
      )}

      <SlotEditorSheet
        slot={editingSlot}
        meals={meals}
        mealById={mealById}
        onClose={() => setEditingSlot(null)}
      />
    </div>
  );
}
