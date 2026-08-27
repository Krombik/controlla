/**
 * The URL is the state.
 *
 * There is no local filter state here and nothing syncing it to the address bar.
 * `selectParams(router.routes.search)` gives a control per query param, so the
 * text input is bound to `?text=`, the checkbox to `?remote=`, and reloading or
 * sharing the URL restores the exact search. Back and forward step through
 * searches because each write is a history entry.
 *
 * The results come from a poll, because the stand-in backend answers with a
 * partial match set first - see `#controls/listings`.
 */

import replaceValue from 'controlla/router/replaceValue';
import setValue from 'controlla/core/setValue';
import useValue from 'controlla/core/useValue';
import createDebounceScheduler from 'controlla/scheduler/createDebounceScheduler';
import type { FC } from 'react';

import type { Seniority } from '#api';
import { $params } from '#pages/Search/controls';
import Results from '#pages/Search/Results';

/**
 * Typing should not push a history entry per keystroke, and it should not fire a
 * request per keystroke either. One scheduler solves both: the commit itself is
 * delayed until 400ms of quiet, so the URL, the derived query and the fetch all
 * happen once.
 */
const typing = createDebounceScheduler(400);

const SENIORITIES: Seniority[] = ['junior', 'mid', 'senior'];

const TextFilter: FC = () => (
  <label>
    <span>Title, company or tag</span>
    <input
      value={useValue($params.text)}
      placeholder='try: go, kafka, platform'
      onChange={(e) => {
        // replaceValue so typing does not fill the back button, and the
        // debounce scheduler so it commits once the user stops
        replaceValue($params.text, e.target.value, typing);

        // a new search starts at page one
        replaceValue($params.page, 0, typing);
      }}
    />
  </label>
);

const RemoteFilter: FC = () => (
  <label className='row'>
    <input
      type='checkbox'
      checked={useValue($params.remote)}
      onChange={(e) => {
        setValue($params.remote, e.target.checked);

        setValue($params.page, 0);
      }}
    />
    <span style={{ margin: 0 }}>Remote only</span>
  </label>
);

const SeniorityFilter: FC = () => {
  const seniority = useValue($params.seniority);

  return (
    <label>
      <span>Seniority</span>
      <select
        value={seniority ?? ''}
        onChange={(e) => {
          setValue(
            $params.seniority,
            (e.target.value || undefined) as Seniority | undefined
          );

          setValue($params.page, 0);
        }}
      >
        <option value=''>any</option>
        {SENIORITIES.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
    </label>
  );
};

const Search: FC = () => (
  <>
    <h1>Search</h1>
    <p className='lede'>
      Every filter below is a query param. Watch the address bar, then reload -
      nothing is lost, because nothing was stored in the component.
    </p>

    <div className='card'>
      <TextFilter />
      <div className='row'>
        <SeniorityFilter />
        <RemoteFilter />
      </div>
    </div>

    <Results />
  </>
);

export default Search;
