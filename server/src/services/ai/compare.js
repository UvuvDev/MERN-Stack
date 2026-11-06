import { env } from '../../config/env.js';
import {
  buildBillReferenceMap,
  collectCitedBills,
  enrichAnalysisWithBillTitles,
} from '../../utils/billRefs.js';
import { buildComparisonPrompt } from './prompt.js';
import { callOpenRouter } from './openrouter.js';

export const MODEL_DEFINITIONS = [
  {
    key: 'minimax',
    label: 'MiniMax M3 Flash',
    modelId: env.openrouter.models.minimax,
    reasoning: { effort: 'low' },
  },
  {
    key: 'deepseek',
    label: 'DeepSeek 4.1 Flash',
    modelId: env.openrouter.models.deepseek,
    reasoning: { enabled: false },
  },
  {
    key: 'grok',
    label: 'Grok 4.3',
    modelId: env.openrouter.models.grok,
    reasoning: { effort: 'low' },
  },
];

const POSITIONS = ['yes', 'no', 'abstain', 'absent'];

function nameOf(candidate, fallback) {
  return candidate?.name || fallback;
}

function emptyCounts() {
  return { yes: 0, no: 0, abstain: 0, absent: 0, total: 0 };
}

function countPositions(records) {
  const counts = emptyCounts();
  for (const record of records || []) {
    const position = String(record?.position || '').toLowerCase();
    if (POSITIONS.includes(position)) counts[position] += 1;
    counts.total += 1;
  }
  return counts;
}

function billKey(record) {
  return record?.bill?.id || record?.bill?._id || record?.bill?.number;
}

function topicList(record) {
  const topics = record?.bill?.topics;
  if (Array.isArray(topics) && topics.length > 0) return topics;
  return ['General'];
}

function topicStats(recordsA, recordsB) {
  const stats = new Map();
  function add(records, side) {
    for (const record of records || []) {
      for (const topic of topicList(record)) {
        if (!stats.has(topic)) {
          stats.set(topic, { A: [], B: [] });
        }
        stats.get(topic)[side].push(record);
      }
    }
  }
  add(recordsA, 'A');
  add(recordsB, 'B');
  return stats;
}

