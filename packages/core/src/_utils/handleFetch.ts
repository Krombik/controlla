import becomingOnline from '#utils/becomingOnline';
import type createLoader from '#utils/createLoader';

export const handleFetch: Parameters<typeof createLoader>[0] = (
  cancelPromise,
  load
) => {
  Promise.any([becomingOnline(), cancelPromise]).then(load);
};
