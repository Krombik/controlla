import type { Lane, PatchTreeNode, ControlInternals } from '#internal/types';
import addToLevel from '#internal/addToLevel';

const runPatching = (
  lane: Lane,
  internals: ControlInternals,
  nextValue: any,
  path: readonly string[] | undefined
) => {
  const l = path ? path.length : 0;

  let patchNode = lane._patchByControl.get(internals);

  let children: Map<string, PatchTreeNode>;

  if (patchNode) {
    children = patchNode._children;
  } else {
    children = new Map();

    patchNode = {
      _children: children,
      _hasValuePatch: false,
      _patchedKeys: [],
      _value: undefined,
    };

    lane._patchByControl.set(internals, patchNode);

    addToLevel(lane, internals);
  }

  for (let i = 0; i < l; i++) {
    let key = path![i];

    if (!children.has(key)) {
      patchNode._patchedKeys.push(key);

      while (++i < l) {
        children.set(key, {
          _children: (children = new Map()),
          _hasValuePatch: false,
          _patchedKeys: [(key = path![i])],
          _value: undefined,
        });
      }

      children.set(key, {
        _children: new Map(),
        _hasValuePatch: true,
        _patchedKeys: [],
        _value: nextValue,
      });

      return;
    }

    patchNode = children.get(key)!;

    children = patchNode._children;
  }

  if (patchNode._patchedKeys.length) {
    patchNode._patchedKeys.length = 0;

    children.clear();
  }

  patchNode._value = nextValue;

  patchNode._hasValuePatch = true;
};

export default runPatching;