function topTopics(recordsA, recordsB, limit = 4) {
  return [...topicStats(recordsA, recordsB).entries()]
    .sort((a, b) => {
      const sizeA = a[1].A.length + a[1].B.length;
      const sizeB = b[1].A.length + b[1].B.length;
      if (sizeA !== sizeB) return sizeB - sizeA;
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([topic]) => topic);
}

function sharedVotes(recordsA, recordsB) {
  const byBill = new Map();
  for (const record of recordsB || []) {
    byBill.set(billKey(record), record);
  }
  const shared = [];
  for (const record of recordsA || []) {
    const other = byBill.get(billKey(record));
    if (!other) continue;
    const position = String(record.position || '').toLowerCase();
    if (position && position === String(other.position || '').toLowerCase()) {
      shared.push({
        bill: record.bill?.number || 'Unknown bill',
        position,
      });
    }
  }
  return shared;
}

function splitVotes(recordsA, recordsB) {
  const byBill = new Map();
  for (const record of recordsB || []) {
    byBill.set(billKey(record), record);
  }
  const splits = [];
  for (const record of recordsA || []) {
    const other = byBill.get(billKey(record));
    if (!other) continue;
    const positionA = String(record.position || '').toLowerCase();
    const positionB = String(other.position || '').toLowerCase();
    if (positionA && positionB && positionA !== positionB) {
      splits.push({
        bill: record.bill?.number || 'Unknown bill',
        title: record.bill?.title || '',
        positionA,
        positionB,
      });
    }
  }
  return splits;
}

function describeCounts(name, records, topic) {
  const matching = (records || []).filter((record) =>
    topicList(record).includes(topic),
  );
  const counts = countPositions(matching);
  return `${name} recorded ${counts.yes} yes, ${counts.no} no, ${counts.abstain} abstain, and ${counts.absent} absent on the ${matching.length} ${topic} bill(s) on file.`;
}

function buildStrengths(name, records) {
  const counts = countPositions(records);
  const items = [];
  if (counts.total > 0) {
    items.push(
      `${name} has a recorded position on ${counts.total - counts.absent} of ${counts.total} bill(s) in the supplied record.`,
    );
  }
  const topics = topTopics(records, [], 1);
  if (topics.length > 0) {
    items.push(
      `${name} cast ${counts.yes} yes vote(s) across the record, including ${topics[0]} measures.`,
    );
  }
  return items;
}

function buildConcerns(name, records) {
  const counts = countPositions(records);
  const items = [];
  if (counts.absent > 0) {
    items.push(
      `${name} was recorded absent on ${counts.absent} bill(s); absence is not support or opposition.`,
    );
  }
  if (counts.abstain > 0) {
    items.push(
      `${name} abstained on ${counts.abstain} bill(s); abstention is not a yes or no vote.`,
    );
  }
  if (items.length === 0) {
    items.push(
      `${name} has no absences or abstentions in the supplied record, so there is no gap of that kind.`,
    );
  }
  return items;
}

function confidenceFor(recordsA, recordsB) {
  const total =
    (Array.isArray(recordsA) ? recordsA.length : 0) +
    (Array.isArray(recordsB) ? recordsB.length : 0);
  if (total >= 8) return 'high';
  if (total >= 4) return 'medium';
  return 'low';
}

function modelSummary(key, params) {
  const {
    nameA,
    nameB,
    countsA,
    countsB,
    sharedCount,
    splitCount,
    topics,
  } = params;
  const topicText =
    topics.length > 0 ? topics.join(', ').toLowerCase() : 'the supplied bills';
  const base = `the records cover ${topicText}`;
  const overlapNote =
    sharedCount + splitCount === 0
      ? ' The two records do not share any roll-call votes, so this compares each member\'s own voting pattern rather than direct head-to-head votes.'
      : '';

  if (key === 'minimax') {
    return `A direct reading of the roll-call data shows ${nameA} with ${countsA.yes} yes and ${countsA.no} no votes, while ${nameB} recorded ${countsB.yes} yes and ${countsB.no} no votes. The two members voted the same way on ${sharedCount} bill(s) and differently on ${splitCount} bill(s) where both have a position, and ${base}. This comparison is limited to the votes on file and does not assess motives or ideology.${overlapNote}`;
  }
  if (key === 'deepseek') {
    return `Across the bills on file, ${nameA} recorded ${countsA.yes} yes, ${countsA.no} no, ${countsA.abstain} abstain, and ${countsA.absent} absent, compared with ${nameB} at ${countsB.yes} yes, ${countsB.no} no, ${countsB.abstain} abstain, and ${countsB.absent} absent. The records agree on ${sharedCount} bill(s), disagree on ${splitCount} bill(s), and ${base}. No conclusion about political philosophy is drawn from these counts alone.${overlapNote}`;
  }
  return `Grok's tally of the same record: ${nameA} cast ${countsA.yes} yes and ${countsA.no} no votes versus ${nameB}'s ${countsB.yes} yes and ${countsB.no} no votes. They share a position on ${sharedCount} bill(s) and split on ${splitCount} bill(s), while ${base}. Absences (${countsA.absent} for ${nameA}, ${countsB.absent} for ${nameB}) are treated separately, and party labels are not used as evidence.${overlapNote}`;
}

export function buildDeterministicAnalysis({
  key,
  candidateA,
  candidateB,
  recordsA,
  recordsB,
}) {
  const nameA = nameOf(candidateA, 'Candidate A');
  const nameB = nameOf(candidateB, 'Candidate B');
  const countsA = countPositions(recordsA);
  const countsB = countPositions(recordsB);
  const topics = topTopics(recordsA, recordsB);
  const shared = sharedVotes(recordsA, recordsB);
  const splits = splitVotes(recordsA, recordsB);

  const dimensions = topics.map((topic) => {
    const topicSplits = splits.filter((split) => {
      const record = (recordsA || []).find(
        (item) => item.bill?.number === split.bill,
      );
      return record ? topicList(record).includes(topic) : false;
    });
    return {
      topic,
      candidateA: describeCounts(nameA, recordsA, topic),
      candidateB: describeCounts(nameB, recordsB, topic),
      difference:
        topicSplits.length > 0
          ? `The members split on ${topicSplits
              .map((split) => split.bill)
              .join(', ')} (${topic}).`
          : shared.length === 0
            ? 'No shared roll calls in the supplied records; each side is summarized from its own record.'
            : `No recorded difference on ${topic} bills where both members have a position.`,
    };
  });

  const titleFor = (number) => {
    for (const record of [...(recordsA || []), ...(recordsB || [])]) {
      if (record?.bill?.number === number && record.bill.title) {
        return record.bill.title;
      }
    }
    return '';
  };

  const summary = modelSummary(key, {
    nameA,
    nameB,
    countsA,
    countsB,
    sharedCount: shared.length,
    splitCount: splits.length,
    topics,
  });

  return {
    summary,
    dimensions,
    candidateA: {
      label: nameA,
      strengths: buildStrengths(nameA, recordsA),
      concerns: buildConcerns(nameA, recordsA),
    },
    candidateB: {
      label: nameB,
      strengths: buildStrengths(nameB, recordsB),
      concerns: buildConcerns(nameB, recordsB),
    },
    sharedVotes: shared.map((item) => {
      const title = titleFor(item.bill);
      const label = title ? `${item.bill} — ${title}` : item.bill;
      return `${label} (both voted ${item.position})`;
    }),
    notableVotes:
      splits.length > 0
        ? splits.slice(0, 5).map((split) => ({
            bill: split.bill,
            why: `${nameA} voted ${split.positionA}; ${nameB} voted ${split.positionB}.`,
          }))
        : [
            ...(recordsA || []).slice(0, 3).map((record) => ({
              bill: record.bill?.number,
              why: `${nameA} voted ${record.position} on ${record.bill?.title || record.bill?.number}.`,
            })),
            ...(recordsB || []).slice(0, 3).map((record) => ({
              bill: record.bill?.number,
              why: `${nameB} voted ${record.position} on ${record.bill?.title || record.bill?.number}.`,
            })),
          ].filter((item) => item.bill),
    confidence: confidenceFor(recordsA, recordsB),
    disclaimer:
      'Demo mode is on: this analysis is generated deterministically from the supplied vote data, not by a live language model. It covers voting records only and is not an endorsement.',
    demoMode: true,
    note: `Demo mode is on. ${MODEL_DEFINITIONS.find((item) => item.key === key)?.label || key} returned a deterministic summary built from the available roll-call votes.`,
  };
}

function shouldUseFake() {
  return (
    env.openrouter.fake ||
    !env.openrouter.enabled ||
    !env.openrouter.apiKey
  );
}

function fakeModels(promptInput) {
  return MODEL_DEFINITIONS.map((definition) => ({
    key: definition.key,
    modelId: definition.modelId,
    ok: true,
    latencyMs: 0,
    analysis: buildDeterministicAnalysis({
      key: definition.key,
      ...promptInput,
    }),
    error: null,
  }));
}

async function liveModels(promptInput) {
  const prompt = buildComparisonPrompt(promptInput);
  const settled = await Promise.allSettled(
    MODEL_DEFINITIONS.map((definition) =>
      callOpenRouter({
        modelId: definition.modelId,
        system: prompt.system,
        user: prompt.user,
        timeoutMs: env.openrouter.timeoutMs,
        reasoning: definition.reasoning,
      }),
    ),
  );

  return MODEL_DEFINITIONS.map((definition, index) => {
    const result = settled[index];
    if (result.status === 'rejected') {
      return {
        key: definition.key,
        modelId: definition.modelId,
        ok: false,
        latencyMs: 0,
        analysis: null,
        error: String(result.reason?.message || result.reason || 'Model call failed').slice(
          0,
          300,
        ),
      };
    }
    return {
      key: definition.key,
      modelId: definition.modelId,
      ok: Boolean(result.value?.ok),
      latencyMs: Number(result.value?.latencyMs) || 0,
      analysis: result.value?.ok ? result.value.analysis : null,
      error: result.value?.ok ? null : result.value?.error || 'Model call failed',
    };
  });
}

export async function compareVotingRecords({
  candidateA,
  candidateB,
  recordsA,
  recordsB,
}) {
  const promptInput = { candidateA, candidateB, recordsA, recordsB };

  const rawModels = shouldUseFake()
    ? fakeModels(promptInput)
    : await liveModels(promptInput);

  // Models sometimes cite only a bill number. Add the supplied title so the
  // UI never shows an unexplained "H.R. 9007".
  const billMap = buildBillReferenceMap(recordsA, recordsB);
  const models = rawModels.map((model) =>
    model.analysis
      ? { ...model, analysis: enrichAnalysisWithBillTitles(model.analysis, billMap) }
      : model
  );

  return {
    models,
    billReferences: collectCitedBills(models, billMap),
    generatedAt: new Date().toISOString(),
  };
}

export default compareVotingRecords;
