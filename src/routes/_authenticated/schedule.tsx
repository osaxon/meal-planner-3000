import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import type { MealWithCategory } from "#/domains/meals/meals.zod";
import type { ScheduleWithSlots, Slot } from "#/domains/schedule/schedule.zod";
import { addDays, formatDayHeader, indexSlotsByDateAndTime, toDateKey } from "#/lib/date-utils";
import { client, orpc } from "#/orpc/client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/schedule")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(orpc.schedule.getActive.queryOptions()),
      context.queryClient.ensureQueryData(orpc.meals.list.queryOptions()),
    ]),
  component: SchedulePage,
});

// ── Diet dot ─────────────────────────────────────────────────────────────────

const DIET_DOT: Record<MealWithCategory["diet"], string> = {
  meat: "bg-amber-500",
  fish: "bg-sky-500",
  vegetarian: "bg-emerald-500",
};

// ── Schedule grid ─────────────────────────────────────────────────────────────

function SlotCell({
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

// ── Slot editor sheet ─────────────────────────────────────────────────────────

function SlotEditorSheet({
  slot,
  meals,
  mealById,
  onClose,
}: {
  slot: Slot | null;
  meals: MealWithCategory[];
  mealById: Map<number, MealWithCategory>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: { slotId: number; mealId: number | null }) =>
      client.schedule.updateSlot(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orpc.schedule.getActive.queryOptions().queryKey,
      });
      onClose();
    },
  });

  const currentMealId = slot?.mealId ?? null;
  const form = useForm({
    defaultValues: {
      mealId: currentMealId !== null ? String(currentMealId) : "empty",
    },
    onSubmit: async ({ value }) => {
      if (!slot) return;
      await mutation.mutateAsync({
        slotId: slot.id,
        mealId: value.mealId !== "empty" ? Number(value.mealId) : null,
      });
    },
  });

  const currentMeal = currentMealId !== null ? mealById.get(currentMealId) : undefined;
  const mealTime = slot?.mealTime ?? "";
  const date = slot ? new Date(slot.date) : null;
  const dateLabel = date ? `${formatDayHeader(date).weekday}, ${formatDayHeader(date).label}` : "";

  return (
    <Sheet open={slot !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit slot</SheetTitle>
          <SheetDescription className="capitalize">
            {dateLabel} · {mealTime}
            {currentMeal ? ` · currently ${currentMeal.name}` : " · currently empty"}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="mt-6 flex flex-col gap-5"
        >
          <form.Field name="mealId">
            {(field) => (
              <div className="grid gap-1.5">
                <Label>Meal</Label>
                <Select value={field.state.value} onValueChange={field.handleChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a meal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empty">— Empty (eating out)</SelectItem>
                    {meals.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        <span className="flex items-center gap-2">
                          <span className={`size-2 shrink-0 rounded-full ${DIET_DOT[m.diet]}`} />
                          {m.name}
                          <span className="text-muted-foreground text-xs">· {m.categoryName}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>

          {mutation.error && (
            <p className="text-sm text-destructive">
              {(mutation.error as { message?: string }).message ?? "Failed to save"}
            </p>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ScheduleGrid({
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
  const weekStart = addDays(new Date(schedule.startDate), currentWeek * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const slotIndex = indexSlotsByDateAndTime(
    schedule.slots.map((s) => ({ ...s, date: new Date(s.date) })),
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header row */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-1 mb-1">
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

        {/* Lunch row */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-1 mb-1">
          <div className="flex items-center">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
              Lunch
            </span>
          </div>
          {days.map((day) => (
            <SlotCell
              key={toDateKey(day)}
              slot={slotIndex.get(`${toDateKey(day)}|lunch`)}
              mealById={mealById}
              onClick={onSlotClick}
            />
          ))}
        </div>

        {/* Dinner row */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-1">
          <div className="flex items-center">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
              Dinner
            </span>
          </div>
          {days.map((day) => (
            <SlotCell
              key={toDateKey(day)}
              slot={slotIndex.get(`${toDateKey(day)}|dinner`)}
              mealById={mealById}
              onClick={onSlotClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Generate form ─────────────────────────────────────────────────────────────

function GenerateForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof client.schedule.generate>[0]) =>
      client.schedule.generate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orpc.schedule.getActive.queryOptions().queryKey,
      });
      onSuccess();
    },
  });

  const form = useForm({
    defaultValues: {
      startDate: new Date().toISOString().slice(0, 10),
      durationWeeks: "1" as "1" | "2" | "4",
      maxLeftoverMealsOverride: "",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        startDate: new Date(value.startDate),
        durationWeeks: Number(value.durationWeeks) as 1 | 2 | 4,
        maxLeftoverMealsOverride:
          value.maxLeftoverMealsOverride !== ""
            ? Number(value.maxLeftoverMealsOverride)
            : undefined,
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap gap-4">
        <form.Field
          name="startDate"
          validators={{
            onChange: ({ value }) => (!value ? "Required" : undefined),
          }}
        >
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor="start-date" className="text-xs">
                Start date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-36 h-8 text-sm"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="durationWeeks">
          {(field) => (
            <div className="grid gap-1.5">
              <Label className="text-xs">Duration</Label>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as "1" | "2" | "4")}
              >
                <SelectTrigger className="w-28 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 week</SelectItem>
                  <SelectItem value="2">2 weeks</SelectItem>
                  <SelectItem value="4">4 weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Override quotas (optional)
        </summary>
        <div className="mt-2 flex flex-wrap gap-3">
          {([{ name: "maxLeftoverMealsOverride", label: "Max leftovers" }] as const).map(
            ({ name, label }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="grid gap-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Default"
                      className="w-24 h-8 text-sm"
                    />
                  </div>
                )}
              </form.Field>
            ),
          )}
        </div>
      </details>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={form.state.isSubmitting}>
          {form.state.isSubmitting ? "Generating…" : "Generate"}
        </Button>
        {mutation.error && (
          <span className="text-sm text-destructive">
            {(mutation.error as { message?: string }).message ?? "Failed"}
          </span>
        )}
      </div>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function SchedulePage() {
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
