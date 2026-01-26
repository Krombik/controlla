import type createLoadRunner from '#internal/createLoadRunner';

export const loadOnce: Parameters<typeof createLoadRunner>[0] = (load) =>
  load();
