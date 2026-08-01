/**
 * A stand-in backend, so the examples run with no server. Nothing here is
 * library-specific - it just behaves like a real API: it takes time, it can
 * fail, and its search returns partial results before it is finished.
 */

export type Seniority = 'junior' | 'mid' | 'senior';

export type Listing = {
  id: number;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  seniority: Seniority;
  salaryFrom: number;
  salaryTo: number;
  postedDaysAgo: number;
  tags: string[];
};

export type ListingDetails = Listing & {
  summary: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  companyProfile: { size: string; founded: number; industry: string };
};

const COMPANIES = [
  ['Northwind Logistics', 'Freight & warehousing', '1400 people', 1998],
  ['Kestrel Analytics', 'Data platforms', '210 people', 2014],
  ['Bluecap Health', 'Clinical software', '640 people', 2009],
  ['Torrent Payments', 'Payments infrastructure', '95 people', 2019],
  ['Meridian Grid', 'Energy monitoring', '320 people', 2011],
] as const;

const CITIES = [
  'Berlin, DE',
  'Lisbon, PT',
  'Kraków, PL',
  'Dublin, IE',
  'Rotterdam, NL',
  'Tallinn, EE',
];

const ROLES = [
  'Backend Engineer',
  'Frontend Engineer',
  'Platform Engineer',
  'Data Engineer',
  'QA Engineer',
  'Site Reliability Engineer',
  'Mobile Engineer',
  'Security Engineer',
];

const TAG_POOL = [
  'typescript',
  'go',
  'kubernetes',
  'postgres',
  'react',
  'python',
  'terraform',
  'kafka',
];

const SENIORITIES: Seniority[] = ['junior', 'mid', 'senior'];

/** Deterministic so the examples look the same on every reload. */
const pick = <T>(items: readonly T[], seed: number) =>
  items[seed % items.length];

const LISTINGS: Listing[] = Array.from({ length: 84 }, (_, i) => {
  const [company] = COMPANIES[i % COMPANIES.length];
  const seniority = pick(SENIORITIES, i * 7);
  const base = 48000 + (SENIORITIES.indexOf(seniority) + 1) * 17000;

  return {
    id: 1000 + i,
    title: `${seniority === 'senior' ? 'Senior ' : seniority === 'junior' ? 'Junior ' : ''}${pick(ROLES, i * 3)}`,
    company,
    location: pick(CITIES, i * 5),
    remote: i % 3 === 0,
    seniority,
    salaryFrom: base + (i % 4) * 1000,
    salaryTo: base + 22000 + (i % 6) * 1500,
    postedDaysAgo: i % 30,
    tags: [pick(TAG_POOL, i), pick(TAG_POOL, i * 11), pick(TAG_POOL, i * 5)]
      .filter((tag, index, all) => all.indexOf(tag) === index)
      .slice(0, 2),
  };
});

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

let failNextDetails = false;

/** Lets the error example produce a real rejection on demand. */
export const failNextDetailsRequest = () => {
  failNextDetails = true;
};

export const fetchListing = async (id: number): Promise<ListingDetails> => {
  await sleep(500);

  if (failNextDetails) {
    failNextDetails = false;

    throw new Error(`Listing ${id} could not be loaded`);
  }

  const listing = LISTINGS.find((item) => item.id === id);

  if (!listing) {
    throw new Error(`No listing with id ${id}`);
  }

  const [, industry, size, founded] = COMPANIES.find(
    ([name]) => name === listing.company
  )!;

  return {
    ...listing,
    summary: `${listing.company} is hiring a ${listing.title.toLowerCase()} for its ${industry.toLowerCase()} group. You will own a service end to end, from schema design through to what happens at 3am.`,
    responsibilities: [
      'Own one or more production services, including their on-call rotation.',
      'Review changes from three other engineers on the team.',
      'Break down a quarter of roadmap work into shippable increments.',
      'Keep the runbooks current - you will be the one paged against them.',
      'Sit in on incident reviews and turn findings into scheduled work.',
      'Mentor whoever joins the team after you.',
    ],
    requirements: [
      `${listing.seniority === 'junior' ? '1+' : listing.seniority === 'mid' ? '3+' : '6+'} years building web services`,
      `Working knowledge of ${listing.tags.join(' and ')}`,
      'Comfortable reading code you did not write',
      'Able to reason about a request that crosses four services',
      'Have shipped something that had to be rolled back, and know why',
      'Written a postmortem someone outside the team could follow',
    ],
    benefits: [
      listing.remote
        ? 'Remote-first, with quarterly onsites'
        : 'Hybrid, 2 days in office',
      '30 days annual leave',
      'Learning budget of 1500 per year',
      'Equipment budget, refreshed every three years',
      'Paid conference attendance, one per year',
      'Four weeks of paid leave between roles if you stay two years',
    ],
    companyProfile: { size, founded, industry },
  };
};

/** The company profile arrives separately - two registries, one page. */
export const fetchCompany = async (name: string) => {
  await sleep(900);

  const found = COMPANIES.find(([company]) => company === name);

  if (!found) {
    throw new Error(`No company named ${name}`);
  }

  const [, industry, size, founded] = found;

  return {
    name,
    industry,
    size,
    founded,
    openRoles: LISTINGS.filter((listing) => listing.company === name).length,
  };
};

export type SearchQuery = {
  text: string;
  remoteOnly: boolean;
  seniority: Seniority | undefined;
};

export type SearchPage = {
  items: Listing[];
  total: number;
  /** False while the backend is still widening the search. */
  isFinished: boolean;
};

export const PAGE_SIZE = 8;

/**
 * Two-stage search, like a real aggregator: the first response is a partial
 * match set flagged unfinished, and a later poll for the same query returns
 * the complete one. `isLoaded` in the poll options is what stops the polling.
 */
const searchRounds = new Map<string, number>();

export const searchListings = async (
  query: SearchQuery,
  page: number
): Promise<SearchPage> => {
  await sleep(400);

  const text = query.text.trim().toLowerCase();

  let matched = LISTINGS.filter(
    (listing) =>
      (!query.remoteOnly || listing.remote) &&
      (!query.seniority || listing.seniority === query.seniority) &&
      (!text ||
        listing.title.toLowerCase().includes(text) ||
        listing.company.toLowerCase().includes(text) ||
        listing.tags.some((tag) => tag.includes(text)))
  );

  const key = JSON.stringify(query);

  const round = (searchRounds.get(key) || 0) + 1;

  searchRounds.set(key, round);

  const isFinished = round > 1;

  // round one only sees the partner feed that answered first
  if (!isFinished) {
    matched = matched.filter((_, index) => index % 2 === 0);
  }

  return {
    items: matched.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    total: matched.length,
    isFinished,
  };
};

/** So re-running a query in the search example starts from a partial set again. */
export const resetSearchRounds = () => {
  searchRounds.clear();
};

export const allListings = () => LISTINGS;
