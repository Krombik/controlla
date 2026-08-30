import { PREFIXES } from '#router/internal/constants';
import type { AnyPaths } from '#router/internal/types';

/**
 * Declares which URLs are the app's own. A URL from the OS is matched against
 * the {@link prefixes} in order; the first one that fits is cut off and the
 * rest is the path. A URL fitting none of them belongs to something else -
 * another app's link, a development launcher - and is ignored, leaving the
 * screen where it is.
 *
 * Without this every URL the app is handed is treated as a path, whatever it
 * came from. React Native only: on the web the address bar is the only source
 * there is.
 *
 * @example
 * ```ts
 * import { createURL } from 'expo-linking';
 *
 * const router = createRouter(
 *   withPrefixes(
 *     // the app's own scheme, its website, and whatever the dev build uses
 *     ['myapp://', 'https://app.example.com', createURL('/')],
 *     { home: createPath(), product: createPath('product', param({ id: false })) }
 *   )
 * );
 * ```
 */
const withPrefixes = <Paths extends AnyPaths>(
  prefixes: string[],
  paths: Paths
): Paths =>
  ({
    ...paths,
    [PREFIXES]: prefixes,
  }) as Paths;

export default withPrefixes;
