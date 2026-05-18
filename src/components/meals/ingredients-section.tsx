import { Button } from "#/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import type { Ingredient, IngredientInsert } from "#/domains/meals/meals.zod";
import { client, orpc } from "#/orpc/client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

function IngredientRow({
  ingredient,
  mealId,
  onInvalidate,
}: {
  ingredient: Ingredient;
  mealId: number;
  onInvalidate: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const deleteMutation = useMutation(
    orpc.meals.ingredients.delete.mutationOptions({
      onSuccess: onInvalidate,
    }),
  );

  const form = useForm({
    defaultValues: {
      name: ingredient.name,
      quantity: ingredient.quantity != null ? String(ingredient.quantity) : "",
      unit: ingredient.unit ?? "",
    },
    onSubmit: async ({ value, formApi }) => {
      await client.meals.ingredients.update({
        mealId,
        ingredientId: ingredient.id,
        name: value.name.trim(),
        quantity: value.quantity !== "" ? Number(value.quantity) : null,
        unit: value.unit.trim() || null,
      });
      onInvalidate();
      formApi.reset();
      setEditing(false);
    },
  });

  if (editing) {
    return (
      <li className="flex items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="flex flex-1 items-center gap-2"
        >
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => (!value.trim() ? "Required" : undefined),
            }}
          >
            {(field) => (
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Ingredient"
                className="flex-1"
                autoFocus
              />
            )}
          </form.Field>
          <form.Field name="quantity">
            {(field) => (
              <Input
                type="number"
                min={0}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Qty"
                className="w-16"
              />
            )}
          </form.Field>
          <form.Field name="unit">
            {(field) => (
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Unit"
                className="w-16"
              />
            )}
          </form.Field>
          <Button type="submit" size="sm" disabled={form.state.isSubmitting}>
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="flex-1">
        {ingredient.name}
        {ingredient.quantity != null && (
          <span className="text-muted-foreground ml-1">
            × {ingredient.quantity}
            {ingredient.unit ? ` ${ingredient.unit}` : ""}
          </span>
        )}
      </span>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(true)}>
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={() => deleteMutation.mutate({ mealId, ingredientId: ingredient.id })}
        disabled={deleteMutation.isPending}
      >
        Remove
      </Button>
    </li>
  );
}

export function IngredientsSection({ mealId }: { mealId: number }) {
  const queryClient = useQueryClient();
  const ingredientsKey = orpc.meals.ingredients.list.queryOptions({
    input: { mealId },
  }).queryKey;

  const { data: ingredients = [], isLoading } = useQuery(
    orpc.meals.ingredients.list.queryOptions({ input: { mealId } }),
  );

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ingredientsKey });
  }

  const form = useForm({
    defaultValues: { name: "", quantity: "", unit: "" } as {
      name: string;
      quantity: string;
      unit: string;
    },
    onSubmit: async ({ value, formApi }) => {
      const input: IngredientInsert = {
        name: value.name.trim(),
        quantity: value.quantity !== "" ? Number(value.quantity) : null,
        unit: value.unit.trim() || null,
      };
      await client.meals.ingredients.add({ mealId, ...input });
      invalidate();
      formApi.reset();
    },
  });

  return (
    <div className="mt-6 border-t p-4">
      <h3 className="text-sm font-semibold mb-3">Ingredients</h3>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-4">
          {ingredients.length === 0 && (
            <p className="text-sm text-muted-foreground">No ingredients yet.</p>
          )}
          {ingredients.map((ing) => (
            <IngredientRow
              key={ing.id}
              ingredient={ing}
              mealId={mealId}
              onInvalidate={invalidate}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="flex items-end gap-2"
      >
        <FieldGroup className="flex-row items-end gap-2">
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => (!value.trim() ? "Required" : undefined),
            }}
          >
            {(field) => (
              <Field className="flex-1">
                <FieldLabel>Name</FieldLabel>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. Chicken breast"
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="quantity">
            {(field) => (
              <Field className="w-16">
                <FieldLabel>Qty</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="—"
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="unit">
            {(field) => (
              <Field className="w-20">
                <FieldLabel>Unit</FieldLabel>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. g"
                />
              </Field>
            )}
          </form.Field>
        </FieldGroup>
        <Button type="submit" size="sm" disabled={form.state.isSubmitting}>
          Add
        </Button>
      </form>
    </div>
  );
}
