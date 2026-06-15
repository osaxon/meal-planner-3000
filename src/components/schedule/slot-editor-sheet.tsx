import { Button } from "#/components/ui/button";
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
import type { Slot } from "#/domains/schedule/schedule.zod";
import { formatDayHeader } from "#/lib/date-utils";
import { client, orpc } from "#/orpc/client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DIET_DOT } from "./diet";

export function SlotEditorSheet({
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
