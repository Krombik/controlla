/**
 * The whole URL surface of the app, in one place. Every dynamic piece named
 * here - path params, query params, the listing page's hash - becomes a control
 * that reads and writes like any other, so no example below ever parses a URL
 * or pushes history by hand.
 *
 * This file is also why the examples are routes rather than tabs: it lets each
 * one own real URL state you can reload and share.
 */

import createRouter from 'controlla/router/createRouter';
import createPath from 'controlla/router/createPath';
import param from 'controlla/router/param';
import query from 'controlla/router/query';
import oneOf from 'controlla/router/oneOf';
import anchor from 'controlla/router/anchor';
import trackScroll from 'controlla/router/trackScroll';
import withNotFound from 'controlla/router/withNotFound';

import type { Seniority } from '#api';

const SENIORITIES: Seniority[] = ['junior', 'mid', 'senior'];

/** The ids the listing page registers sections under. */
export type ListingSection =
  'summary' | 'responsibilities' | 'requirements' | 'benefits' | 'company';

export const router = createRouter(
  withNotFound({
    home: createPath(),

    formState: createPath('form-state'),

    registry: createPath('registry'),

    /**
     * `/listing/1003#requirements`. `parse`/`stringify` make the param a
     * number instead of a string everywhere downstream, and `trackScroll`
     * keeps the section nav in sync with what is actually on screen.
     */
    listing: createPath(
      'listing',
      param({ id: { parse: Number, stringify: String } }),
      trackScroll(
        anchor<ListingSection>((header) => ({
          behavior: 'smooth',
          topOffset: (header ? header.offsetHeight : 0) + 12,
        }))
      )
    ),

    /**
     * `/search?text=go&remote=1&seniority=senior&page=2`. Optional params with
     * a `defaultValue` always have a value in the control, so the filter UI
     * never deals with `undefined`.
     */
    search: createPath(
      'search',
      query({
        // `as string` keeps the param typed `string`: an unannotated `''`
        // default narrows the whole param to the literal `''`
        text: { optional: true, defaultValue: '' as string },
        remote: {
          optional: true,
          defaultValue: false,
          // annotate the return: an unannotated `raw === '1'` infers a type
          // predicate, which then clashes with `stringify`'s parameter
          parse: (raw: string): boolean => raw === '1',
          stringify: (value) => (value ? '1' : ''),
        },
        /** A junk `?page=abc` falls back to 0 instead of failing the match. */
        page: {
          optional: true,
          defaultValue: 0,
          parse: Number,
          isValid: (value: number) => Number.isInteger(value) && value >= 0,
          fallbackValue: 0,
          stringify: String,
        },
        seniority: {
          optional: true,
          parse: (raw: string) => raw as Seniority,
          isValid: (value: Seniority) => SENIORITIES.includes(value),
          stringify: (value: Seniority) => value,
        },
      })
    ),

    /** `oneOf` restricts the segment to the variants and types it as their union. */
    saved: createPath(
      'saved',
      oneOf({
        sort: {
          optional: true,
          variants: ['recent', 'salary', 'title'],
          defaultValue: 'recent',
        },
      })
    ),
  })
);
