import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { TriangleAlertIcon } from "lucide-react";

/**
 * Warn-don't-block notice shown when some Rules cannot all be satisfied at once
 * (ADR/glossary: contradictions warn at read time, they never block). Renders
 * nothing when there are no contradictions.
 */
export function ContradictionAlert({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Alert className="mt-4">
      <TriangleAlertIcon data-icon />
      <AlertTitle>
        {count} rule{count > 1 ? "s" : ""} cannot all be satisfied simultaneously
      </AlertTitle>
      <AlertDescription>The scheduler will do its best.</AlertDescription>
    </Alert>
  );
}
