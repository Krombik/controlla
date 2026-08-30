/**
 * The React Native build, and only the parts that differ from the web one.
 *
 * Everything else - controls, derived controls, registries, validators - is the
 * same code and reads the same way, so it is not repeated here. What is here is
 * every place the two builds part ways:
 *
 * - the **first location** comes from `Linking`, not from an address bar, so it
 *   arrives a tick late: `$routerReady` is what anything outside the router view
 *   waits on (on the web it is `true` from the start).
 * - **`withPrefixes`** says which urls are the app's; one that matches none of
 *   them is ignored rather than matched (see `router.ts`).
 * - **`$appVisible`** follows `AppState`, and `reloadOnFocus` with it.
 * - **`$windowSize`** follows `Dimensions` - rotate the simulator.
 * - **`useLink`** hands back `onPress`, not `onClick`.
 * - a **field** binds to a `TextInput`; there is no `NativeField`, since there
 *   is no element to map to.
 * - **persistence** takes a storage of your own, because there is no
 *   `localStorage` (see `storage.ts`).
 * - **`navigationBlocker`** parks a navigation the same way, but arms no
 *   `beforeunload` - nothing asks when an app is swiped away.
 * - **`go`** is the only back there is: no browser button, and on iOS no
 *   hardware one either.
 * - **`reportError`** goes to `ErrorUtils`, so a throw in a listener shows up in
 *   LogBox instead of killing the app.
 */

import {
  useEffect,
  useState,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import createControl from 'controlla-native/core/createControl';
import createAsyncControl from 'controlla-native/core/createAsyncControl';
import requestLoader from 'controlla-native/loader/requestLoader';
import getPersistStorage from 'controlla-native/persist/getPersistStorage';
import useControl from 'controlla-native/core/useControl';
import useValue from 'controlla-native/core/useValue';
import setValue from 'controlla-native/core/setValue';
import watchValue from 'controlla-native/core/watchValue';
import selectReady from 'controlla-native/core/selectReady';
import ControlConsumer from 'controlla-native/core/ControlConsumer';
import $appVisible from 'controlla-native/platform/appVisible';
import $windowSize from 'controlla-native/platform/windowSize';
import $routerReady from 'controlla-native/router/routerReady';
import createRouterView from 'controlla-native/router/createRouterView';
import Link from 'controlla-native/router/Link';
import navigate from 'controlla-native/router/navigate';
import go from 'controlla-native/router/go';
import navigationBlocker from 'controlla-native/router/navigationBlocker';
import selectParams from 'controlla-native/router/selectParams';
import NOT_FOUND from 'controlla-native/router/NOT_FOUND';
import FormProvider from 'controlla-native/form/FormProvider';
import Field from 'controlla-native/form/Field';
import useForm from 'controlla-native/form/useForm';
import useValidator from 'controlla-native/form/useValidator';
import useFormState from 'controlla-native/form/useFormState';
import type { NavigationTarget } from 'controlla-native/router/types';
import type { ControlScope } from 'controlla-native/core/types';

import { prefixes, router, type Tab } from './router';
import storage from './storage';

/* -------------------------------------------------------------------------- */
/* shared bits                                                                 */
/* -------------------------------------------------------------------------- */

const Row: FC<{ label: string; value: ReactNode }> = ({ label, value }) => (
  <View style={s.row}>
    <Text style={s.label}>{label}</Text>
    <Text style={s.value}>{value}</Text>
  </View>
);

const Card: FC<PropsWithChildren<{ title: string; note?: string }>> = ({
  title,
  note,
  children,
}) => (
  <View style={s.card}>
    <Text style={s.cardTitle}>{title}</Text>
    {note ? <Text style={s.note}>{note}</Text> : null}
    {children}
  </View>
);

const Button: FC<{ label: string; onPress(): void; active?: boolean }> = ({
  label,
  onPress,
  active,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      s.button,
      active && s.buttonActive,
      pressed && s.buttonPressed,
    ]}
  >
    <Text style={[s.buttonText, active && s.buttonTextActive]}>{label}</Text>
  </Pressable>
);

/**
 * The whole of what a link is on native: `useLink` returns `onPress` here and
 * `onClick` on the web, so this is a `Pressable` instead of an `<a>`. `href` is
 * still built, which is what makes it worth showing.
 */
const NavLink: FC<{ to: NavigationTarget; label: string }> = ({
  to,
  label,
}) => (
  <Link
    to={to}
    trackMatch
    render={({ href, onPress, isMatched }) => (
      <Pressable onPress={onPress} style={[s.link, isMatched && s.linkActive]}>
        <Text style={[s.linkText, isMatched && s.linkTextActive]}>{label}</Text>
        <Text style={s.href}>{href}</Text>
      </Pressable>
    )}
  />
);

