import type { Lane, PatchTreeNode, ControlInternals } from '#internal/types';
import addToLevel from '#internal/addToLevel';
import { PatchType } from '#internal/constants';

const queuePatch = (
  lane: Lane,
  internals: ControlInternals,
  nextValue: any,
  path: readonly string[] | undefined
) => {
  let patchNode = lane._patchByControl.get(internals);

  let children: Map<string, PatchTreeNode>;

  if (patchNode) {
    children = patchNode._children;

    patchNode._type = PatchType.UNSET;
  } else {
    lane._patchByControl.set(
      internals,
      (patchNode = {
        _children: (children = new Map()),
        _type: PatchType.UNSET,
        _patchedKeys: [],
        _value: undefined,
      })
    );

    addToLevel(lane, internals);
  }

  if (path) {
    for (let i = 0, l = path.length; i < l; i++) {
      let key = path![i];

      if (!children.has(key)) {
        patchNode._patchedKeys.push(key);

        while (++i < l) {
          children.set(key, {
            _children: (children = new Map()),
            _type: PatchType.UNSET,
            _patchedKeys: [(key = path![i])],
            _value: undefined,
          });
        }

        children.set(key, {
          _children: new Map(),
          _type: PatchType.SET,
          _patchedKeys: [],
          _value: nextValue,
        });

        return;
      }

      patchNode = children.get(key)!;

      children = patchNode._children;
    }
  }

  if (patchNode._patchedKeys.length) {
    patchNode._patchedKeys.length = 0;

    children.clear();
  }

  patchNode._value = nextValue;

  patchNode._type = PatchType.SET;
};

export default queuePatch;
