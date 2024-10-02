import { FC, PropsWithChildren } from 'react';
import SkeletonContext from '../utils/SkeletonContext';

type Props = {
  disabled?: boolean;
};

const SkeletonMode: FC<PropsWithChildren<Props>> = ({ disabled, children }) => (
  <SkeletonContext.Provider value={!disabled}>
    {children}
  </SkeletonContext.Provider>
);

export default SkeletonMode;
