import { oc } from "@orpc/contract";
import { preferencesSchema, preferencesUpdateSchema } from "./preferences.zod";

export const getPreferencesContract = oc
  .route({
    method: "GET",
    path: "/preferences/",
    summary: "Get household preferences",
    tags: ["Preferences"],
  })
  .output(preferencesSchema);

export const updatePreferencesContract = oc
  .route({
    method: "PATCH",
    path: "/preferences/",
    summary: "Update household preferences",
    tags: ["Preferences"],
  })
  .input(preferencesUpdateSchema)
  .output(preferencesSchema);
