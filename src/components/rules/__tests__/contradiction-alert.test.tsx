// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ContradictionAlert } from "../contradiction-alert";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ContradictionAlert", () => {
  it("renders nothing when there are no contradictions", () => {
    const { container } = render(<ContradictionAlert count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("uses the singular form for a single contradiction", () => {
    render(<ContradictionAlert count={1} />);
    expect(screen.getByText("1 rule cannot all be satisfied simultaneously")).toBeTruthy();
  });

  it("uses the plural form for multiple contradictions", () => {
    render(<ContradictionAlert count={3} />);
    expect(screen.getByText("3 rules cannot all be satisfied simultaneously")).toBeTruthy();
  });

  it("always reassures that scheduling continues (warn-don't-block)", () => {
    render(<ContradictionAlert count={2} />);
    expect(screen.getByText("The scheduler will do its best.")).toBeTruthy();
  });
});
