export function stripCodeFences(text) {
  let value = String(text || '').trim();
  if (value.startsWith('```')) {
    value = value.replace(/^```(?:json)?\s*/i, '');
    value = value.replace(/```\s*$/, '');
    value = value.trim();
  }
  return value;
}

export function parseJsonTolerant(text) {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Response did not contain valid JSON');
  }
}

export default parseJsonTolerant;
