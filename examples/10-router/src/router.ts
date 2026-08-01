/**
 * Every URL the app has, declared once.
 *
 * This is a typed tree, not a list of strings. Each dynamic piece - a path param,
 * a query param - becomes a control, and `parse`/`stringify` decide its type, so
 * downstream code gets a `number` or a `Date` rather than a string it has to
 * validate again.
 *
 * Because the shape is known ahead of time, `router.navigation.*` can only build
 * URLs that exist, with params of the right type. A typo is a type error, not a
 * 404 in production.
 */

import createRouter from 'controlla/router/createRouter';
import createPath from 'controlla/router/createPath';
import param from 'controlla/router/param';
import query from 'controlla/router/query';
import oneOf from 'controlla/router/oneOf';
import withNotFound from 'controlla/router/withNotFound';

export const router = createRouter(
  // adds a catch-all under the NOT_FOUND symbol, so there is always a page
  withNotFound({
    home: createPath(),

    /** `/invoices?status=open&page=2` */
    invoices: createPath(
      'invoices',
      query({
        status: {
          optional: true,
          defaultValue: 'all' as InvoiceStatus,
          parse: (raw: string) => raw as InvoiceStatus,
          isValid: (value: InvoiceStatus) => STATUSES.includes(value),
          stringify: (value: InvoiceStatus) => (value === 'all' ? '' : value),
        },
        page: {
          optional: true,
          defaultValue: 1,
          parse: Number,
          // junk like ?page=abc falls back instead of failing the match
          isValid: (value: number) => Number.isInteger(value) && value > 0,
          fallbackValue: 1,
          stringify: String,
        },
      })
    ),

    /**
     * `/invoices/2024-0031/lines`. Nested paths are just a children record, and
     * the child inherits the parent's segments and params.
     */
    invoice: createPath('invoices', param({ number: false }), {
      lines: createPath('lines'),
      /** `oneOf` restricts the segment and types it as the union of variants. */
      history: createPath(
        'history',
        oneOf({
          view: {
            variants: ['timeline', 'audit'],
            optional: true,
            defaultValue: 'timeline',
          },
        })
      ),
    }),

    /** A page you should not be able to leave with unsaved edits. */
    newInvoice: createPath('invoices', 'new'),
  })
);

export type InvoiceStatus = 'all' | 'open' | 'paid' | 'overdue';

const STATUSES: InvoiceStatus[] = ['all', 'open', 'paid', 'overdue'];
