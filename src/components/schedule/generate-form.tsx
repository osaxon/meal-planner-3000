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
import { client, orpc } from "#/orpc/client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizeGenerateInput } from "./generate-input";

export function GenerateForm({ onSuccess }: { onSuccess: () => void }) {
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
      await mutation.mutateAsync(normalizeGenerateInput(value));
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
