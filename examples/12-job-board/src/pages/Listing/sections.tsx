/**
 * Each section loads, skeletons and fails on its own.
 *
 * Two things make that cheap. First, every section reads a *path* of the bound
 * control - `$listing.requirements`, not `$listing` - so it re-renders only when
 * its own slice changes. Second, `SuspenseControlConsumer` brings its own
 * boundary, so a slow section shows a skeleton in place instead of blanking its
 * neighbours.
 *
 * The `Company` section reads a different registry that starts loading later,
 * which is why it is still skeletoned after the rest of the page has arrived.
 *
 * The controls come from the page's bag - `useListing()` - so nothing here
 * imports a module-level control and nothing has to be passed down.
 */

import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import CombinedControlsConsumer from 'controlla/core/CombinedControlsConsumer';
import selectReady from 'controlla/core/selectReady';
import selectLoading from 'controlla/core/selectLoading';
import registerAnchor from 'controlla/router/registerAnchor';
import type { FC, PropsWithChildren, ReactNode } from 'react';

import { router, type ListingSection } from '#router';
import { useListing } from '#pages/Listing/controls';

const Skeleton: FC<{ width: string }> = ({ width }) => (
  <span className='skeleton' style={{ width }} />
);

const Lines: FC<{ count: number }> = ({ count }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <p key={i} style={{ margin: '0 0 .4rem' }}>
        <Skeleton width={`${28 + (i % 3) * 8}ch`} />
      </p>
    ))}
  </>
);

/**
 * `registerAnchor(route, id)` is what makes an element the scroll target for
 * that id, and what puts the id into `selectRegisteredAnchors`. Spreading it is
 * the whole integration - the ref it returns is cached, so calling it during
 * render is fine.
 */
const Section: FC<
  PropsWithChildren<{ id: ListingSection; title: ReactNode }>
> = ({ id, title, children }) => (
  <section className='card' {...registerAnchor(router.routes.listing, id)}>
    <h2>{title}</h2>
    {children}
  </section>
);

const Bullets: FC<{ items: string[] }> = ({ items }) => (
  <ul style={{ margin: '.5rem 0 0', paddingLeft: '1.2rem' }}>
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

export const Summary: FC = () => {
  const { $listing } = useListing();

  return (
    <Section
      id='summary'
      title={
        // the heading waits only on "is there a value at all", so it settles one
        // step before the body does
        <SuspenseControlConsumer
          control={selectReady($listing)}
          fallback={<Skeleton width='16ch' />}
        >
          Summary
        </SuspenseControlConsumer>
      }
    >
      <SuspenseControlConsumer
        control={$listing.summary}
        fallback={<Lines count={2} />}
        render={(summary) => <p style={{ margin: 0 }}>{summary}</p>}
      />
    </Section>
  );
};

export const Responsibilities: FC = () => (
  <Section id='responsibilities' title='Responsibilities'>
    <SuspenseControlConsumer
      control={useListing().$listing.responsibilities}
      fallback={<Lines count={3} />}
      render={(items) => <Bullets items={items} />}
    />
  </Section>
);

export const Requirements: FC = () => (
  <Section id='requirements' title='Requirements'>
    <SuspenseControlConsumer
      control={useListing().$listing.requirements}
      fallback={<Lines count={3} />}
      render={(items) => <Bullets items={items} />}
    />
  </Section>
);

/**
 * A section that hides itself when there is nothing to show, but not while it
 * is still loading - otherwise it would pop in and out. `CombinedControlsConsumer`
 * folds "loading or non-empty" into one boolean and re-renders only when that
 * boolean flips.
 */
export const Benefits: FC = () => {
  const { $listing } = useListing();

  return (
    <CombinedControlsConsumer
      controls={[$listing.benefits, selectLoading($listing)]}
      combiner={(benefits, isLoading) => isLoading || !!benefits?.length}
      render={(isWorthShowing) =>
        isWorthShowing && (
          <Section id='benefits' title='Benefits'>
            <SuspenseControlConsumer
              control={$listing.benefits}
              fallback={<Lines count={3} />}
              render={(items) => <Bullets items={items} />}
            />
          </Section>
        )
      }
    />
  );
};

export const Company: FC = () => (
  <Section id='company' title='Company'>
    <SuspenseControlConsumer
      control={useListing().$company}
      fallback={<Lines count={2} />}
      renderIfError={(error: Error) => <p className='error'>{error.message}</p>}
      render={(company) => (
        <>
          <p style={{ margin: 0 }}>
            {company.industry} - {company.size} - founded {company.founded}
          </p>
          <p style={{ margin: '.4rem 0 0', color: 'var(--muted)' }}>
            {company.openRoles} open roles
          </p>
        </>
      )}
    />
  </Section>
);
