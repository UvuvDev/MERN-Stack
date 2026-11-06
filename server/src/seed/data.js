const DAY_MS = 24 * 60 * 60 * 1000;

export const SAMPLE_CONGRESS = 119;

export const offices = [
  {
    slug: 'us-senate-ga',
    name: 'U.S. Senate — Georgia',
    level: 'federal',
    state: 'GA',
    district: null,
    description:
      'One of Georgia’s two seats in the United States Senate. Senators serve six-year terms and vote on federal legislation, treaties, and nominations.',
  },
  {
    slug: 'us-house-ga-5',
    name: 'U.S. House — Georgia District 5',
    level: 'federal',
    state: 'GA',
    district: '5',
    description:
      'Georgia’s 5th congressional district seat in the U.S. House of Representatives. Representatives serve two-year terms and vote on federal legislation.',
  },
  {
    slug: 'atlanta-mayor',
    name: 'Mayor of Atlanta',
    level: 'local',
    state: 'GA',
    district: null,
    description:
      'Chief executive of the City of Atlanta. The mayor oversees city services and works with the Atlanta City Council on local ordinances and budgets.',
  },
];

export const candidates = [
  {
    slug: 'mara-voss',
    name: 'Mara Voss',
    party: 'Democratic',
    officeSlug: 'us-senate-ga',
    state: 'GA',
    district: null,
    photoUrl: '',
    officialUrl: 'https://www.example.gov/georgia/senate/mara-voss',
    bio: 'Fictional candidate created for this class project. Former state budget analyst focused on fiscal transparency, public education, and rural services.',
    isSample: true,
  },
  {
    slug: 'dorian-kaye',
    name: 'Dorian Kaye',
    party: 'Republican',
    officeSlug: 'us-senate-ga',
    state: 'GA',
    district: null,
    photoUrl: '',
    officialUrl: 'https://www.example.gov/georgia/senate/dorian-kaye',
    bio: 'Fictional candidate created for this class project. Small-business owner and former county commissioner with an interest in tax administration and defense policy.',
    isSample: true,
  },
  {
    slug: 'ilya-brants',
    name: 'Ilya Brants',
    party: 'Independent',
    officeSlug: 'us-senate-ga',
    state: 'GA',
    district: null,
    photoUrl: '',
    officialUrl: 'https://www.example.gov/georgia/senate/ilya-brants',
    bio: 'Fictional candidate created for this class project. Civil engineer and municipal planning consultant focused on infrastructure and privacy safeguards.',
    isSample: true,
  },
  {
    slug: 'nia-calloway',
    name: 'Nia Calloway',
    party: 'Democratic',
    officeSlug: 'us-house-ga-5',
    state: 'GA',
    district: '5',
    photoUrl: '',
    officialUrl: 'https://www.example.gov/georgia/house/nia-calloway',
    bio: 'Fictional candidate created for this class project. Public-health administrator and former city council policy aide focused on clinics, housing, and workforce programs.',
    isSample: true,
  },
  {
    slug: 'grant-hollis',
    name: 'Grant Hollis',
    party: 'Republican',
    officeSlug: 'us-house-ga-5',
    state: 'GA',
    district: '5',
    photoUrl: '',
    officialUrl: 'https://www.example.gov/georgia/house/grant-hollis',
    bio: 'Fictional candidate created for this class project. Logistics executive and former school board member focused on procurement, border processing, and small-business rules.',
    isSample: true,
  },
  {
    slug: 'teresa-marlowe',
    name: 'Teresa Marlowe',
    party: 'Green',
    officeSlug: 'atlanta-mayor',
    state: 'GA',
    district: null,
    photoUrl: '',
    officialUrl: 'https://www.example.gov/georgia/atlanta/teresa-marlowe',
    bio: 'Fictional candidate created for this class project. Urban planner and neighborhood association volunteer focused on transit, housing, and energy efficiency.',
    isSample: true,
  },
  {
    slug: 'ross-bellamy',
    name: 'Ross Bellamy',
    party: 'Independent',
    officeSlug: 'atlanta-mayor',
    state: 'GA',
    district: null,
    photoUrl: '',
    officialUrl: 'https://www.example.gov/georgia/atlanta/ross-bellamy',
    bio: 'Fictional candidate created for this class project. Retired city auditor and community bank adviser focused on infrastructure maintenance and open data.',
    isSample: true,
  },
];

