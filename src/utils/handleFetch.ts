import becomingOnline from './becomingOnline';
import createLoader from './createLoader';

export const handleFetch: Parameters<typeof createLoader>[0] = (
  cancelPromise,
  load
) => {
  Promise.any([becomingOnline(), cancelPromise]).then(load);
};
