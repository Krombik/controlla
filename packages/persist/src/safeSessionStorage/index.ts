import type { PersistStorage } from '#types';
import isStorageAvailable from '#utils/isStorageAvailable';

const safeSessionStorage =
  isStorageAvailable('session') && (sessionStorage satisfies PersistStorage);

export default safeSessionStorage;
