import type { FC } from 'react';

import NavLink from '#components/NavLink';
import { router } from '#router';

const NotFound: FC = () => (
  <>
    <h1>Nothing here</h1>
    <p className='lede'>
      <code className='mono'>withNotFound</code> adds this catch-all under the{' '}
      <code className='mono'>NOT_FOUND</code> symbol, so the router always has a
      page to show.
    </p>
    <NavLink to={router.navigation.home()}>Back to the start</NavLink>
  </>
);

export default NotFound;
