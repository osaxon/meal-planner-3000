import { getMealColumns } from "#/components/meals/columns";
import { DataTable } from "#/components/meals/data-table";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import type {
  Ingredient,
  IngredientInsert,
  Meal,
  MealInsert,
  MealWithCategory,
} from "#/domains/meals/meals.zod";
import {
  DIET_LABELS,
  SEASON_LABELS,
  SUITABLE_FOR_LABELS,
} from "#/domains/meals/meals.zod";
import { client, orpc } from "#/orpc/client";
import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { RowSelectionState } from "@tanstack/react-table";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/meals")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(orpc.meals.list.queryOptions()),
      context.queryClient.ensureQueryData(orpc.categories.list.queryOptions()),
    ]),
  component: MealsPage,
});

type SheetState = { mode: "create" } | { mode: "edit"; meal: MealWithCategory };

// ── Helpers ──────────────────────────────────────────────────────────────────

function useInvalidateMeals() {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orpc.meals.list.queryOptions().queryKey,
    });
}

// ── Meal form ─────────────────────────────────────────────────────────────────

function MealForm({
  defaultValues,
  onSubmit,
  submitLabel,
}: {
  defaultValues: MealInsert;
  onSubmit: (values: MealInsert) => Promise<void>;
  submitLabel: string;
}) {
  const { data: categories } = useSuspenseQuery(
    orpc.categories.list.queryOptions(),
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await onSubmit(value);
      } catch (e) {
        setServerError(
          (e as { message?: string }).message ?? "Something went wrong",
        );
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
          onChange: ({ value }) =>
            !value.trim() ? "Name is required" : undefined,
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
              <span className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </span>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name="categoryId"
        validators={{
          onChange: ({ value }) =>
            !value ? "Category is required" : undefined,
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
              <span className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </span>
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
                {(
                  Object.entries(DIET_LABELS) as [MealInsert["diet"], string][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.state.meta.errors[0] && (
              <span className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </span>
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
              onValueChange={(v) =>
                field.handleChange(v as MealInsert["season"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select season" />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(SEASON_LABELS) as [
                    MealInsert["season"],
                    string,
                  ][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.state.meta.errors[0] && (
              <span className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </span>
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
              onValueChange={(v) =>
                field.handleChange(v as MealInsert["suitableFor"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(SUITABLE_FOR_LABELS) as [
                    MealInsert["suitableFor"],
                    string,
                  ][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value ?? ""}>
                    {label}
                  </SelectItem>
                ))}
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
              onCheckedChange={(checked) =>
                field.handleChange(checked === true)
              }
            />
            <Label htmlFor="produces-leftovers">Produces leftovers</Label>
          </div>
        )}
      </form.Field>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button
        type="submit"
        disabled={form.state.isSubmitting}
        className="self-start"
      >
        {submitLabel}
      </Button>
    </form>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirm({
  meal,
  onDone,
}: {
  meal: MealWithCategory;
  onDone: () => void;
}) {
  const invalidate = useInvalidateMeals();
  const mutation = useMutation({
    mutationFn: () => client.meals.delete({ id: meal.id }),
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm flex-1">Delete &ldquo;{meal.name}&rdquo;?</span>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        Delete
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
      {mutation.error && (
        <span className="text-sm text-destructive">
          {(mutation.error as { message?: string }).message ??
            "Failed to delete"}
        </span>
      )}
    </div>
  );
}

// ── Ingredients section ───────────────────────────────────────────────────────

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

  const deleteMutation = useMutation({
    mutationFn: () =>
      client.meals.ingredients.delete({ mealId, ingredientId: ingredient.id }),
    onSuccess: onInvalidate,
  });

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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
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
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={() => setEditing(true)}
      >
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={() => deleteMutation.mutate()}
        disabled={deleteMutation.isPending}
      >
        Remove
      </Button>
    </li>
  );
}

function IngredientsSection({ mealId }: { mealId: number }) {
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
        <ul className="space-y-2 mb-4">
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
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => (!value.trim() ? "Required" : undefined),
          }}
        >
          {(field) => (
            <div className="grid gap-1 flex-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. Chicken breast"
              />
            </div>
          )}
        </form.Field>
        <form.Field name="quantity">
          {(field) => (
            <div className="grid gap-1 w-16">
              <Label className="text-xs">Qty</Label>
              <Input
                type="number"
                min={0}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="—"
              />
            </div>
          )}
        </form.Field>
        <form.Field name="unit">
          {(field) => (
            <div className="grid gap-1 w-20">
              <Label className="text-xs">Unit</Label>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. g"
              />
            </div>
          )}
        </form.Field>
        <Button type="submit" size="sm" disabled={form.state.isSubmitting}>
          Add
        </Button>
      </form>
    </div>
  );
}

// ── Tag editor ────────────────────────────────────────────────────────────────

function TagEditor({
  mealId,
  initialTags,
}: {
  mealId: number;
  initialTags: string[];
}) {
  const invalidate = useInvalidateMeals();
  const [tags, setTagsLocal] = useState(initialTags);
  const [input, setInput] = useState("");

  const mutation = useMutation({
    mutationFn: (newTags: string[]) =>
      client.meals.setTags({ id: mealId, tags: newTags }),
    onSuccess: (data) => {
      setTagsLocal(data);
      invalidate();
    },
  });

  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed || tags.includes(trimmed)) return;
    mutation.mutate([...tags, trimmed]);
    setInput("");
  }

  function removeTag(tag: string) {
    mutation.mutate(tags.filter((t) => t !== tag));
  }

  return (
    <div className="mt-6 border-t p-4">
      <h3 className="text-sm font-semibold mb-3">Tags</h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tags.length === 0 && (
          <p className="text-sm text-muted-foreground">No tags yet.</p>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"
          >
            {tag}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => removeTag(tag)}
              disabled={mutation.isPending}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addTag(input);
        }}
        className="flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. quick, weeknight"
          className="h-8 text-sm"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || mutation.isPending}
        >
          Add
        </Button>
      </form>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

type Filters = {
  categoryId: number | null;
  diet: Meal["diet"] | null;
  season: Meal["season"] | null;
  suitableFor: Meal["suitableFor"] | null;
  tags: string[];
};

const EMPTY_FILTERS: Filters = {
  categoryId: null,
  diet: null,
  season: null,
  suitableFor: null,
  tags: [],
};

function isActive(f: Filters) {
  return (
    f.categoryId !== null ||
    f.diet !== null ||
    f.season !== null ||
    f.suitableFor !== null ||
    f.tags.length > 0
  );
}

function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const { data: categories } = useSuspenseQuery(
    orpc.categories.list.queryOptions(),
  );
  const [tagInput, setTagInput] = useState("");

  function addFilterTag(tag: string) {
    const t = tag.trim().toLowerCase();
    if (!t || filters.tags.includes(t)) return;
    onChange({ ...filters, tags: [...filters.tags, t] });
    setTagInput("");
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-2">
      <div className="w-36">
        <Select
          value={filters.categoryId != null ? String(filters.categoryId) : ""}
          onValueChange={(v) =>
            onChange({ ...filters, categoryId: v ? Number(v) : null })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-32">
        <Select
          value={filters.diet ?? ""}
          onValueChange={(v) =>
            onChange({ ...filters, diet: (v as Meal["diet"]) || null })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Diet" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(DIET_LABELS) as [Meal["diet"], string][]).map(
              ([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="w-36">
        <Select
          value={filters.season ?? ""}
          onValueChange={(v) =>
            onChange({ ...filters, season: (v as Meal["season"]) || null })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Season" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(SEASON_LABELS) as [Meal["season"], string][]).map(
              ([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="w-36">
        <Select
          value={filters.suitableFor ?? ""}
          onValueChange={(v) =>
            onChange({
              ...filters,
              suitableFor: (v as Meal["suitableFor"]) || null,
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Suitable for" />
          </SelectTrigger>
          <SelectContent>
            {(
              Object.entries(SUITABLE_FOR_LABELS) as [
                Meal["suitableFor"],
                string,
              ][]
            ).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addFilterTag(tagInput);
        }}
        className="flex gap-1"
      >
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Filter by tag…"
          className="h-8 w-32 text-xs"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!tagInput.trim()}
        >
          +
        </Button>
      </form>

      {filters.tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                tags: filters.tags.filter((t) => t !== tag),
              })
            }
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </span>
      ))}

      {isActive(filters) && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const CREATE_DEFAULTS: MealInsert = {
  name: "",
  categoryId: 0,
  diet: "meat",
  season: "year_round",
  producesLeftovers: false,
  suitableFor: "any",
};

function MealsPage() {
  const invalidate = useInvalidateMeals();
  const { data: mealList } = useSuspenseQuery(orpc.meals.list.queryOptions());

  const [sheetState, setSheetState] = useState<SheetState | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useMemo(
    () =>
      getMealColumns({
        onEdit: (meal) => setSheetState({ mode: "edit", meal }),
      }),
    [],
  );

  const filteredMeals = mealList.filter((meal) => {
    if (filters.categoryId !== null && meal.categoryId !== filters.categoryId)
      return false;
    if (filters.diet !== null && meal.diet !== filters.diet) return false;
    if (filters.season !== null && meal.season !== filters.season) return false;
    if (
      filters.suitableFor !== null &&
      meal.suitableFor !== filters.suitableFor
    )
      return false;
    if (
      filters.tags.length > 0 &&
      !filters.tags.every((t) => meal.tags.includes(t))
    )
      return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: (input: MealInsert) => client.meals.create(input),
    onSuccess: () => {
      invalidate();
      setSheetState(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: MealInsert }) =>
      client.meals.update({ id, ...input }),
    onSuccess: () => {
      invalidate();
      setSheetState(null);
    },
  });

  const selectedIds = Object.keys(rowSelection).map(Number);

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) =>
      Promise.all(ids.map((id) => client.meals.delete({ id }))),
    onSuccess: () => {
      invalidate();
      setRowSelection({});
    },
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Meal Pool</h1>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(selectedIds)}
              disabled={bulkDeleteMutation.isPending}
            >
              Delete {selectedIds.length} meal
              {selectedIds.length !== 1 ? "s" : ""}
            </Button>
          )}
          <Button onClick={() => setSheetState({ mode: "create" })}>
            Add meal
          </Button>
        </div>
      </div>

      {mealList.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          No meals yet. Add your first meal to get started.
        </p>
      ) : filteredMeals.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          No meals match the current filters.
        </p>
      ) : deletingId ? (
        <DeleteConfirm
          meal={filteredMeals.find((m) => m.id === deletingId)!}
          onDone={() => setDeletingId(null)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredMeals}
          searchColumn="name"
          getRowId={(row) => String(row.id)}
          rowSelection={rowSelection}
          onRowSelection={setRowSelection}
        />
      )}

      <Sheet
        open={sheetState !== null}
        onOpenChange={(open) => !open && setSheetState(null)}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {sheetState?.mode === "edit" ? "Edit meal" : "Add meal"}
            </SheetTitle>
            <SheetDescription>
              {sheetState?.mode === "edit"
                ? "Update this meal's details."
                : "Add a new meal to your pool."}
            </SheetDescription>
          </SheetHeader>
          {sheetState?.mode === "create" && (
            <MealForm
              key="create"
              defaultValues={CREATE_DEFAULTS}
              submitLabel="Add meal"
              onSubmit={async (values) => {
                await createMutation.mutateAsync(values);
              }}
            />
          )}
          {sheetState?.mode === "edit" && (
            <>
              <MealForm
                key={sheetState.meal.id}
                defaultValues={{
                  name: sheetState.meal.name,
                  categoryId: sheetState.meal.categoryId,
                  diet: sheetState.meal.diet,
                  season: sheetState.meal.season,
                  producesLeftovers: sheetState.meal.producesLeftovers,
                  suitableFor: sheetState.meal.suitableFor,
                }}
                submitLabel="Save changes"
                onSubmit={async (values) => {
                  await updateMutation.mutateAsync({
                    id: sheetState.meal.id,
                    input: values,
                  });
                }}
              />
              <TagEditor
                mealId={sheetState.meal.id}
                initialTags={sheetState.meal.tags}
              />
              <IngredientsSection mealId={sheetState.meal.id} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
