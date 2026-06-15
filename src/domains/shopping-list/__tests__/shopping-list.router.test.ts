import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import router from "#/orpc/router/root";
import {
  authedContext,
  createMockLogger,
  givenAuthenticated,
  givenUnauthenticated,
} from "#/orpc/router/__tests__/test-utils";

const { shoppingListServiceMock } = vi.hoisted(() => ({
  shoppingListServiceMock: {
    list: vi.fn(),
    toggle: vi.fn(),
  },
}));

// The service under test. A class mock is reliably constructable; its methods
// delegate to the shared spies so tests configure and assert on them.
vi.mock("#/domains/shopping-list/shopping-list.service", () => ({
  ShoppingListService: class {
    list = shoppingListServiceMock.list;
    toggle = shoppingListServiceMock.toggle;
  },
}));

// Every other service the service-provider constructs must be mockable.
vi.mock("#/domains/fungi/fungi.service", () => ({ FungiService: vi.fn() }));
vi.mock("#/domains/categories/categories.service", () => ({ CategoryService: vi.fn() }));
vi.mock("#/domains/preferences/preferences.service", () => ({ PreferencesService: vi.fn() }));
vi.mock("#/domains/meals/meals.service", () => ({ MealService: vi.fn() }));
vi.mock("#/domains/schedule/schedule.service", () => ({ ScheduleService: vi.fn() }));
vi.mock("#/domains/rules/rules.service", () => ({ RulesService: vi.fn() }));

vi.mock("#/lib/logger", () => ({
  logger: {},
  createLogger: vi.fn(() => createMockLogger()),
  createModuleLogger: vi.fn((_name, parent) => parent),
}));

vi.mock("#/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

// The service-provider imports the real db, which eagerly initialises the libsql
// client from env. Mock it so router tests need no database connection.
vi.mock("#/db", () => ({ db: {} }));

const mockItem = {
  ingredientKey: "spaghetti",
  name: "Spaghetti",
  totalQuantity: 500,
  unit: "g",
  checked: false,
};

describe("Shopping List Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    givenAuthenticated();
  });

  describe("list", () => {
    it("returns the aggregated shopping list for the current user", async () => {
      shoppingListServiceMock.list.mockResolvedValue([mockItem]);

      const result = await call(router.shoppingList.list, undefined, authedContext());

      expect(result).toEqual([mockItem]);
      expect(shoppingListServiceMock.list).toHaveBeenCalledWith("user-1");
    });

    it("rejects when unauthenticated", async () => {
      givenUnauthenticated();

      await expect(
        call(router.shoppingList.list, undefined, authedContext()),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(shoppingListServiceMock.list).not.toHaveBeenCalled();
    });
  });

  describe("toggle", () => {
    it("returns the toggled item on success", async () => {
      const toggled = { ...mockItem, checked: true };
      shoppingListServiceMock.toggle.mockResolvedValue({ ok: true, value: toggled });

      const result = await call(
        router.shoppingList.toggle,
        { ingredientKey: "spaghetti" },
        authedContext(),
      );

      expect(result).toEqual(toggled);
      expect(shoppingListServiceMock.toggle).toHaveBeenCalledWith("user-1", "spaghetti");
    });

    it("throws NOT_FOUND when there is no active schedule", async () => {
      shoppingListServiceMock.toggle.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "No active schedule" },
      });

      await expect(
        call(router.shoppingList.toggle, { ingredientKey: "spaghetti" }, authedContext()),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
