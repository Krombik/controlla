import type { AsyncControl, Control } from '#types';
import handlePath from '#router/internal/handlePath';
import type {
  CreatePath,
  Path,
  PathParam,
  QueryParam,
  RouteData,
  RouterContext,
} from '#router/internal/types';
import createDerivedControl from '#core/createDerivedControl';
import type { PrimitiveControlInternals } from '#internal/types';
import { EMPTY_OBJECT } from '#router/internal/constants';

const makeControl = (
  routerContext: RouterContext,
  isMatchedRoot: PrimitiveControlInternals,
  source: Control,
  routeData: RouteData
) =>
  createDerivedControl(source, (value) => {
    if (isMatchedRoot._value) {
      const params = {};

      let replaced = false;

      if (
        routeData._extractPathParams(
          params,
          EMPTY_OBJECT,
          routerContext._path,
          value
        )
      ) {
        replaced = true;
      }

      if (
        routeData._extractQueryParams(
          params,
          EMPTY_OBJECT,
          routerContext._query,
          value
        )
      ) {
        replaced = true;
      }

      if (replaced) {
        const routes = routerContext._routesQueue[routerContext._currentIndex];

        let path = '';

        let search = '';

        routeData._currentSearch = routeData._handleSearch(
          params,
          EMPTY_OBJECT
        );

        routeData._currentPath = routeData._handlePath(params, EMPTY_OBJECT);

        for (let i = 0; i < routes.length; i++) {
          const route = routes[i];

          const currentSearch = route._currentSearch;

          path += route._currentPath;

          if (currentSearch) {
            if (search) {
              search += '&' + currentSearch;
            } else {
              search = '?' + currentSearch;
            }
          }
        }

        history.replaceState(
          history.state,
          '',
          (path || '/') + search + location.hash
        );
      }

      return params;
    }
  });

const createAsyncPath: {
  <S>(source: AsyncControl<S>): CreatePath<S>;
} =
  (source: AsyncControl) =>
  (
    ...path: Array<
      | string
      | PathParam<Record<string, any>>
      | Record<string, Path>
      | QueryParam<Record<string, any>>
    >
  ): any =>
    handlePath(path, makeControl, source);

export default createAsyncPath;
