import { authed } from "#/orpc";

export const getPreferences = authed.preferences.get.handler(async ({ context }) => {
  return context.preferencesService.get(context.user.id);
});

export const updatePreferences = authed.preferences.update.handler(async ({ input, context }) => {
  return context.preferencesService.update(context.user.id, input);
});
