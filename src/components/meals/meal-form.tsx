import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "#/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Input } from "#/components/ui/input";
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
      <FieldGroup>
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => (!value.trim() ? "Name is required" : undefined),
          }}
        >
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
              <FieldLabel htmlFor="meal-name">Name</FieldLabel>
              <Input
                id="meal-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g. Spaghetti Bolognese"
                aria-invalid={field.state.meta.errors.length > 0 || undefined}
              />
              <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
            </Field>
          )}
        </form.Field>

        <form.Field
          name="categoryId"
          validators={{
            onChange: ({ value }) => (!value ? "Category is required" : undefined),
          }}
        >
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
              <FieldLabel htmlFor="meal-category">Category</FieldLabel>
              <Select
                value={field.state.value ? String(field.state.value) : ""}
                onValueChange={(v) => field.handleChange(Number(v))}
              >
                <SelectTrigger
                  id="meal-category"
                  aria-invalid={field.state.meta.errors.length > 0 || undefined}
                >
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
            </Field>
          )}
        </form.Field>

        <form.Field
          name="diet"
          validators={{
            onChange: ({ value }) => (!value ? "Diet is required" : undefined),
          }}
        >
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
              <FieldLabel htmlFor="meal-diet">Diet</FieldLabel>
              <Select
                value={field.state.value ?? ""}
                onValueChange={(v) => field.handleChange(v as MealInsert["diet"])}
              >
                <SelectTrigger
                  id="meal-diet"
                  aria-invalid={field.state.meta.errors.length > 0 || undefined}
                >
                  <SelectValue placeholder="Select diet type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(Object.entries(DIET_LABELS) as [MealInsert["diet"], string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
            </Field>
          )}
        </form.Field>

        <form.Field
          name="season"
          validators={{
            onChange: ({ value }) => (!value ? "Season is required" : undefined),
          }}
        >
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
              <FieldLabel htmlFor="meal-season">Season</FieldLabel>
              <Select
                value={field.state.value ?? ""}
                onValueChange={(v) => field.handleChange(v as MealInsert["season"])}
              >
                <SelectTrigger
                  id="meal-season"
                  aria-invalid={field.state.meta.errors.length > 0 || undefined}
                >
                  <SelectValue placeholder="Select season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(Object.entries(SEASON_LABELS) as [MealInsert["season"], string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
            </Field>
          )}
        </form.Field>

        <form.Field name="suitableFor">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="meal-suitable-for">Suitable for</FieldLabel>
              <Select
                value={field.state.value ?? "any"}
                onValueChange={(v) => field.handleChange(v as MealInsert["suitableFor"])}
              >
                <SelectTrigger id="meal-suitable-for">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(
                      Object.entries(SUITABLE_FOR_LABELS) as [MealInsert["suitableFor"], string][]
                    ).map(([value, label]) => (
                      <SelectItem key={value} value={value ?? ""}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Field name="producesLeftovers">
          {(field) => (
            <Field orientation="horizontal">
              <Checkbox
                id="produces-leftovers"
                checked={field.state.value ?? false}
                onCheckedChange={(checked) => field.handleChange(checked === true)}
              />
              <FieldLabel htmlFor="produces-leftovers">Produces leftovers</FieldLabel>
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      {serverError && <FieldError role="alert">{serverError}</FieldError>}

      <Button type="submit" disabled={form.state.isSubmitting} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
