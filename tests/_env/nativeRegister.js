/**
 * Passed to node as `--import`, so the hook is in place before any test module
 * is resolved. Only the native build reaches for `react-native` at all.
 */
import { register } from 'node:module';

register('./nativeHooks.js', import.meta.url);
