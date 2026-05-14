import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { client, orpc } from "#/orpc/client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/categories")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.categories.list.queryOptions()),
  component: CategoriesPage,
});

type DeleteState = { id: number };

// ── Helpers ──────────────────────────────────────────────────────────────────

function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orpc.categories.list.queryOptions().queryKey,
    });
}

function errorMessage(e: unknown) {
  return (e as { message?: string } | null)?.message ?? null;
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateCategoryForm() {
  const invalidate = useInvalidateCategories();

  const mutation = useMutation(orpc.categories.create.mutationOptions({ onSuccess: invalidate }));

  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value, formApi }) => {
      await mutation.mutateAsync({ name: value.name.trim() });
      formApi.reset();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="mt-6 flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => (!value.trim() ? "Name is required" : undefined),
          }}
        >
          {(field) => (
            <Input
              placeholder="New category name"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              className="max-w-xs"
            />
          )}
        </form.Field>
        <Button type="submit" disabled={form.state.isSubmitting}>
          Add
        </Button>
      </div>
      {mutation.error && (
        <p className="text-sm text-destructive">
          {errorMessage(mutation.error) ?? "Failed to create category"}
        </p>
      )}
    </form>
  );
}

// ── Rename form ───────────────────────────────────────────────────────────────

function RenameCategoryForm({
  id,
  currentName,
  onDone,
}: {
  id: number;
  currentName: string;
  onDone: () => void;
}) {
  const invalidate = useInvalidateCategories();

  const mutation = useMutation({
    mutationFn: (name: string) => client.categories.rename({ id, name }),
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  const form = useForm({
    defaultValues: { name: currentName },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value.name.trim());
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="flex items-center gap-2"
    >
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) => (!value.trim() ? "Name is required" : undefined),
        }}
      >
        {(field) => (
          <Input
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            className="max-w-xs"
            autoFocus
          />
        )}
      </form.Field>
      <Button type="submit" size="sm" disabled={form.state.isSubmitting}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        Cancel
      </Button>
      {mutation.error && (
        <span className="text-sm text-destructive">
          {errorMessage(mutation.error) ?? "Failed to rename"}
        </span>
      )}
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function CategoriesPage() {
  const { data: categories } = useSuspenseQuery(orpc.categories.list.queryOptions());
  const invalidate = useInvalidateCategories();

  const [renaming, setRenaming] = useState<number | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => client.categories.delete({ id }),
    onSuccess: () => {
      setDeleteState(null);
      invalidate();
    },
  });

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Organise your meals by cuisine or format.
      </p>

      <CreateCategoryForm />

      <ul className="mt-6 flex flex-col gap-2">
        {categories.length === 0 && (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        )}
        {categories.map((cat) => {
          if (renaming === cat.id) {
            return (
              <li key={cat.id} className="rounded-md border px-3 py-2">
                <RenameCategoryForm
                  id={cat.id}
                  currentName={cat.name}
                  onDone={() => setRenaming(null)}
                />
              </li>
            );
          }

          if (deleteState?.id === cat.id) {
            return (
              <li key={cat.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="text-sm flex-1">Delete &ldquo;{cat.name}&rdquo;?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(cat.id)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteState(null)}>
                  Cancel
                </Button>
                {deleteMutation.error && (
                  <span className="text-sm text-destructive">
                    {errorMessage(deleteMutation.error) ?? "Failed to delete"}
                  </span>
                )}
              </li>
            );
          }

          return (
            <li
              key={cat.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="text-sm font-medium">{cat.name}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setRenaming(cat.id)}>
                  Rename
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteState({ id: cat.id })}>
                  Delete
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
