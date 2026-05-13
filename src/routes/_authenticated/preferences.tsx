import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { orpc, client } from "#/orpc/client";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Checkbox } from "#/components/ui/checkbox";
import type { Preferences } from "#/domains/preferences/preferences.zod";

export const Route = createFileRoute("/_authenticated/preferences")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.preferences.get.queryOptions()),
  component: PreferencesPage,
});

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function PreferencesPage() {
  const queryClient = useQueryClient();
  const { data: prefs } = useSuspenseQuery(orpc.preferences.get.queryOptions());

  const mutation = useMutation({
    mutationFn: (values: Preferences) => client.preferences.update(values),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: orpc.preferences.get.queryOptions().queryKey,
      }),
  });

  const form = useForm({
    defaultValues: prefs,
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure which days and meal times are included in generated schedules, and set diet
        balance quotas.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="mt-8 space-y-10"
      >
        {/* Slot Configuration */}
        <section>
          <h2 className="text-base font-semibold mb-4">Slot configuration</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium pb-2 pr-6 text-muted-foreground">Day</th>
                  <th className="font-medium pb-2 px-4 text-muted-foreground">Lunch</th>
                  <th className="font-medium pb-2 px-4 text-muted-foreground">Dinner</th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day} className="border-t">
                    <td className="py-2 pr-6 capitalize">{day}</td>
                    {(["lunch", "dinner"] as const).map((mealTime) => (
                      <td key={mealTime} className="py-2 px-4 text-center">
                        <form.Field name={`slotConfig.${day}.${mealTime}`}>
                          {(field) => (
                            <Checkbox
                              id={`${day}-${mealTime}`}
                              checked={field.state.value as boolean}
                              onCheckedChange={(checked) => field.handleChange(checked === true)}
                            />
                          )}
                        </form.Field>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Scheduler Constraints */}
        <section>
          <h2 className="text-base font-semibold mb-4">Scheduler constraints</h2>
          <div className="space-y-4 max-w-xs">
            {(
              [{ name: "maxLeftoverMeals", label: "Max leftover meals per schedule" }] as const
            ).map(({ name, label }) => (
              <form.Field
                key={name}
                name={name}
                validators={{
                  onChange: ({ value }) =>
                    typeof value !== "number" || value < 0 ? "Must be 0 or more" : undefined,
                }}
              >
                {(field) => (
                  <div className="flex items-center gap-4">
                    <Label htmlFor={name} className="flex-1 text-sm">
                      {label}
                    </Label>
                    <Input
                      id={name}
                      type="number"
                      min={0}
                      value={field.state.value as number}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      onBlur={field.handleBlur}
                      className="w-20 text-center"
                    />
                    {field.state.meta.errors.length > 0 && (
                      <span className="text-sm text-destructive">{field.state.meta.errors[0]}</span>
                    )}
                  </div>
                )}
              </form.Field>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={form.state.isSubmitting}>
            Save preferences
          </Button>
          {mutation.isSuccess && <span className="text-sm text-muted-foreground">Saved.</span>}
          {mutation.error && (
            <span className="text-sm text-destructive">
              {(mutation.error as { message?: string }).message ?? "Failed to save"}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
