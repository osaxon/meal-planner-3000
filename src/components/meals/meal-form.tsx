import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import type { MealInsert } from "#/domains/meals/meals.zod";
import { DIET_LABELS, SEASON_LABELS, SUITABLE_FOR_LABELS } from "#/domains/meals/meals.zod";
import { orpc } from "#/orpc/client";
import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

type Props = {
  defaultValues: MealInsert;
  onSubmit: (values: MealInsert) => Promise<void>;
  submitLabel: string;
};

export function MealForm({ defaultValues, onSubmit, submitLabel }: Props) {
  const { data: categories } = useSuspenseQuery(orpc.categories.list.queryOptions());
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await onSubmit(value);
      } catch (e) {
        setServerError((e as { message?: string }).message ?? "Something went wrong");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-5 mt-4 p-4"
    >
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) => (!value.trim() ? "Name is required" : undefined),
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor="meal-name">Name</Label>
            <Input
              id="meal-name"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="e.g. Spaghetti Bolognese"
            />
            {field.state.meta.errors[0] && (
              <span className="text-sm text-destructive">{field.state.meta.errors[0]}</span>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name="categoryId"
        validators={{
          onChange: ({ value }) => (!value ? "Category is required" : undefined),
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select
              value={field.state.value ? String(field.state.value) : ""}
              onValueChange={(v) => field.handleChange(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.state.meta.errors[0] && (
              <span className="text-sm text-destructive">{field.state.meta.errors[0]}</span>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name="diet"
        validators={{
          onChange: ({ value }) => (!value ? "Diet is required" : undefined),
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label>Diet</Label>
            <Select
              value={field.state.value ?? ""}
              onValueChange={(v) => field.handleChange(v as MealInsert["diet"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select diet type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(DIET_LABELS) as [MealInsert["diet"], string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            {field.state.meta.errors[0] && (
              <span className="text-sm text-destructive">{field.state.meta.errors[0]}</span>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name="season"
        validators={{
          onChange: ({ value }) => (!value ? "Season is required" : undefined),
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label>Season</Label>
            <Select
              value={field.state.value ?? ""}
              onValueChange={(v) => field.handleChange(v as MealInsert["season"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select season" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SEASON_LABELS) as [MealInsert["season"], string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            {field.state.meta.errors[0] && (
              <span className="text-sm text-destructive">{field.state.meta.errors[0]}</span>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="suitableFor">
        {(field) => (
          <div className="grid gap-1.5">
            <Label>Suitable for</Label>
            <Select
              value={field.state.value ?? "any"}
              onValueChange={(v) => field.handleChange(v as MealInsert["suitableFor"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SUITABLE_FOR_LABELS) as [MealInsert["suitableFor"], string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value ?? ""}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field name="producesLeftovers">
        {(field) => (
          <div className="flex items-center gap-2">
            <Checkbox
              id="produces-leftovers"
              checked={field.state.value ?? false}
              onCheckedChange={(checked) => field.handleChange(checked === true)}
            />
            <Label htmlFor="produces-leftovers">Produces leftovers</Label>
          </div>
        )}
      </form.Field>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" disabled={form.state.isSubmitting} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
