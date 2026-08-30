// the env module must come first: it installs the native globals
import {
  emitAppState,
  emitDimensions,
  reportedErrors,
  tick,
} from './_env/native.ts';
import assert from 'node:assert';
import test from 'node:test';

const { default: $appVisible } =
  await import('../build-native/platform/appVisible/index.js');
const { default: $windowSize } =
  await import('../build-native/platform/windowSize/index.js');
const { default: getValue } =
  await import('../build-native/core/getValue/index.js');

test('$appVisible follows AppState, and only `active` is in front', async () => {
  assert.equal(getValue($appVisible), true, 'it starts from currentState');

  emitAppState('background');

  await tick();

  assert.equal(getValue($appVisible), false);

  // the app switcher and the incoming call - not in front of anyone
  emitAppState('inactive');

  await tick();

  assert.equal(getValue($appVisible), false, 'inactive is not visible either');

  emitAppState('active');

  await tick();

  assert.equal(getValue($appVisible), true);
});

test('$windowSize is the Dimensions window, and a change moves it', async () => {
  assert.deepEqual(getValue($windowSize), {
    width: 320,
    height: 640,
    scale: 2,
    fontScale: 1,
  });

  emitDimensions({ width: 640, height: 320, scale: 2, fontScale: 1 });

  await tick();

  assert.equal(getValue($windowSize.width), 640);
  assert.equal(getValue($windowSize.height), 320);
});

test('a Dimensions payload carrying no window is left alone', async () => {
  const before = getValue($windowSize.width);

  // react-native types the payload as carrying either metric or neither
  emitDimensions(undefined);

  await tick();

  assert.equal(getValue($windowSize.width), before, 'nothing was written');
});

test('reportError goes to ErrorUtils, not to a throw out of a timer', async () => {
  const { default: createControl } =
    await import('../build-native/core/createControl/index.js');
  const { default: watchValue } =
    await import('../build-native/core/watchValue/index.js');
  const { default: setValue } =
    await import('../build-native/core/setValue/index.js');

  const $c = createControl(1);

  const blew = new Error('the listener blew up');

  const stop = watchValue($c, () => {
    throw blew;
  });

  setValue($c, 2);

  await tick();

  stop();

  // a throw out of a timer reaches react-native's *fatal* handler; this is the
  // one that reports without killing the app
  assert.equal(reportedErrors.at(-1), blew);
});
