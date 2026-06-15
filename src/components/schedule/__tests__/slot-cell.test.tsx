// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { MealWithCategory } from "#/domains/meals/meals.zod";
import type { Slot } from "#/domains/schedule/schedule.zod";
import { SlotCell } from "../slot-cell";

const meal: MealWithCategory = {
  id: 10,
  userId: "user-1",
  name: "Bolognese",
  categoryId: 1,
  categoryName: "Pasta",
  diet: "meat",
  season: "year_round",
  producesLeftovers: true,
  suitableFor: "any",
  dayAvailability: "any",
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
};

const mealById = new Map([[meal.id, meal]]);

function slot(overrides: Partial<Slot> = {}): Slot {
  return {
    id: 1,
    scheduleId: 1,
    date: new Date("2024-01-01T00:00:00.000Z"),
    mealTime: "dinner",
    type: "filled",
    mealId: meal.id,
    sourceSlotId: null,
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("SlotCell", () => {
  it("renders a filled slot with the meal name, category, and diet dot", () => {
    render(<SlotCell slot={slot()} mealById={mealById} onClick={vi.fn()} />);

    expect(screen.getByText("Bolognese")).toBeTruthy();
    expect(screen.getByText("Pasta")).toBeTruthy();
    expect(screen.getByTitle("meat")).toBeTruthy();
  });

  it("renders a leftover slot with the leftovers marker", () => {
    render(<SlotCell slot={slot({ type: "leftover" })} mealById={mealById} onClick={vi.fn()} />);

    expect(screen.getByText("Bolognese")).toBeTruthy();
    expect(screen.getByText(/Leftovers/)).toBeTruthy();
    // No diet dot on leftover cells
    expect(screen.queryByTitle("meat")).toBeNull();
  });

  it("renders 'Edit' for an empty slot", () => {
    render(
      <SlotCell
        slot={slot({ type: "empty", mealId: null })}
        mealById={mealById}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Edit")).toBeTruthy();
  });

  it("renders an em dash for an absent slot", () => {
    render(<SlotCell slot={undefined} mealById={mealById} onClick={vi.fn()} />);

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("shows 'Unknown meal' when the meal is not in the map", () => {
    render(<SlotCell slot={slot({ mealId: 999 })} mealById={mealById} onClick={vi.fn()} />);

    expect(screen.getByText("Unknown meal")).toBeTruthy();
  });

  it("calls onClick with the slot when a filled cell is clicked", async () => {
    const onClick = vi.fn();
    const s = slot();
    render(<SlotCell slot={s} mealById={mealById} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledWith(s);
  });

  it("does not call onClick for an absent slot", async () => {
    const onClick = vi.fn();
    render(<SlotCell slot={undefined} mealById={mealById} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });
});
