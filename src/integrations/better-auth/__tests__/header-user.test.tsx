// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

// ── Mocks ──────────────────────────────────────────────────────────────────

const { useSessionMock, signOutMock, navigateMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  signOutMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("#/lib/auth-client", () => ({
  authClient: {
    useSession: useSessionMock,
    signOut: signOutMock,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ navigate: navigateMock }),
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import BetterAuthHeader from "../header-user";

// ── Lifecycle ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  signOutMock.mockResolvedValue(undefined);
});

afterEach(() => {
  document.body.innerHTML = "";
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("BetterAuthHeader", () => {
  describe("authenticated session", () => {
    it("renders the user's name and a sign-out button", () => {
      useSessionMock.mockReturnValue({
        data: { user: { name: "Alice", email: "alice@example.com" } },
        isPending: false,
      });

      render(<BetterAuthHeader />);

      expect(screen.getByText("Alice")).toBeTruthy();
      expect(screen.getByRole("button", { name: /sign out/i })).toBeTruthy();
    });

    it("falls back to email when name is empty", () => {
      useSessionMock.mockReturnValue({
        data: { user: { name: "", email: "bob@example.com" } },
        isPending: false,
      });

      render(<BetterAuthHeader />);

      expect(screen.getByText("bob@example.com")).toBeTruthy();
    });

    it("falls back to email when name is null", () => {
      useSessionMock.mockReturnValue({
        data: { user: { name: null, email: "carol@example.com" } },
        isPending: false,
      });

      render(<BetterAuthHeader />);

      expect(screen.getByText("carol@example.com")).toBeTruthy();
    });
  });

  describe("no session", () => {
    it("renders a sign-in link", () => {
      useSessionMock.mockReturnValue({
        data: null,
        isPending: false,
      });

      render(<BetterAuthHeader />);

      const link = screen.getByRole("link", { name: /sign in/i });
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/sign-in");
    });
  });

  describe("loading state", () => {
    it("renders a skeleton placeholder while session is loading", () => {
      useSessionMock.mockReturnValue({
        data: null,
        isPending: true,
      });

      render(<BetterAuthHeader />);

      const skeleton = screen.getByRole("status", { name: /loading session/i });
      expect(skeleton).toBeTruthy();
    });
  });

  describe("sign-out flow", () => {
    it("calls signOut and navigates to /sign-in", async () => {
      useSessionMock.mockReturnValue({
        data: { user: { name: "Alice", email: "alice@example.com" } },
        isPending: false,
      });

      render(<BetterAuthHeader />);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /sign out/i }));

      expect(signOutMock).toHaveBeenCalledOnce();
      expect(navigateMock).toHaveBeenCalledWith({ to: "/sign-in" });
    });
  });
});
