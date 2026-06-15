import { Button } from "#/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import type { RuleUpdate, RuleView } from "#/domains/rules/rules.zod";
import { client, orpc } from "#/orpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ContradictionAlert } from "./contradiction-alert";
import { RuleForm } from "./rule-form";
import { CREATE_DEFAULTS, toEditDefaults, toInsertInput } from "./rule-form-values";
import { ruleLabel } from "./rule-label";

function useInvalidateRules() {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orpc.rules.list.queryOptions().queryKey,
    });
}

export function RulesPage() {
  const invalidate = useInvalidateRules();
  const { data: rules } = useSuspenseQuery(orpc.rules.list.queryOptions());
  const { data: categories } = useSuspenseQuery(orpc.categories.list.queryOptions());

  const [sheetState, setSheetState] = useState<
    { mode: "create" } | { mode: "edit"; rule: RuleView } | null
  >(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => client.rules.delete({ id }),
    onSuccess: () => {
      invalidate();
      setDeletingId(null);
    },
  });

  const contradictions = rules.filter((r) => r.isContradicted);

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scheduling Rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rules.length} {rules.length === 1 ? "rule" : "rules"}
          </p>
        </div>
        <Button onClick={() => setSheetState({ mode: "create" })}>Add rule</Button>
      </div>

      <ContradictionAlert count={contradictions.length} />

      {rules.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          No rules yet. Add a rule to control how the scheduler builds your meal plan.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={`rounded-md border px-4 py-3 ${rule.isContradicted ? "border-destructive/30 bg-destructive/5" : ""}`}
            >
              {deletingId === rule.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-1">Delete this rule?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(rule.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{ruleLabel(rule, categories)}</p>
                    {rule.isContradicted && (
                      <p className="text-xs text-destructive mt-0.5">
                        Contradicts another rule on the same subject
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSheetState({ mode: "edit", rule })}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeletingId(rule.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Sheet open={sheetState !== null} onOpenChange={(open) => !open && setSheetState(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{sheetState?.mode === "edit" ? "Edit rule" : "Add rule"}</SheetTitle>
            <SheetDescription>
              {sheetState?.mode === "edit"
                ? "Update this scheduling rule."
                : "Create a new scheduling rule."}
            </SheetDescription>
          </SheetHeader>
          {sheetState?.mode === "create" && (
            <RuleForm
              key="create"
              defaultValues={CREATE_DEFAULTS}
              submitLabel="Add rule"
              onSubmit={async (values) => {
                await client.rules.create(toInsertInput(values));
                invalidate();
                setSheetState(null);
              }}
            />
          )}
          {sheetState?.mode === "edit" && (
            <RuleForm
              key={sheetState.rule.id}
              defaultValues={toEditDefaults(sheetState.rule)}
              submitLabel="Save changes"
              onSubmit={async (values) => {
                const update: RuleUpdate = {
                  operator: values.operator,
                  value: values.value,
                  scope: values.operator === "at_most" ? values.scope : "per_schedule",
                };
                await client.rules.update({
                  id: sheetState.rule.id,
                  ...update,
                });
                invalidate();
                setSheetState(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
