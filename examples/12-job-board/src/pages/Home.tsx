import type { FC } from 'react';

const Home: FC = () => (
  <>
    <h1>controlla examples</h1>
    <p className='lede'>
      A small job board. Each page in the sidebar is one self-contained example
      - read its file top to bottom and it makes sense on its own.
    </p>

    <div className='card'>
      <h2>Each example imports only what it uses</h2>
      <p>
        Every import below is a separate subpath, so a page that never touches
        the router or the loaders does not pull them in. Open any example's
        source and the import list is the whole story of which parts of the
        library it depends on - there is no setup, no provider and no root store
        to opt into.
      </p>
      <p className='mono'>src/pages/*.tsx</p>
    </div>

    <div className='card'>
      <h2>Where the state lives</h2>
      <p>
        Controls are module-level values, not React state. The URL-backed ones
        are declared once in <span className='mono'>src/router.ts</span>; the
        server-backed ones in <span className='mono'>src/controls/</span>. The
        pages only read and write them.
      </p>
      <p>
        <span className='mono'>src/api.ts</span> is a stand-in backend - it
        sleeps, it can fail, and its search returns a partial result set before
        it finishes, which is what makes the polling example worth looking at.
      </p>
    </div>
  </>
);

export default Home;
