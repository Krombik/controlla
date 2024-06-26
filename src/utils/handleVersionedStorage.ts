import toKey from 'keyweaver';

const handleVersionedStorage = () => {
  const storage: Map<any, any> = new Map();

  let versionStorage: Map<string, any>;

  return (version: any) => {
    if (storage.has(version)) {
      return storage.get(version)!;
    }

    if (typeof version == 'object') {
      versionStorage ||= new Map();

      const stringifiedVersion = toKey(version);

      if (versionStorage.has(stringifiedVersion)) {
        const prevVersion = versionStorage.get(stringifiedVersion)!;

        if (storage.has(prevVersion)) {
          const root = storage.get(prevVersion)!;

          storage.delete(prevVersion);

          storage.set(version, root);

          return root;
        }
      } else {
        versionStorage.set(stringifiedVersion, version);
      }
    }

    // const root = createNestedRoot();

    // storage.set(version, root);

    // return root;
  };
};

export default handleVersionedStorage;
