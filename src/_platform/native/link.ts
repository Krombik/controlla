import type { ReactNode } from 'react';

import type { NavigationTarget } from '#router/types';

export type LinkOptions = {
  /** The navigation target. */
  to: NavigationTarget<true>;
  /** Runs before the navigation. */
  onPress?(): void;
  /**
   * Computes {@link LinkHandle.isMatched isMatched}, subscribing to changes:
   * `true` whether the target route is matched; `'exact'` whether it's
   * matched with exactly the params this link navigates to. Read once -
   * whether a link tracks isn't something that can change.
   */
  trackMatch?: boolean | 'exact';
  /** Bypasses an enabled `navigationBlocker`. */
  ignoreBlock?: boolean;
};

export type LinkHandle = {
  /** The current href of the target route. */
  href: string;
  /** Press handler performing the navigation. */
  onPress(): void;
  /**
   * Whether the target route is currently matched (exactly, with
   * {@link LinkOptions.trackMatch trackMatch}: `'exact'`); always `false` when {@link LinkOptions.trackMatch trackMatch} isn't set.
   */
  isMatched: boolean;
};

export type UseLink = {
  /**
   * Headless link primitive: subscribes to the target route's state and
   * returns everything needed to render a pressable: use it to build your own
   * `Link`.
   *
   * @example
   * ```tsx
   * const { href, onPress, isMatched } = useLink({ to: navigationRoot.home() });
   *
   * return <Pressable onPress={onPress}><Text>{href}</Text></Pressable>;
   * ```
   */
  (options: LinkOptions): LinkHandle;
};

export type LinkProps = LinkOptions & {
  /** Renders the pressable from the current link state. */
  render(props: LinkHandle): ReactNode;
};

export type LinkComponent = {
  /**
   * Render-prop link: subscribes to the target route and hands `href`,
   * `onPress` and `isMatched` to {@link LinkProps.render render}: a thin
   * wrapper over the `useLink` hook. `isMatched` is computed (and subscribed)
   * only with the `trackMatch` option.
   *
   * @example
   * ```tsx
   * <Link
   *   to={navigationRoot.home()}
   *   trackMatch
   *   render={({ href, onPress, isMatched }) => (
   *     <Pressable onPress={onPress}>
   *       <Text style={isMatched ? styles.active : undefined}>Home</Text>
   *     </Pressable>
   *   )}
   * />
   * ```
   */
  (props: LinkProps): ReactNode;
};
