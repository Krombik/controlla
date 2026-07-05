import makeSafeStorage from '#persist/internal/makeSafeStorage';

/**
 * An observable {@link localStorage}-backed `PersistStorage`, or `undefined`
 * if `localStorage` is unavailable. Changes made in other tabs are observable.
 */
const safeLocalStorage = makeSafeStorage(localStorage);

export default safeLocalStorage;
