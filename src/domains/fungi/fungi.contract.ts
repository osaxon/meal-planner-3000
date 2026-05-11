import { oc } from "@orpc/contract";
import { z } from "zod";
import { fungiSelectSchema, fungiInsertSchema, fungiUpdateSchema } from "./fungi.zod";

export const listFungiContract = oc
  .route({ method: "GET", path: "/fungi/", summary: "List all fungi", tags: ["Fungi"] })
  .output(z.array(fungiSelectSchema));

export const findFungusContract = oc
  .route({ method: "GET", path: "/fungi/{id}", summary: "Find a fungus by ID", tags: ["Fungi"] })
  .input(z.object({ id: z.number().int().positive() }))
  .output(fungiSelectSchema)
  .errors({
    NOT_FOUND: { status: 404, message: "Fungus not found" },
  });

export const createFungusContract = oc
  .route({
    method: "POST",
    path: "/fungi/",
    successStatus: 201,
    summary: "Create a fungus",
    tags: ["Fungi"],
  })
  .input(fungiInsertSchema)
  .output(fungiSelectSchema)
  .errors({
    DUPLICATE: { status: 409, message: "A fungus with that scientific name already exists" },
  });

export const updateFungusContract = oc
  .route({ method: "PATCH", path: "/fungi/{id}", summary: "Update a fungus", tags: ["Fungi"] })
  .input(z.object({ id: z.number().int().positive() }).merge(fungiUpdateSchema))
  .output(fungiSelectSchema)
  .errors({
    NOT_FOUND: { status: 404, message: "Fungus not found" },
  });

export const deleteFungusContract = oc
  .route({ method: "DELETE", path: "/fungi/{id}", summary: "Delete a fungus", tags: ["Fungi"] })
  .input(z.object({ id: z.number().int().positive() }))
  .output(z.object({ deleted: z.boolean() }))
  .errors({
    NOT_FOUND: { status: 404, message: "Fungus not found" },
  });
