import { oc } from "@orpc/contract";
import { z } from "zod";
import { ruleInsertSchema, ruleUpdateSchema, ruleViewSchema } from "./rules.zod";

export const listRulesContract = oc
  .route({ method: "GET", path: "/rules/", summary: "List all Scheduling Rules", tags: ["Rules"] })
  .output(z.array(ruleViewSchema));

export const createRuleContract = oc
  .route({
    method: "POST",
    path: "/rules/",
    successStatus: 201,
    summary: "Create a Scheduling Rule",
    tags: ["Rules"],
  })
  .input(ruleInsertSchema)
  .output(ruleViewSchema)
  .errors({
    CATEGORY_NOT_FOUND: { status: 404, message: "Category not found" },
  });

export const updateRuleContract = oc
  .route({
    method: "PATCH",
    path: "/rules/{id}",
    summary: "Update a Scheduling Rule",
    tags: ["Rules"],
  })
  .input(z.object({ id: z.number().int().positive() }).merge(ruleUpdateSchema))
  .output(ruleViewSchema)
  .errors({
    NOT_FOUND: { status: 404, message: "Rule not found" },
  });

export const deleteRuleContract = oc
  .route({
    method: "DELETE",
    path: "/rules/{id}",
    summary: "Delete a Scheduling Rule",
    tags: ["Rules"],
  })
  .input(z.object({ id: z.number().int().positive() }))
  .output(z.object({ deleted: z.boolean() }))
  .errors({
    NOT_FOUND: { status: 404, message: "Rule not found" },
  });
