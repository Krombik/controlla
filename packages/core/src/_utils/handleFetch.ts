import type createLoader from '#utils/createLoader';

export const handleFetch: Parameters<typeof createLoader>[0] = (
  cancelPromise,
  load
) => {
  cancelPromise.then(load);
};
