import type { ReactNode } from 'react';
import type { ContainerType } from '../types';

const handleContainerChildren = (
  Container: ContainerType | undefined,
  children: ReactNode
) =>
  Container && (children || children === 0) ? (
    <Container>{children}</Container>
  ) : (
    children
  );

export default handleContainerChildren;
