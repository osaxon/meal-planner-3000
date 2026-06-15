import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestDb, type TestDb } from "#/db/test-utils";
import { user, householdPreferences } from "#/db/schema";
import { PreferencesService } from "../preferences.service";
import { defaultSlotConfig } from "../preferences.zod";

const TEST_USER = { id: "user-1", name: "Alice", email: "alice@example.com" };

let db: TestDb;
let service: PreferencesService;

beforeEach(async () => {
  db = await createTestDb();
  service = new PreferencesService(db);
  await db.insert(user).values(TEST_USER);
});

describe("get", () => {
  it("creates a preferences record with defaults on first access", async () => {
    const prefs = await service.get(TEST_USER.id);

    expect(prefs.slotConfig).toEqual(defaultSlotConfig);
    expect(prefs.maxLeftoverMeals).toBe(2);
  });

  it("returns the same record on subsequent calls without creating duplicates", async () => {
    await service.get(TEST_USER.id);
    const prefs = await service.get(TEST_USER.id);

    expect(prefs.maxLeftoverMeals).toBe(2);
  });

  it("falls back to the default slot config when stored JSON has an invalid shape", async () => {
    await db.insert(householdPreferences).values({
      userId: TEST_USER.id,
      slotConfig: JSON.stringify({ monday: "nonsense", extra: true }),
      maxLeftoverMeals: 4,
    });

    const prefs = await service.get(TEST_USER.id);

    expect(prefs.slotConfig).toEqual(defaultSlotConfig);
    expect(prefs.maxLeftoverMeals).toBe(4); // other fields are still honoured
  });

  it("falls back to the default slot config when stored data is not valid JSON", async () => {
    await db
      .insert(householdPreferences)
      .values({ userId: TEST_USER.id, slotConfig: "not json at all", maxLeftoverMeals: 2 });

    const prefs = await service.get(TEST_USER.id);

    expect(prefs.slotConfig).toEqual(defaultSlotConfig);
  });

  it("preserves a well-formed stored slot config", async () => {
    const stored = { ...defaultSlotConfig, monday: { lunch: true, dinner: true } };
    await db
      .insert(householdPreferences)
      .values({ userId: TEST_USER.id, slotConfig: JSON.stringify(stored), maxLeftoverMeals: 2 });

    const prefs = await service.get(TEST_USER.id);

    expect(prefs.slotConfig).toEqual(stored);
  });
});

describe("update", () => {
  it("updates maxLeftoverMeals", async () => {
    const updated = await service.update(TEST_USER.id, { maxLeftoverMeals: 5 });

    expect(updated.maxLeftoverMeals).toBe(5);
  });

  it("updates slot config", async () => {
    const newSlotConfig = {
      ...defaultSlotConfig,
      monday: { lunch: true, dinner: true },
      saturday: { lunch: true, dinner: false },
    };

    const updated = await service.update(TEST_USER.id, { slotConfig: newSlotConfig });

    expect(updated.slotConfig.monday).toEqual({ lunch: true, dinner: true });
    expect(updated.slotConfig.saturday).toEqual({ lunch: true, dinner: false });
    expect(updated.slotConfig.tuesday).toEqual(defaultSlotConfig.tuesday);
  });

  it("persists changes so a subsequent get returns the updated values", async () => {
    await service.update(TEST_USER.id, { maxLeftoverMeals: 7 });
    const prefs = await service.get(TEST_USER.id);

    expect(prefs.maxLeftoverMeals).toBe(7);
  });

  it("creates the preferences record if it does not exist yet", async () => {
    const updated = await service.update(TEST_USER.id, { maxLeftoverMeals: 3 });

    expect(updated.maxLeftoverMeals).toBe(3);
  });
});
