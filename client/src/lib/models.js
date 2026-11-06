export const MODEL_DEFINITIONS = [
  { key: 'minimax', label: 'MiniMax M3 Flash' },
  { key: 'deepseek', label: 'DeepSeek 4.1 Flash' },
  { key: 'grok', label: 'Grok 4.3' },
];

export function modelLabel(key) {
  const match = MODEL_DEFINITIONS.find((model) => model.key === key);
  return match ? match.label : key;
}
