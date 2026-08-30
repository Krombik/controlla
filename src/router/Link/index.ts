import type { LinkComponent, LinkProps } from '~platform/link';

import useLink from '#router/useLink';

export type * from '~platform/link';

const Link = ((props: LinkProps) =>
  props.render(useLink(props as any))) as LinkComponent;

export default Link;
