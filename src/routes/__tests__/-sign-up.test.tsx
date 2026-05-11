// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

// ── Mock ───────────────────────────────────────────────────────────────────

const { signUpEmailMock } = vi.hoisted(() => ({
  signUpEmailMock: vi.fn(),
}));

vi.mock("#/lib/auth-client", () => ({
  authClient: { signUp: { email: signUpEmailMock } },
}));

// ── Import the real component ──────────────────────────────────────────────

import { SignUpForm } from "#/components/sign-up-form";

// ── Lifecycle ──────────────────────────────────────────────────────────────

const onSuccess = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  signUpEmailMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  document.body.innerHTML = "";
});

// ── Helpers ────────────────────────────────────────────────────────────────

function renderForm() {
  return render(<SignUpForm onSuccess={onSuccess} />);
}

function input(id: string) {
  return document.getElementById(id) as HTMLInputElement;
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  fields: { name: string; email: string; password: string },
) {
  await user.type(input("name"), fields.name);
  await user.type(input("email"), fields.email);
  await user.type(input("password"), fields.password);
  await user.click(screen.getByRole("button", { name: /sign up/i }));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SignUpForm", () => {
  describe("credential passthrough", () => {
    it("calls signUp.email with the submitted name, email, and password", async () => {
      renderForm();
      const user = userEvent.setup();

      await fillAndSubmit(user, {
        name: "Alice",
        email: "alice@example.com",
        password: "hunter2hunter2",
      });

      expect(signUpEmailMock).toHaveBeenCalledOnce();
      expect(signUpEmailMock).toHaveBeenCalledWith({
        name: "Alice",
        email: "alice@example.com",
        password: "hunter2hunter2",
      });
    });

    it("calls onSuccess after a successful sign-up", async () => {
      renderForm();
      const user = userEvent.setup();

      await fillAndSubmit(user, {
        name: "Bob",
        email: "bob@example.com",
        password: "securepass123",
      });

      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  describe("error display", () => {
    it("shows the server error message when sign-up fails", async () => {
      signUpEmailMock.mockResolvedValue({
        error: { message: "Email already in use" },
      });

      renderForm();
      const user = userEvent.setup();

      await fillAndSubmit(user, {
        name: "Charlie",
        email: "taken@example.com",
        password: "password123",
      });

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe("Email already in use");
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("shows a fallback message when the server error has no message", async () => {
      signUpEmailMock.mockResolvedValue({
        error: {},
      });

      renderForm();
      const user = userEvent.setup();

      await fillAndSubmit(user, {
        name: "Dana",
        email: "dana@example.com",
        password: "password123",
      });

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe("Sign-up failed");
    });
  });

  describe("loading state", () => {
    it("disables the submit button while the request is in flight", async () => {
      // Never resolve — keeps the form in loading state
      signUpEmailMock.mockReturnValue(new Promise(() => {}));

      renderForm();
      const user = userEvent.setup();

      await fillAndSubmit(user, {
        name: "Eve",
        email: "eve@example.com",
        password: "password123",
      });

      expect(screen.getByRole("button").getAttribute("disabled")).not.toBeNull();
    });
  });
});
