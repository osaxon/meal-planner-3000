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
import { DIET_SUBJECT_LABELS, OPERATOR_LABELS, SCOPE_LABELS } from "#/domains/rules/rules.zod";
import { orpc } from "#/orpc/client";
import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { FormValues } from "./rule-form-values";

export function RuleForm({
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
