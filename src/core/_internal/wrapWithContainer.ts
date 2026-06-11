import type { ReactNode } from 'react';
import type { ContainerComponent } from '#internal/types';
import { jsx } from 'react/jsx-runtime';

const wrapWithContainer = (
  Container: ContainerComponent | undefined,
  children: ReactNode
) =>
  Container && (children || children === 0)
    ? jsx(Container, { children })
    : children;

export default wrapWithContainer;
