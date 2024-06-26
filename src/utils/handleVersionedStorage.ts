import toKey from 'keyweaver';
import { AnyState } from '../types';
// import { EMPTY_ARR } from './constants';

const handleVersionedStorage = (getItem: () => AnyState) => {
  const storage: Map<any, AnyState> = new Map();

  let versionStorage: Map<string, any>;

  //   return {
  //     a: EMPTY_ARR as any[],
  //     get(...args: any[]) {
  //       this.a = this.a.concat(args);

  // let item

  //       for (let i=1;i<args.length;i++) {

  //       }
  //     },
  //   };

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

    const item = getItem();

    storage.set(version, item);

    return item;
  };
};

export default handleVersionedStorage;