/* -------------------------------------------------------------------------- */
/* platform controls                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `reloadOnFocus` is a `visibilitychange` listener on the web and an `AppState`
 * one here. Background the app (Cmd+Shift+H) for three seconds and come back:
 * the timestamp moves.
 */
const $serverTime = createAsyncControl({
  ...requestLoader(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));

    return new Date().toLocaleTimeString();
  }),
  reloadOnFocus: 3000,
});

/**
 * What the router matched the first time, straight from the source - a dev
 * launcher or Expo Go hands the app a url of its own, and that url is a path
 * like any other, so it decides the first screen.
 */
const useLaunchUrl = () => {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    Linking.getInitialURL().then((value) => setUrl(value || 'none - so /'));
  }, []);

  return url;
};

const Platform: FC = () => {
  // width and height are separate controls - rotating changes both, but a
  // component reading one of them re-renders only for that one
  const width = useValue($windowSize.width);

  const height = useValue($windowSize.height);

  const isVisible = useValue($appVisible);

  return (
    <Card
      title='AppState and Dimensions'
      note='Rotate the simulator (Cmd + arrow), then background the app for 3s and come back.'
    >
      <Row
        label='$windowSize'
        value={`${Math.round(width)} x ${Math.round(height)}`}
      />
      <Row label='$appVisible' value={String(isVisible)} />
      <Row
        label='reloadOnFocus'
        value={
          <ControlConsumer
            control={$serverTime}
            render={(time) => time ?? 'loading...'}
          />
        }
      />
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/* reportError                                                                 */
/* -------------------------------------------------------------------------- */

const $throwOnRead = createControl(0);

watchValue($throwOnRead, (value) => {
  if (value) {
    throw new Error('thrown by a watchValue listener - reported, not fatal');
  }
});

const Errors: FC = () => (
  <Card
    title='reportError'
    note='A throw in a listener goes to ErrorUtils.reportError - LogBox shows it and the app keeps running. A throw out of a timer, which is what the web build does, would be fatal here.'
  >
    <Button
      label='throw in a listener'
      onPress={() => setValue($throwOnRead, (count) => count + 1)}
    />
  </Card>
);

/* -------------------------------------------------------------------------- */
/* persistence                                                                 */
/* -------------------------------------------------------------------------- */

type Preferences = { label: string; count: number };

const $preferences = createControl<Preferences>(
  { label: 'unnamed device', count: 0 },
  getPersistStorage({
    name: 'controlla.example.preferences',
    storage,
    isValid: (value) =>
      !!value &&
      typeof value.label === 'string' &&
      typeof value.count === 'number',
  })
);

const Persisted: FC = () => {
  const count = useValue($preferences.count);

  return (
    <Card
      title='persistence'
      note='Backed by expo-sqlite instead of localStorage. Kill the app from the app switcher and reopen it - the count is still here.'
    >
      <Row label='count' value={count} />
      <Button
        label='+1'
        onPress={() => setValue($preferences.count, (value) => value + 1)}
      />
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/* screens                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `withPrefixes` is the native-only half of the router: a url the app is handed
 * only counts as a path when it starts with one of these. Anything else - the
 * url a development launcher opens the app with, a link belonging to another
 * app - is left alone instead of being matched and landing on not-found.
 */
const Prefixes: FC = () => (
  <Card title='urls this app answers to' note={prefixes.join('\n')}>
    <Row label='launch url' value={useLaunchUrl()} />
  </Card>
);

/**
 * There is no back button on the device to fall back on, so a screen that
 * offers one calls `go` - the same move android's hardware button makes, and
 * the same one an enabled `navigationBlocker` parks.
 *
 * It answers `false` when there is no such entry, which is where the two
 * platforms differ over what should happen: android leaves the app, and here
 * there is nothing else to do but stay.
 */
const Back: FC = () => {
  const [message, setMessage] = useState<string>();

  const move = (delta: number) => {
    setMessage(go(delta) ? undefined : 'no entry that way');
  };

  return (
    <Card
      title='go(delta)'
      note='Navigate somewhere first - product, or settings - then move through the stack. On android the hardware button is go(-1), and leaves the app when it answers false.'
    >
      <View style={s.tabs}>
        <Button label='back' onPress={() => move(-1)} />
        <Button label='forward' onPress={() => move(1)} />
        <Button label='exit (android)' onPress={() => BackHandler.exitApp()} />
      </View>
      {message ? <Text style={s.note}>{message}</Text> : null}
    </Card>
  );
};

const Home: FC = () => (
  <>
    <Card
      title='deep links'
      note={
        'The launch url is what the router matches first, and a url arriving ' +
        'later is a push. Needs a dev build - in Expo Go the url comes as ' +
        'exp://.../--/product/42 and lands on not-found.\n\n' +
        'xcrun simctl openurl booted "controlla:///product/42"\n' +
        'xcrun simctl openurl booted "controlla:///settings?tab=storage"'
      }
    >
      <NavLink
        to={router.navigation.product({ id: '42' })}
        label='product 42'
      />
      <NavLink to={router.navigation.settings({})} label='settings' />
    </Card>
    <Prefixes />
    <Platform />
    <Persisted />
    <Back />
    <Errors />
    <Missing />
  </>
);

/** Web-only exports, listed so it is clear they are missing on purpose. */
const Missing: FC = () => (
  <Card
    title='not in this build'
    note={
      'mediaQuery and $online (no matchMedia, no navigator.onLine)\n' +
      'NativeField and useNativeField (no input element)\n' +
      'safeLocalStorage and safeSessionStorage (bring your own)\n' +
      'anchors, trackScroll and repairHistory (no document to scroll)'
    }
  />
);

const $productParams = selectParams(router.routes.product);

const Product: FC = () => {
  const id = useValue($productParams.id);

  return (
    <Card
      title={`product ${id}`}
      note='Opened by a link or by a url from the OS - the router cannot tell the two apart, and neither can this screen.'
    >
      <NavLink
        to={router.navigation.product({ id: String(Number(id) + 1) })}
        label='next product'
      />
    </Card>
  );
};

const $settingsParams = selectParams(router.routes.settings);

const TABS: Tab[] = ['profile', 'storage'];

/**
 * A field is the one part of the form module that differs: there is no
 * `NativeField`, because there is no element to map a type onto. `Field` hands
 * over a value, an `onChange` taking that value, and a `ref` - a `TextInput`
 * satisfies it, so a failed submit focuses the first invalid one.
 */
const NameField: FC<{ $name: ControlScope<string> }> = ({ $name }) => {
  const $error = useValidator(
    $name,
    (name) =>
      name.trim().length > 2 ? undefined : 'at least three characters',
    'blur'
  );

  return (
    <Field
      control={$name}
      render={({ value, onChange, onBlur, ref, isError }) => (
        <View>
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder='display name'
            style={[s.input, isError && s.inputError]}
          />
          <ControlConsumer
            control={$error}
            render={(message) =>
              message ? <Text style={s.error}>{message}</Text> : null
            }
          />
        </View>
      )}
    />
  );
};

const HandleField: FC<{ $handle: ControlScope<string> }> = ({ $handle }) => {
  const $error = useValidator($handle, (handle) =>
    handle.startsWith('@') ? undefined : 'has to start with @'
  );

  return (
    <Field
      control={$handle}
      render={({ value, onChange, ref, isError }) => (
        <View>
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChange}
            autoCapitalize='none'
            placeholder='@handle'
            style={[s.input, isError && s.inputError]}
          />
          <ControlConsumer
            control={$error}
            render={(message) =>
              message ? <Text style={s.error}>{message}</Text> : null
            }
          />
        </View>
      )}
    />
  );
};

/**
 * The blocker parks a navigation until it is answered, which is the same on
 * both builds. What is missing here is the other half of it: on the web an
 * enabled blocker also arms `beforeunload`, so closing the tab asks. Nothing
 * asks when an app is swiped out of the switcher, so unsaved work that has to
 * survive that has to be written down instead.
 *
 * On android the hardware back button goes through this too - it is a
 * navigation like any other.
 */
const LeaveGuard: FC = () => {
  const { $isDirty } = useFormState();

  const isDirty = useValue($isDirty);

  const isPending = useValue(navigationBlocker.isPendingNavigation);

  useEffect(() => {
    if (isDirty) {
      // enable() returns its own disable, so this is the whole cleanup
      return navigationBlocker.enable();
    }
  }, [isDirty]);

  return isPending ? (
    <View style={s.tabs}>
      <Text style={s.note}>leave with unsaved edits?</Text>
      <Button
        label='leave'
        onPress={() => navigationBlocker.isPendingNavigation.allow()}
      />
      <Button
        label='stay'
        onPress={() => navigationBlocker.isPendingNavigation.deny()}
      />
    </View>
  ) : isDirty ? (
    <Text style={s.note}>edited - leaving is blocked until this is saved</Text>
  ) : null;
};

const SubmitButton: FC<{ onPress(): void }> = ({ onPress }) => {
  const { $isSubmitting } = useFormState();

  return (
    <Button
      label={useValue($isSubmitting) ? 'saving...' : 'save'}
      onPress={onPress}
    />
  );
};

const Settings: FC = () => {
  const tab = useValue($settingsParams.tab);

  const $values = useControl({ name: '', handle: '' });

  const [saved, setSaved] = useState<string>();

  const form = useForm($values, {
    async submit(values) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSaved(`${values.name} (${values.handle})`);

      form.reset($values, values);
    },
    // there is no scroll-into-view here - the focus is what the user sees
    submitFailed: () => setSaved(undefined),
  });

  return (
    <>
      <Card
        title='settings'
        note='?tab= is a query param, the same as on the web.'
      >
        <View style={s.tabs}>
          {TABS.map((value) => (
            <Button
              key={value}
              label={value}
              active={tab === value}
              onPress={() => setValue($settingsParams.tab, value)}
            />
          ))}
        </View>
      </Card>

      {tab === 'storage' ? (
        <Persisted />
      ) : (
        <Card
          title='a form on a TextInput'
          note='Leave both empty and press save: the first invalid field takes the focus, which is the whole of what a failed submit does here.'
        >
          <FormProvider form={form}>
            <NameField $name={$values.name} />
            <HandleField $handle={$values.handle} />
            <SubmitButton onPress={form.submit} />
            <LeaveGuard />
          </FormProvider>
          {saved ? <Text style={s.saved}>saved {saved}</Text> : null}
        </Card>
      )}
    </>
  );
};

const NotFound: FC = () => (
  <Card
    title='not found'
    note='A url the router has no route for lands here - including the one a dev launcher opens the app with.'
  >
    <Row label='launch url' value={useLaunchUrl()} />
    <Button label='home' onPress={() => navigate(router.navigation.home())} />
  </Card>
);

/* -------------------------------------------------------------------------- */
/* shell                                                                       */
/* -------------------------------------------------------------------------- */

const Shell: FC<PropsWithChildren> = ({ children }) => (
  <ScrollView style={s.screen} contentContainerStyle={s.screenContent}>
    <View style={s.nav}>
      <NavLink to={router.navigation.home()} label='home' />
      <Button label='back' onPress={() => go(-1)} />
    </View>
    {children}
  </ScrollView>
);

const RouterView = createRouterView([
  [
    Shell,
    [
      [router.routes.home, Home],
      [router.routes.product, Product],
      [router.routes.settings, Settings],
      [router.routes[NOT_FOUND], NotFound],
    ],
  ],
]);

/**
 * The one thing that has no web counterpart: until `Linking.getInitialURL()`
 * answers there is no location, so no route is matched and the router view
 * renders nothing at all. Anything reading params from *outside* the view - a
 * header, a global currency picker - has to wait for the same moment, and
 * `$routerReady` is it. On the web it is `true` before the first render.
 */
const Ready: FC<PropsWithChildren> = ({ children }) => {
  const isReady = useValue(selectReady($routerReady));

  return isReady ? (
    <>{children}</>
  ) : (
    <View style={s.gate}>
      <Text style={s.note}>waiting for the launch url...</Text>
    </View>
  );
};

const App: FC = () => (
  <View style={s.app}>
    <Ready>
      <RouterView />
    </Ready>
  </View>
);

export default App;

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#f5f5f7', paddingTop: 64 },
  gate: { padding: 16 },
  screen: { flex: 1 },
  screenContent: { padding: 16, gap: 12, paddingBottom: 64 },
  nav: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  note: { fontSize: 12, color: '#6b6b70', lineHeight: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 13, color: '#6b6b70' },
  value: { fontSize: 13, fontVariant: ['tabular-nums'] },
  link: { paddingVertical: 6 },
  linkActive: {},
  linkText: { fontSize: 15, color: '#1749b3' },
  linkTextActive: { fontWeight: '700' },
  href: { fontSize: 11, color: '#9a9aa0' },
  button: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d3d3d8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  buttonActive: { backgroundColor: '#1749b3', borderColor: '#1749b3' },
  buttonPressed: { opacity: 0.6 },
  buttonText: { fontSize: 14 },
  buttonTextActive: { color: '#fff' },
  tabs: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d3d3d8',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#b3261e' },
  error: { fontSize: 12, color: '#b3261e', paddingTop: 4 },
  saved: { fontSize: 13, color: '#146c2e' },
});
