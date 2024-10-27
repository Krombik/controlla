import { ReactNode } from 'react';
import { ContainerType } from '../types';

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
