/**
 * The same router declaration as the web examples - none of this changes.
 *
 * What changes is where the location comes from: there is no address bar, so
 * the first one is whatever `Linking.getInitialURL()` answers with (the deep
 * link the app was opened by, or `/`), and every one after it is a `url` event
 * or a `navigate` call. Paths are still paths.
 *
 * `withPrefixes` is the other half of that, and native-only: it says which urls
 * are this app's. `createURL('/')` is whatever the current build answers to -
 * `exp://10.0.0.2:8081/--/` under Expo Go, `controlla:///` in a dev build - so
 * the url a development launcher opens the app with matches nothing here and is
 * ignored, instead of being read as a path and landing on not-found.
 */

import { createURL } from 'expo-linking';

import createRouter from 'controlla-native/router/createRouter';
import createPath from 'controlla-native/router/createPath';
import param from 'controlla-native/router/param';
import query from 'controlla-native/router/query';
import withNotFound from 'controlla-native/router/withNotFound';
import withPrefixes from 'controlla-native/router/withPrefixes';

/**
 * `createURL('/')` is whatever the running build answers to, which is not
 * knowable ahead of time - `exp://10.0.0.2:8081/--/` under Expo Go,
 * `controlla:///` in a dev build.
 */
export const prefixes = ['https://controlla.example.com', createURL('/')];

export const router = createRouter(
  withPrefixes(
    prefixes,
    withNotFound({
      home: createPath(),

      /** `controlla:///product/42` - what a deep link lands on. */
      product: createPath('product', param({ id: false })),

      /** `controlla:///settings?tab=profile` */
      settings: createPath(
        'settings',
        query({
          tab: {
            optional: true,
            defaultValue: 'profile' as Tab,
            parse: (raw: string) => raw as Tab,
            isValid: (value: Tab) => TABS.includes(value),
            stringify: String,
          },
        })
      ),
    })
  )
);

export type Tab = 'profile' | 'storage';

const TABS: Tab[] = ['profile', 'storage'];
