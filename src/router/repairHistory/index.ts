import { historyState } from '#router/internal/state';

let pending: Promise<boolean> | undefined;

/**
 * Drops the entries a third party left in the history - every navigation of an
 * iframe (a 3DS payment frame, an ad) appends one, and while they are there the
 * back button does nothing for as many presses. Every navigation repairs the
 * history first, so calling this is only for staying on the page after whatever
 * produced them: `await repairHistory()`.
 *
 * Resolves once done, or right away when there is nothing to drop. On the page
 * the session started at - or the one a reload or a tab duplication landed on,
 * before anything was navigated - there is no entry of ours behind to push
 * from: it steps back onto its own entry instead, leaving them in front of it,
 * where the next navigation prunes them.
 */
const repairHistory = (): Promise<boolean> => {
  // one repair at a time: a second `history.go` would take over the first
  // one's resolve and leave whoever awaits it there for good
  if (pending) {
    return pending;
  }

  const foreignCount = history.length - historyState._knownLength;

  if (foreignCount < 1 || !historyState._knownLength) {
    return Promise.resolve(false);
  }

  // below the entry this document loaded at there is nothing left to pop to -
  // that document is gone, and the browser loads the page instead
  const fromOwn = historyState._index > historyState._baseIndex;

  const repairedUrl = location.pathname + location.search + location.hash;

  pending = new Promise<boolean>((resolve) => {
    historyState._resolveRepair = () => {
      history[fromOwn ? 'pushState' : 'replaceState'](
        {
          ...(history.state as { idx?: number }),
          idx: historyState._index,
        },
        '',
        repairedUrl
      );

      historyState._knownLength = history.length;

      historyState._resolveRepair = undefined;

      pending = undefined;

      resolve(true);
    };
  });

  history.go(-foreignCount - +fromOwn);

  return pending;
};

export default repairHistory;
