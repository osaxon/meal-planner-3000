import { useShoppingList } from "#/routes/_authenticated/shopping-list";

export const ShoppingListSm = () => {
  const { items, toggle, formatQuantity, isTogglePending } = useShoppingList();

  return <pre>{JSON.stringify(items, null, 2)}</pre>;
};
