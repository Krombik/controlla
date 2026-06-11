import makeSafeStorage from '#persist/internal/makeSafeStorage';

/**
 * An observable {@link sessionStorage}-backed `PersistStorage`, or `undefined`
 * if `sessionStorage` is unavailable. Changes are observable within browsing
 * contexts sharing the session (same-origin iframes and `window.open` popups).
 */
const safeSessionStorage = makeSafeStorage('session');

export default safeSessionStorage;