export const bills = [
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'house',
    number: 'H.R. 9001',
    title: 'Small Business Tax Simplification Act',
    summary:
      'Consolidates several small-business tax filings into a single annual form and raises the gross-receipts threshold for simplified accounting. The bill does not change individual income tax rates.',
    topics: ['taxes'],
    introducedAt: new Date('2025-02-11T00:00:00.000Z'),
    sponsor: 'Rep. Alan Veer',
    sourceUrl: 'https://www.example.gov/bills/119/h-r-9001',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'house',
    number: 'H.R. 9002',
    title: 'Workplace Scheduling Transparency Act',
    summary:
      'Requires employers with more than 100 employees to publish shift schedules fourteen days in advance and to offer available hours to existing part-time staff before hiring. It creates an exception for emergency operations.',
    topics: ['labor'],
    introducedAt: new Date('2025-03-04T00:00:00.000Z'),
    sponsor: 'Rep. Priya Sandoval',
    sourceUrl: 'https://www.example.gov/bills/119/h-r-9002',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'house',
    number: 'H.R. 9003',
    title: 'Rural Broadband Expansion Act',
    summary:
      'Provides matching grants for broadband construction in census blocks without reliable service and requires recipients to offer a low-cost plan. Funding is distributed through state infrastructure agencies over five years.',
    topics: ['infrastructure'],
    introducedAt: new Date('2025-03-18T00:00:00.000Z'),
    sponsor: 'Rep. Marcus Dole',
    sourceUrl: 'https://www.example.gov/bills/119/h-r-9003',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'house',
    number: 'H.R. 9004',
    title: 'Veterans Housing Support Act',
    summary:
      'Expands rental assistance and home-repair grants for veterans and authorizes additional caseworkers at regional housing offices. The bill requires an annual report on wait times and program spending.',
    topics: ['housing', 'defense'],
    introducedAt: new Date('2025-04-02T00:00:00.000Z'),
    sponsor: 'Rep. Elena Frye',
    sourceUrl: 'https://www.example.gov/bills/119/h-r-9004',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'house',
    number: 'H.R. 9005',
    title: 'Student Loan Disclosure Act',
    summary:
      'Requires colleges to provide a standardized annual statement showing estimated debt, monthly payments, and completion rates by program. It does not change loan eligibility or interest rates.',
    topics: ['education'],
    introducedAt: new Date('2025-04-22T00:00:00.000Z'),
    sponsor: 'Rep. Jonah Pike',
    sourceUrl: 'https://www.example.gov/bills/119/h-r-9005',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'house',
    number: 'H.R. 9006',
    title: 'Border Processing Modernization Act',
    summary:
      'Funds additional inspection equipment and processing space at designated ports of entry and requires a study of staffing models. The bill sets reporting requirements for wait times and equipment maintenance.',
    topics: ['immigration'],
    introducedAt: new Date('2025-05-06T00:00:00.000Z'),
    sponsor: 'Rep. Camille Orr',
    sourceUrl: 'https://www.example.gov/bills/119/h-r-9006',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'house',
    number: 'H.R. 9007',
    title: 'Community Health Clinic Funding Act',
    summary:
      'Extends operating grants for community health centers and creates a loan-repayment program for clinicians who serve in shortage areas. Grant recipients must report staffing and patient-visit data.',
    topics: ['healthcare'],
    introducedAt: new Date('2025-05-20T00:00:00.000Z'),
    sponsor: 'Rep. Devin Ash',
    sourceUrl: 'https://www.example.gov/bills/119/h-r-9007',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'senate',
    number: 'S. 9101',
    title: 'Clean Energy Grid Reliability Act',
    summary:
      'Creates matching grants for grid storage, transmission upgrades, and demand-response programs. The bill requires regional grid operators to publish reliability metrics and allows cost sharing with states.',
    topics: ['energy', 'infrastructure'],
    introducedAt: new Date('2025-06-10T00:00:00.000Z'),
    sponsor: 'Sen. Ruth Calder',
    sourceUrl: 'https://www.example.gov/bills/119/s-9101',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'senate',
    number: 'S. 9102',
    title: 'Prescription Price Reporting Act',
    summary:
      'Requires manufacturers of certain high-cost drugs to file quarterly reports on list prices, discounts, and price increases. The data would be published in aggregate form by the Department of Health and Human Services.',
    topics: ['healthcare'],
    introducedAt: new Date('2025-06-24T00:00:00.000Z'),
    sponsor: 'Sen. Thomas Wray',
    sourceUrl: 'https://www.example.gov/bills/119/s-9102',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'senate',
    number: 'S. 9103',
    title: 'Digital Privacy Baseline Act',
    summary:
      'Establishes national notice-and-consent requirements for consumer data collection and directs the Federal Trade Commission to publish model privacy notices. State attorneys general retain enforcement authority.',
    topics: ['civil-liberties'],
    introducedAt: new Date('2025-07-15T00:00:00.000Z'),
    sponsor: 'Sen. Ada Lin',
    sourceUrl: 'https://www.example.gov/bills/119/s-9103',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'senate',
    number: 'S. 9104',
    title: 'National Guard Readiness Act',
    summary:
      'Authorizes equipment maintenance and training funding for National Guard units and requires a review of deployment scheduling. The bill includes reporting on recruitment and retention trends.',
    topics: ['defense'],
    introducedAt: new Date('2025-09-09T00:00:00.000Z'),
    sponsor: 'Sen. Victor Hale',
    sourceUrl: 'https://www.example.gov/bills/119/s-9104',
    isSample: true,
  },
  {
    congress: SAMPLE_CONGRESS,
    chamber: 'senate',
    number: 'S. 9105',
    title: 'Apprenticeship Tax Credit Act',
    summary:
      'Creates a refundable tax credit for employers that sponsor registered apprenticeships in skilled trades and technical fields. The credit is capped per apprentice and requires annual program certification.',
    topics: ['labor', 'taxes', 'education'],
    introducedAt: new Date('2025-09-23T00:00:00.000Z'),
    sponsor: 'Sen. June Okafor',
    sourceUrl: 'https://www.example.gov/bills/119/s-9105',
    isSample: true,
  },
];

