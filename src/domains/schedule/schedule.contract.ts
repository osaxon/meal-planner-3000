import { oc } from "@orpc/contract";
import {
  scheduleWithSlotsSchema,
  generateScheduleInputSchema,
  updateSlotInputSchema,
  slotSelectSchema,
} from "./schedule.zod";

export const generateScheduleContract = oc
  .route({
    method: "POST",
    path: "/schedule/generate",
    successStatus: 201,
    summary: "Generate a new schedule",
    tags: ["Schedule"],
  })
  .input(generateScheduleInputSchema)
  .output(scheduleWithSlotsSchema);

export const getActiveScheduleContract = oc
  .route({
    method: "GET",
    path: "/schedule",
    summary: "Get the active schedule with slots",
    tags: ["Schedule"],
  })
  .output(scheduleWithSlotsSchema.nullable());

export const updateSlotContract = oc
  .route({
    method: "PATCH",
    path: "/schedule/slots/{slotId}",
    summary: "Swap or empty a slot in the active schedule",
    tags: ["Schedule"],
  })
  .input(updateSlotInputSchema)
  .output(slotSelectSchema)
  .errors({
    NOT_FOUND: { status: 404, message: "Slot not found in active schedule" },
  });
