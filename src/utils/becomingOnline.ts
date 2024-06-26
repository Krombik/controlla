import { RESOLVED_PROMISE } from './constants';

let becomeOnlinePromise: Promise<void> | undefined | false;

const becomingOnline = () =>
  navigator.onLine
    ? RESOLVED_PROMISE
    : becomeOnlinePromise ||
      (becomeOnlinePromise = new Promise((res) => {
        window.addEventListener(
          'online',
          () => {
            becomeOnlinePromise = false;

            res();
          },
          { once: true }
        );
      }));

export default becomingOnline;
