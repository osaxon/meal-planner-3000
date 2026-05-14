import type { MealWithCategory } from "#/domains/meals/meals.zod";
import { createContext, useContext, useState, type PropsWithChildren } from "react";

type SheetState = { mode: "create" } | { mode: "edit"; meal: MealWithCategory };

type ContextValue = {
  sheetState: SheetState | undefined;
  openCreate: () => void;
  openEdit: (meal: MealWithCategory) => void;
  closeSheet: () => void;
};

const MealContext = createContext<ContextValue | undefined>(undefined);

export function MealProvider({ children }: PropsWithChildren) {
  const [sheetState, setSheetState] = useState<SheetState | undefined>(undefined);

  return (
    <MealContext.Provider
      value={{
        sheetState,
        openCreate: () => setSheetState({ mode: "create" }),
        openEdit: (meal) => setSheetState({ mode: "edit", meal }),
        closeSheet: () => setSheetState(undefined),
      }}
    >
      {children}
    </MealContext.Provider>
  );
}

export const useMealSheet = () => {
  const ctx = useContext(MealContext);
  if (!ctx) throw new Error("useMeals must be used within MealProvider");
  return ctx;
};
