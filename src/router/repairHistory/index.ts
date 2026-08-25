import { historyState } from '#router/internal/state';

let pending: Promise<boolean> | undefined;

/**
 * Drops the entries a third party left in the history - every navigation of an
 * iframe (a 3DS payment frame, an ad) appends one, and while they are there the
 * back button does nothing for as many presses. Every navigation repairs the
 * history first, so calling this is only for staying on the page after whatever
 * produced them: `await repairHistory()`.
 *
 * Resolves once done, or right away when there is nothing to drop. Cannot
 * repair the very first entry of the session, which has nothing in front of it
 * to push from.
 */
const repairHistory = (): Promise<boolean> => {
  // one repair at a time: a second `history.go` would take over the first
  // one's resolve and leave whoever awaits it there for good
  if (pending) {
    return pending;
  }

  const foreignCount = history.length - historyState._knownLength;

  if (foreignCount < 1 || !historyState._index) {
    return Promise.resolve(false);
  }

  historyState._repairedUrl =
    location.pathname + location.search + location.hash;

  pending = new Promise<boolean>((resolve) => {
    historyState._resolveRepair = () => {
      pending = undefined;

      resolve(true);
    };
  });

  history.go(-foreignCount - 1);

  return pending;
};

export default repairHistory;