const voteOffsetDays = {
  'H.R. 9001': 46,
  'H.R. 9002': 39,
  'H.R. 9003': 52,
  'H.R. 9004': 61,
  'H.R. 9005': 44,
  'H.R. 9006': 70,
  'H.R. 9007': 35,
  'S. 9101': 58,
  'S. 9102': 63,
  'S. 9103': 41,
  'S. 9104': 76,
  'S. 9105': 49,
};

const noteByVote = {
  'dorian-kaye|S. 9102': 'Not present for the recorded vote.',
  'ilya-brants|S. 9104': 'Voted present.',
  'ilya-brants|H.R. 9005': 'Voted present; cited incomplete cost estimates.',
};

const positionPlan = {
  'mara-voss': {
    'H.R. 9002': 'yes',
    'H.R. 9003': 'yes',
    'H.R. 9005': 'yes',
    'H.R. 9007': 'yes',
    'S. 9101': 'yes',
    'S. 9102': 'yes',
    'S. 9103': 'yes',
    'S. 9104': 'no',
    'S. 9105': 'yes',
  },
  'dorian-kaye': {
    'H.R. 9001': 'yes',
    'H.R. 9003': 'yes',
    'H.R. 9004': 'yes',
    'H.R. 9006': 'yes',
    'S. 9101': 'no',
    'S. 9102': 'absent',
    'S. 9103': 'yes',
    'S. 9104': 'yes',
    'S. 9105': 'yes',
  },
  'ilya-brants': {
    'H.R. 9001': 'yes',
    'H.R. 9003': 'yes',
    'H.R. 9005': 'abstain',
    'H.R. 9006': 'yes',
    'S. 9101': 'yes',
    'S. 9102': 'yes',
    'S. 9103': 'yes',
    'S. 9104': 'abstain',
    'S. 9105': 'yes',
  },
  'nia-calloway': {
    'H.R. 9001': 'no',
    'H.R. 9002': 'yes',
    'H.R. 9003': 'yes',
    'H.R. 9004': 'yes',
    'H.R. 9005': 'yes',
    'H.R. 9006': 'no',
    'H.R. 9007': 'yes',
    'S. 9102': 'yes',
    'S. 9105': 'yes',
  },
  'grant-hollis': {
    'H.R. 9001': 'yes',
    'H.R. 9002': 'no',
    'H.R. 9003': 'yes',
    'H.R. 9004': 'yes',
    'H.R. 9005': 'yes',
    'H.R. 9006': 'yes',
    'H.R. 9007': 'yes',
    'S. 9101': 'no',
    'S. 9104': 'yes',
  },
  'teresa-marlowe': {
    'H.R. 9002': 'yes',
    'H.R. 9003': 'yes',
    'H.R. 9004': 'yes',
    'H.R. 9005': 'yes',
    'H.R. 9007': 'yes',
    'S. 9101': 'yes',
    'S. 9102': 'yes',
    'S. 9103': 'yes',
  },
  'ross-bellamy': {
    'H.R. 9001': 'yes',
    'H.R. 9003': 'yes',
    'H.R. 9004': 'yes',
    'H.R. 9005': 'yes',
    'H.R. 9006': 'yes',
    'H.R. 9007': 'yes',
    'S. 9103': 'yes',
    'S. 9105': 'yes',
  },
};

const billsByNumber = new Map(bills.map((bill) => [bill.number, bill]));

export const votes = Object.entries(positionPlan).flatMap(
  ([candidateSlug, positions]) =>
    Object.entries(positions).map(([billNumber, position]) => {
      const bill = billsByNumber.get(billNumber);

      if (!bill) {
        throw new Error(`Seed vote references unknown bill ${billNumber}`);
      }

      const offsetDays = voteOffsetDays[billNumber] ?? 45;
      const castAt = new Date(bill.introducedAt.getTime() + offsetDays * DAY_MS);
      const note = noteByVote[`${candidateSlug}|${billNumber}`];

      return {
        candidateSlug,
        billNumber,
        position,
        castAt,
        ...(note ? { note } : {}),
      };
    })
);

export const demoUser = {
  displayName: 'Demo Analyst',
  email: 'demo@recordoverrhetoric.app',
  password: 'CompareVotes!2026',
  isVerified: true,
};

export default {
  offices,
  candidates,
  bills,
  votes,
  demoUser,
};
