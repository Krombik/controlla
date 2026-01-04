import type { ReactNode } from 'react';
import type { ContainerType } from '#_types';
import { jsx } from 'react/jsx-runtime';

const handleContainerChildren = (
  Container: ContainerType | undefined,
  children: ReactNode
) =>
  Container && (children || children === 0)
    ? jsx(Container, { children })
    : children;

export default handleContainerChildren;
