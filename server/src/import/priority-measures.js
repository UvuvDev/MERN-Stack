/**
 * Measures that must be explicitly covered in comparisons.
 *
 * The application is normally driven by the candidates' full voting records.
 * This registry exists for high-salience measures that are outside the recent
 * import window, or where a chamber used a procedural vote rather than passage.
 *
 * Keep the entries factual and sourced. `searchTerms` are used to find related
 * records in the database; `rollNumber` refers to the Voteview roll-call number.
 */
export const PRIORITY_MEASURES = [
  {
    key: 'epstein-hr4405',
    label: 'Epstein Files Transparency Act',
    title: 'Epstein Files Transparency Act',
    bill: {
      congress: 119,
      chamber: 'house',
      number: 'H.R. 4405',
      title: 'Epstein Files Transparency Act',
      summary:
        'Requires the Department of Justice to make publicly available documents related to Jeffrey Epstein, subject to limited redactions and a review process.',
      topics: ['justice', 'civil-liberties'],
      sourceUrl: 'https://www.congress.gov/bill/119/house-bill/4405',
      priorityKey: 'epstein-hr4405',
      isSample: false,
    },
    voteview: {
      file: 'H119',
      chamber: 'house',
      rollNumber: 288,
      date: '2025-11-18',
      question: 'On Motion to Suspend the Rules and Pass',
      result: 'Passed 427–1',
      sourceUrl: 'https://clerk.house.gov/evs/2025/roll289.xml',
    },
    context:
      'Passed the House 427–1 on 2025-11-18. The Senate passed it by unanimous consent on 2025-11-19, so there is no Senate roll-call position to compare.',
    searchTerms: ['epstein', 'epstein files transparency act', 'jeffrey epstein'],
  },
  {
    key: 'epstein-s2296-amendment',
    label: 'Epstein documents amendment to the FY2026 NDAA (S.2296)',
    title: 'Epstein Documents Amendment to the FY2026 National Defense Authorization Act',
    bill: {
      congress: 119,
      chamber: 'senate',
      number: 'Epstein Amendment to S. 2296',
      title:
        'Epstein Documents Amendment to the FY2026 National Defense Authorization Act',
      summary:
        'Amendment to S.2296 to direct the Attorney General to make publicly available documents related to Jeffrey Epstein.',
      topics: ['justice', 'civil-liberties'],
      sourceUrl: 'https://www.congress.gov/bill/119/senate-bill/2296',
      priorityKey: 'epstein-s2296-amendment',
      isSample: false,
    },
    voteview: {
      file: 'S119',
      chamber: 'senate',
      rollNumber: 512,
      date: '2025-09-10',
      question: 'On the Motion to Table',
      result: 'Motion to Table Agreed to 51–49',
      sourceUrl:
        'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00512.xml',
    },
    context:
      'Senate roll call 512 on 2025-09-10: motion to table the Epstein documents amendment to S.2296; agreed 51–49. A Yea is a vote to table the amendment, not a vote for final passage.',
    searchTerms: [
      'epstein',
      'jeffrey epstein',
      'documents related to jeffrey epstein',
    ],
  },
];

export function findPriorityDefinition(key) {
  return PRIORITY_MEASURES.find((measure) => measure.key === key) ?? null;
}

export default PRIORITY_MEASURES;
