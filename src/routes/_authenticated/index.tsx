import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { orpc } from "#/orpc/client";

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.fungi.list.queryOptions()),
  component: Home,
});

function Home() {
  const { data: fungiList } = useSuspenseQuery(orpc.fungi.list.queryOptions());

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Fungi Catalog</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        An example CRUD app built with oRPC + TanStack Start.
      </p>

      {fungiList.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No fungi yet. Use the API to add some.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {fungiList.map((f) => (
            <li key={f.id} className="rounded-lg border p-4">
              <div className="font-medium">{f.commonName}</div>
              <div className="text-sm text-muted-foreground italic">{f.scientificName}</div>
              <div className="text-sm mt-1">
                {f.habitat} · {f.edible ? "Edible" : "Not edible"}
              </div>
              {f.description && (
                <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
