import { BulkDeleteDialog } from "#/components/meals/bulk-delete-dialog";
import { getMealColumns } from "#/components/meals/columns";
import { DataTable } from "#/components/meals/data-table";
import { IngredientsSection } from "#/components/meals/ingredients-section";
import { MealForm } from "#/components/meals/meal-form";
import { TagEditor } from "#/components/meals/tag-editor";
import { Button } from "#/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import type { MealInsert, MealWithCategory } from "#/domains/meals/meals.zod";
import { client, orpc } from "#/orpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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

const CREATE_DEFAULTS: MealInsert = {
  name: "",
  categoryId: 0,
  diet: "meat",
  season: "year_round",
  producesLeftovers: false,
  suitableFor: "any",
};

function MealsPage() {
  const queryClient = useQueryClient();
  const { data: meals } = useSuspenseQuery(orpc.meals.list.queryOptions());

  const [sheetState, setSheetState] = useState<SheetState | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const columns = useMemo(
    () => getMealColumns({ onEdit: (meal) => setSheetState({ mode: "edit", meal }) }),
    [],
  );

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: orpc.meals.list.queryOptions().queryKey,
    });
  }

  const createMutation = useMutation({
    mutationFn: (input: MealInsert) => client.meals.create(input),
    onSuccess: () => {
      invalidate();
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
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => client.meals.delete({ id }))),
    onSuccess: () => {
      invalidate();
      setRowSelection({});
      setBulkDeleteOpen(false);
    },
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Meal Pool</h1>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              Delete {selectedIds.length} meal{selectedIds.length !== 1 ? "s" : ""}
            </Button>
          )}
          <Button onClick={() => setSheetState({ mode: "create" })}>Add meal</Button>
        </div>
      </div>

      {meals.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          No meals yet. Add your first meal to get started.
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={meals}
          searchColumn="name"
          getRowId={(row) => String(row.id)}
          rowSelection={rowSelection}
          onRowSelection={setRowSelection}
        />
      )}

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={selectedIds.length}
        onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
        isPending={bulkDeleteMutation.isPending}
      />

      <Sheet open={sheetState !== null} onOpenChange={(open) => !open && setSheetState(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{sheetState?.mode === "edit" ? "Edit meal" : "Add meal"}</SheetTitle>
            <SheetDescription>
              {sheetState?.mode === "edit"
                ? "Update this meal's details."
                : "Add a new meal to your pool."}
            </SheetDescription>
          </SheetHeader>
          {sheetState?.mode === "create" && (
            <>
              <MealForm
                key="create"
                defaultValues={CREATE_DEFAULTS}
                submitLabel="Create meal"
                onSubmit={async (values) => {
                  const meal = await createMutation.mutateAsync(values);
                  setSheetState({ mode: "edit", meal });
                }}
              />
              <div className="border-t p-4">
                <h3 className="text-sm font-semibold mb-1">Ingredients</h3>
                <p className="text-sm text-muted-foreground">
                  Save the meal above to add ingredients.
                </p>
              </div>
            </>
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
              <TagEditor mealId={sheetState.meal.id} initialTags={sheetState.meal.tags} />
              <IngredientsSection mealId={sheetState.meal.id} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
