import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import type { RuleInsert, RuleUpdate, RuleView } from "#/domains/rules/rules.zod";
import { DIET_SUBJECT_LABELS, OPERATOR_LABELS, SCOPE_LABELS } from "#/domains/rules/rules.zod";
import { client, orpc } from "#/orpc/client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/rules")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(orpc.rules.list.queryOptions()),
      context.queryClient.ensureQueryData(orpc.categories.list.queryOptions()),
    ]),
  component: RulesPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function useInvalidateRules() {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orpc.rules.list.queryOptions().queryKey,
    });
}

function ruleLabel(rule: RuleView, categories: { id: number; name: string }[]): string {
  const op = OPERATOR_LABELS[rule.operator];
  const count = rule.value === 1 ? "1 meal" : `${rule.value} meals`;
  const suffix = rule.operator === "at_most" && rule.scope === "per_day" ? " per day" : "";
  if (rule.subjectType === "category") {
    const name =
      rule.categoryName ?? categories.find((c) => c.id === rule.categoryId)?.name ?? "Unknown";
    return `${op} ${count} from ${name}${suffix}`;
  }
  if (rule.subjectType === "tag") return `${op} ${count} tagged "${rule.subjectValue}"${suffix}`;
  return `${op} ${count} (${DIET_SUBJECT_LABELS[rule.subjectValue ?? ""] ?? rule.subjectValue})${suffix}`;
}

// ── Rule form ─────────────────────────────────────────────────────────────────

type FormValues = {
  subjectType: "category" | "tag" | "diet";
  categoryId: string;
  subjectValue: string;
  operator: "at_most" | "at_least";
  value: number;
  scope: "per_schedule" | "per_day";
};

function RuleForm({
  defaultValues,
  onSubmit,
  submitLabel,
}: {
  defaultValues: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  submitLabel: string;
}) {
  const { data: categories } = useSuspenseQuery(orpc.categories.list.queryOptions());
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await onSubmit(value);
      } catch (e) {
        setServerError((e as { message?: string }).message ?? "Something went wrong");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-5 p-4"
    >
      <FieldGroup>
        <form.Field name="subjectType">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="rule-subject-type">Subject type</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as FormValues["subjectType"])}
              >
                <SelectTrigger id="rule-subject-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                    <SelectItem value="diet">Diet</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.values.subjectType}>
          {(subjectType) => (
            <>
              {subjectType === "category" && (
                <form.Field
                  name="categoryId"
                  validators={{
                    onChange: ({ value }) => (!value ? "Select a category" : undefined),
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                      <FieldLabel htmlFor="rule-category">Category</FieldLabel>
                      <Select value={field.state.value} onValueChange={field.handleChange}>
                        <SelectTrigger
                          id="rule-category"
                          aria-invalid={field.state.meta.errors.length > 0 || undefined}
                        >
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                    </Field>
                  )}
                </form.Field>
              )}

              {subjectType === "tag" && (
                <form.Field
                  name="subjectValue"
                  validators={{
                    onChange: ({ value }) => (!value.trim() ? "Enter a tag" : undefined),
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                      <FieldLabel htmlFor="rule-tag">Tag</FieldLabel>
                      <Input
                        id="rule-tag"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g. quick"
                        aria-invalid={field.state.meta.errors.length > 0 || undefined}
                      />
                      <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                    </Field>
                  )}
                </form.Field>
              )}

              {subjectType === "diet" && (
                <form.Field
                  name="subjectValue"
                  validators={{
                    onChange: ({ value }) => (!value ? "Select a diet" : undefined),
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                      <FieldLabel htmlFor="rule-diet">Diet</FieldLabel>
                      <Select value={field.state.value} onValueChange={field.handleChange}>
                        <SelectTrigger
                          id="rule-diet"
                          aria-invalid={field.state.meta.errors.length > 0 || undefined}
                        >
                          <SelectValue placeholder="Select diet" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {Object.entries(DIET_SUBJECT_LABELS).map(([v, l]) => (
                              <SelectItem key={v} value={v}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                    </Field>
                  )}
                </form.Field>
              )}
            </>
          )}
        </form.Subscribe>

        <form.Field name="operator">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="rule-operator">Operator</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as FormValues["operator"])}
              >
                <SelectTrigger id="rule-operator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(OPERATOR_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.values.operator}>
          {(operator) =>
            operator === "at_most" ? (
              <form.Field name="scope">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="rule-scope">Applies per</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(v) => field.handleChange(v as FormValues["scope"])}
                    >
                      <SelectTrigger id="rule-scope">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(Object.entries(SCOPE_LABELS) as [FormValues["scope"], string][]).map(
                            ([v, l]) => (
                              <SelectItem key={v} value={v}>
                                {l}
                              </SelectItem>
                            ),
                          )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
            ) : null
          }
        </form.Subscribe>

        <form.Field
          name="value"
          validators={{
            onChange: ({ value }) => (value < 0 ? "Must be 0 or more" : undefined),
          }}
        >
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
              <FieldLabel htmlFor="rule-value">Number of meals</FieldLabel>
              <Input
                id="rule-value"
                type="number"
                min={0}
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
                className="w-24"
                aria-invalid={field.state.meta.errors.length > 0 || undefined}
              />
              <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      {serverError && <FieldError role="alert">{serverError}</FieldError>}
      <Button type="submit" disabled={form.state.isSubmitting} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const CREATE_DEFAULTS: FormValues = {
  subjectType: "diet",
  categoryId: "",
  subjectValue: "",
  operator: "at_most",
  value: 3,
  scope: "per_schedule",
};

function toInsertInput(values: FormValues): RuleInsert {
  const scope = values.operator === "at_most" ? values.scope : "per_schedule";
  if (values.subjectType === "category") {
    return {
      subjectType: "category",
      categoryId: Number(values.categoryId),
      operator: values.operator,
      value: values.value,
      scope,
    };
  }
  return {
    subjectType: values.subjectType,
    subjectValue: values.subjectValue,
    operator: values.operator,
    value: values.value,
    scope,
  } as RuleInsert;
}

function toEditDefaults(rule: RuleView): FormValues {
  return {
    subjectType: rule.subjectType,
    categoryId: rule.categoryId != null ? String(rule.categoryId) : "",
    subjectValue: rule.subjectValue ?? "",
    operator: rule.operator,
    value: rule.value,
    scope: rule.scope,
  };
}

function RulesPage() {
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

      {contradictions.length > 0 && (
        <Alert className="mt-4">
          <TriangleAlertIcon data-icon />
          <AlertTitle>
            {contradictions.length} rule{contradictions.length > 1 ? "s" : ""} cannot all be
            satisfied simultaneously
          </AlertTitle>
          <AlertDescription>The scheduler will do its best.</AlertDescription>
        </Alert>
      )}

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
