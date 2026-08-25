import { historyState } from '#router/internal/state';

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
const repairHistory = (): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    const foreignCount = history.length - historyState._knownLength;

    if (foreignCount < 1 || !historyState._index) {
      resolve(false);
    } else {
      historyState._repairedUrl =
        location.pathname + location.search + location.hash;

      historyState._resolveRepair = resolve;

      history.go(-foreignCount - 1);
    }
  });

export default repairHistory;
