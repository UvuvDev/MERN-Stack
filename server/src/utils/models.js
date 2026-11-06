import * as modelsModule from '../models/index.js';

const MODEL_NAMES = ['User', 'Office', 'Candidate', 'Bill', 'Vote', 'Comparison'];

function resolve(name) {
  if (modelsModule[name]) return modelsModule[name];
  if (modelsModule.default && modelsModule.default[name]) {
    return modelsModule.default[name];
  }
  return null;
}

export function getModel(name) {
  const model = resolve(name);
  if (!model) {
    throw new Error(
      `Mongoose model "${name}" was not exported from src/models/index.js`,
    );
  }
  return model;
}

export const models = Object.fromEntries(
  MODEL_NAMES.map((name) => [name, resolve(name)]),
);

export default getModel;
