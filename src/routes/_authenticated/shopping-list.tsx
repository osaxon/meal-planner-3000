import { Checkbox } from "#/components/ui/checkbox";
import { orpc } from "#/orpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/shopping-list")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.shoppingList.list.queryOptions()),
  component: ShoppingListPage,
});

const LIST_KEY = () => orpc.shoppingList.list.queryOptions().queryKey;

export const useShoppingList = () => {
  const queryClient = useQueryClient();
  const { data: items } = useSuspenseQuery(orpc.shoppingList.list.queryOptions());

  const toggleMutation = useMutation(
    orpc.shoppingList.toggle.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: LIST_KEY() }),
    }),
  );

  function formatQuantity(item: (typeof items)[number]) {
    if (item.totalQuantity === null && item.unit === null) return null;
    if (item.totalQuantity !== null && item.unit !== null)
      return `${item.totalQuantity} ${item.unit}`;
    if (item.totalQuantity !== null) return String(item.totalQuantity);
    return item.unit;
  }

  return {
    items,
    formatQuantity,
    toggle: (ingredientKey: string) => toggleMutation.mutate({ ingredientKey }),
    isTogglePending: toggleMutation.isPending,
  };
};

function ShoppingListPage() {
  const { items, formatQuantity, toggle, isTogglePending } = useShoppingList();

  if (items.length === 0) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight">Shopping list</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No items yet.{" "}
          <Link to="/schedule" className="underline underline-offset-2">
            Generate a schedule
          </Link>{" "}
          with meals that have ingredients to populate this list.
        </p>
      </div>
    );
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  function ItemRow({ item }: { item: (typeof items)[number] }) {
    const qty = formatQuantity(item);
    return (
      <li className="flex items-center gap-3 py-2">
        <Checkbox
          id={item.ingredientKey}
          checked={item.checked}
          disabled={isTogglePending}
          onCheckedChange={() => toggle(item.ingredientKey)}
        />
        <label
          htmlFor={item.ingredientKey}
          className={`flex-1 cursor-pointer select-none text-sm ${
            item.checked ? "text-muted-foreground line-through" : ""
          }`}
        >
          {item.name}
          {qty && <span className="ml-1.5 text-muted-foreground text-xs">× {qty}</span>}
        </label>
      </li>
    );
  }

  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Shopping list</h1>
        <p className="text-sm text-muted-foreground">
          {unchecked.length} of {items.length} remaining
        </p>
      </div>

      <ul className="mt-6 divide-y">
        {unchecked.map((item) => (
          <ItemRow key={item.ingredientKey} item={item} />
        ))}
      </ul>

      {checked.length > 0 && (
        <>
          <p className="mt-6 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Got it
          </p>
          <ul className="divide-y">
            {checked.map((item) => (
              <ItemRow key={item.ingredientKey} item={item} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
