import { RESOLVED_PROMISE } from '#utils/constants';

let becomeOnlinePromise: Promise<void> | undefined;

const becomingOnline = () =>
  navigator.onLine
    ? RESOLVED_PROMISE
    : becomeOnlinePromise ||
      (becomeOnlinePromise = new Promise((res) => {
        window.addEventListener(
          'online',
          () => {
            becomeOnlinePromise = undefined;

            res();
          },
          { once: true }
        );
      }));

export default becomingOnline;
