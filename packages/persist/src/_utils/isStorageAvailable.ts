const isStorageAvailable = (key: 'local' | 'session') => {
  try {
    const storage = window[`${key}Storage`];

    const testKey = `__${key}Test__`;

    storage.setItem(testKey, '');

    storage.removeItem(testKey);

    return true;
  } catch {}
};

export default isStorageAvailable;
