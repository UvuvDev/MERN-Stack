import { PRIORITY_MEASURES } from '../import/priority-measures.js';

function idOf(value) {
  if (!value) return null;
  return value.id ?? value._id ?? null;
}

function findVote(records, definition) {
  return (
    (records || []).find((record) => {
      const bill = record && record.bill;
      if (!bill) return false;
      if (bill.priorityKey && bill.priorityKey === definition.key) return true;
      return bill.number === definition.bill.number;
    }) || null
  );
}

function positionFor(vote, definition) {
  if (!vote) {
    return {
      position: null,
      note: 'No recorded roll-call vote in the imported dataset.',
      question: '',
      result: '',
      date: null,
      billNumber: definition.bill.number,
      title: definition.bill.title,
      sourceUrl: definition.voteview.sourceUrl,
    };
  }

  return {
    position: vote.position ?? null,
    note: vote.note ?? '',
    question: vote.question ?? '',
    result: vote.result ?? '',
    date: vote.castAt ?? null,
    billNumber: vote.bill?.number ?? definition.bill.number,
    title: vote.bill?.title ?? definition.bill.title,
    sourceUrl: vote.bill?.sourceUrl ?? definition.bill.sourceUrl,
  };
}

/**
 * Build the authoritative priority-measure section for a comparison, using the
 * full candidate records (not the 60-vote prompt sample).
 */
export function buildPriorityMeasureResults({
  candidateA,
  candidateB,
  recordsA = [],
  recordsB = [],
  definitions = PRIORITY_MEASURES,
}) {
  return definitions.map((definition) => {
    const voteA = findVote(recordsA, definition);
    const voteB = findVote(recordsB, definition);

    return {
      key: definition.key,
      label: definition.label,
      title: definition.title,
      billNumber: definition.bill.number,
      context: definition.context,
      sourceUrl: definition.voteview.sourceUrl,
      candidateA: {
        id: idOf(candidateA),
        name: candidateA?.name ?? 'Candidate A',
        ...positionFor(voteA, definition),
      },
      candidateB: {
        id: idOf(candidateB),
        name: candidateB?.name ?? 'Candidate B',
        ...positionFor(voteB, definition),
      },
    };
  });
}

export function describePriorityPosition(position) {
  if (!position || !position.position) return 'No recorded roll-call vote';
  const label = String(position.position);
  return position.note ? `${label} (${position.note})` : label;
}

export function priorityPromptPayload(priorityMeasures = []) {
  return priorityMeasures.map((measure) => ({
    measure: measure.label,
    bill: measure.billNumber,
    context: measure.context,
    candidateA: {
      name: measure.candidateA?.name ?? 'Candidate A',
      position: describePriorityPosition(measure.candidateA),
    },
    candidateB: {
      name: measure.candidateB?.name ?? 'Candidate B',
      position: describePriorityPosition(measure.candidateB),
    },
  }));
}

export function priorityMeasuresForDeterministicAnalysis(priorityMeasures = []) {
  return priorityMeasures.map((measure) => ({
    measure: measure.label,
    candidateA: describePriorityPosition(measure.candidateA),
    candidateB: describePriorityPosition(measure.candidateB),
    context: measure.context,
  }));
}

export default {
  buildPriorityMeasureResults,
  describePriorityPosition,
  priorityMeasuresForDeterministicAnalysis,
  priorityPromptPayload,
};
