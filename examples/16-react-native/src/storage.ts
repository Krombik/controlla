/**
 * There is no `localStorage`, so the native build ships no ready-made storage -
 * `getPersistStorage` takes whatever you hand it.
 *
 * The one requirement is that it is **synchronous**: a control has its value
 * before it is first read, so `AsyncStorage` cannot back one. `expo-sqlite`'s
 * key-value store has sync methods (`react-native-mmkv` is the other usual
 * pick), and `listen` is left out because nothing else writes these keys.
 */

import Storage from 'expo-sqlite/kv-store';
import type { PersistStorage } from 'controlla-native/persist/types';

const storage: PersistStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => Storage.removeItemSync(key),
};

export default storage;
