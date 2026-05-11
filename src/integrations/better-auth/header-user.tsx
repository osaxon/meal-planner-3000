import { Link, useRouter } from "@tanstack/react-router";
import { authClient } from "#/lib/auth-client";

export default function BetterAuthHeader() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div
        role="status"
        aria-label="Loading session"
        className="h-8 w-24 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded"
      />
    );
  }

  if (session?.user) {
    const displayName = session.user.name || session.user.email;

    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-700 dark:text-neutral-300">{displayName}</span>
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            void router.navigate({ to: "/sign-in" });
          }}
          className="h-9 px-4 text-sm font-medium bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors rounded"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      to="/sign-in"
      className="text-sm font-medium text-neutral-900 dark:text-neutral-50 underline"
    >
      Sign in
    </Link>
  );
}
