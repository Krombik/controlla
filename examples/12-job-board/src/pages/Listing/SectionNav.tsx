/**
 * The section nav, driven entirely by the anchor control.
 *
 * `selectRegisteredAnchors` is a control of which section ids are currently
 * mounted - `true` for mounted, `'active'` for the one on screen (that upgrade
 * comes from `trackScroll` in the route declaration), `undefined` for sections
 * that are not in the DOM. So this nav can only ever offer links that go
 * somewhere, and it highlights as the user scrolls without any scroll listener
 * of its own.
 *
 * Writing to the anchor control scrolls to the section and puts it in the URL,
 * so the position is shareable. `replaceValue` instead of `setValue` keeps
 * scrolling around the page out of the back button's history.
 */

import selectRegisteredAnchors from 'controlla/router/selectRegisteredAnchors';
import registerAnchorOffset from 'controlla/router/registerAnchorOffset';
import replaceValue from 'controlla/router/replaceValue';
import selectAnchor from 'controlla/router/selectAnchor';
import ControlsConsumer from 'controlla/core/ControlsConsumer';
import type { FC } from 'react';

import { router, type ListingSection } from '#router';

const LABELS: Record<ListingSection, string> = {
  summary: 'Summary',
  responsibilities: 'Responsibilities',
  requirements: 'Requirements',
  benefits: 'Benefits',
  company: 'Company',
};

const IDS = Object.keys(LABELS) as ListingSection[];

const $registered = selectRegisteredAnchors(router.routes.listing);

const $anchor = selectAnchor(router.routes.listing);

const SectionNav: FC = () => (
  // a bare ref, unlike registerAnchor's spreadable {id, ref}: it tells the
  // scroll maths to land below this sticky bar
  <nav
    className='section-nav'
    ref={registerAnchorOffset(router.routes.listing)}
  >
    <ControlsConsumer
      controls={IDS.map((id) => $registered[id])}
      render={(...states) => (
        <>
          {IDS.map((id, index) => {
            const state = states[index];

            return (
              state && (
                <button
                  key={id}
                  data-state={state}
                  onClick={() => replaceValue($anchor, id)}
                >
                  {LABELS[id]}
                </button>
              )
            );
          })}
        </>
      )}
    />
  </nav>
);

export default SectionNav;
