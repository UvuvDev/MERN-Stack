import { env } from '../../config/env.js';
import { parseJsonTolerant } from '../../utils/parseJson.js';

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDimensions(value) {
  if (!Array.isArray(value)) {
    throw new Error('Analysis is missing a dimensions array');
  }
  return value
    .filter(isPlainObject)
    .map((dimension) => ({
      topic: asString(dimension.topic),
      candidateA: asString(dimension.candidateA),
      candidateB: asString(dimension.candidateB),
      difference: asString(dimension.difference),
    }))
    .filter((dimension) => dimension.topic);
}

function normalizeNotableVotes(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainObject)
    .map((item) => ({ bill: asString(item.bill), why: asString(item.why) }))
    .filter((item) => item.bill);
}

function normalizePriorityMeasures(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainObject)
    .map((item) => ({
      measure: asString(item.measure),
      candidateA: asString(item.candidateA),
      candidateB: asString(item.candidateB),
      context: asString(item.context),
    }))
    .filter((item) => item.measure);
}

function normalizeSide(value, fallbackLabel) {
  return {
    label: asString(value.label) || fallbackLabel,
    strengths: asStringArray(value.strengths),
    concerns: asStringArray(value.concerns),
  };
}

function normalizeAnalysis(raw) {
  if (!isPlainObject(raw)) {
    throw new Error('Model response was not a JSON object');
  }

  const summary = asString(raw.summary);
  if (!summary) throw new Error('Analysis is missing a summary');
  if (!Array.isArray(raw.dimensions)) {
    throw new Error('Analysis is missing a dimensions array');
  }
  if (!isPlainObject(raw.candidateA) || !isPlainObject(raw.candidateB)) {
    throw new Error('Analysis is missing candidateA or candidateB');
  }

  const rawConfidence = asString(raw.confidence).toLowerCase();
  if (!rawConfidence) throw new Error('Analysis is missing confidence');
  const confidence = ['low', 'medium', 'high'].includes(rawConfidence)
    ? rawConfidence
    : 'low';

  return {
    summary,
    dimensions: normalizeDimensions(raw.dimensions),
    candidateA: normalizeSide(raw.candidateA, 'Candidate A'),
    candidateB: normalizeSide(raw.candidateB, 'Candidate B'),
    sharedVotes: asStringArray(raw.sharedVotes),
    notableVotes: normalizeNotableVotes(raw.notableVotes),
    priorityMeasures: normalizePriorityMeasures(raw.priorityMeasures),
    confidence,
    disclaimer:
      asString(raw.disclaimer) ||
      'AI interpretation of voting records only; not an endorsement.',
  };
}

function extractContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('');
  }
  return '';
}

function conciseError(error) {
  const message = String(error?.message || error || 'Unknown error');
  return message.replace(/\s+/g, ' ').trim().slice(0, 300);
}

export async function callOpenRouter({ modelId, system, user, timeoutMs, reasoning }) {
  const startedAt = Date.now();

  if (!env.openrouter.apiKey) {
    return {
      ok: false,
      analysis: null,
      latencyMs: 0,
      error: 'OPENROUTER_API_KEY is not configured',
    };
  }

  const timeout =
    Number(timeoutMs) > 0 ? Number(timeoutMs) : env.openrouter.timeoutMs;

  try {
    const response = await fetch(
      `${env.openrouter.baseUrl.replace(/\/+$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.openrouter.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': env.clientOrigins[0] || 'http://localhost:5173',
          'X-Title': 'Record Over Rhetoric',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: system || '' },
            { role: 'user', content: user || '' },
          ],
          temperature: 0.2,
          max_tokens: 8000,
          reasoning: reasoning || { effort: 'low' },
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(timeout),
      },
    );

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        ok: false,
        analysis: null,
        latencyMs,
        error: conciseError(
          `OpenRouter returned HTTP ${response.status}${
            body ? `: ${body.slice(0, 200)}` : ''
          }`,
        ),
      };
    }

    const data = await response.json();
    const content = extractContent(data?.choices?.[0]?.message?.content);
    if (!content.trim()) {
      throw new Error('OpenRouter response did not include message content');
    }

    const parsed = parseJsonTolerant(content);
    const analysis = normalizeAnalysis(parsed);

    return { ok: true, analysis, latencyMs, error: null };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message =
      error?.name === 'TimeoutError' || error?.name === 'AbortError'
        ? `OpenRouter request timed out after ${timeout}ms`
        : conciseError(error);
    return { ok: false, analysis: null, latencyMs, error: message };
  }
}

export default callOpenRouter;
