import mongoose from 'mongoose';

const modelResultSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ['minimax', 'deepseek', 'grok'],
    },
    modelId: {
      type: String,
    },
    ok: {
      type: Boolean,
    },
    latencyMs: {
      type: Number,
    },
    analysis: {
      type: mongoose.Schema.Types.Mixed,
    },
    error: {
      type: String,
    },
  },
  { _id: false }
);

const billReferenceSchema = new mongoose.Schema(
  {
    number: { type: String },
    citation: { type: String },
    congress: { type: Number },
    title: { type: String },
    summary: { type: String },
    sourceUrl: { type: String },
    topics: { type: [String], default: [] },
  },
  { _id: false }
);

const priorityPositionSchema = new mongoose.Schema(
  {
    id: { type: String, default: null },
    name: { type: String, default: null },
    position: {
      type: String,
      enum: ['yes', 'no', 'abstain', 'absent'],
      default: null,
    },
    note: { type: String, default: '' },
    question: { type: String, default: '' },
    result: { type: String, default: '' },
    date: { type: Date, default: null },
    billNumber: { type: String, default: null },
    title: { type: String, default: null },
    sourceUrl: { type: String, default: null },
  },
  { _id: false }
);

const priorityMeasureSchema = new mongoose.Schema(
  {
    key: { type: String },
    label: { type: String },
    title: { type: String },
    billNumber: { type: String },
    context: { type: String },
    sourceUrl: { type: String },
    candidateA: { type: priorityPositionSchema, default: null },
    candidateB: { type: priorityPositionSchema, default: null },
  },
  { _id: false }
);

const comparisonSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comparison user is required'],
    },
    candidateA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
    },
    candidateB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
    },
    office: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Office',
    },
    race: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Race',
      default: null,
    },
    votesSnapshot: {
      candidateA: { type: Number },
      candidateB: { type: Number },
    },
    models: {
      type: [modelResultSchema],
      default: [],
    },
    billReferences: {
      type: [billReferenceSchema],
      default: [],
    },
    priorityMeasures: {
      type: [priorityMeasureSchema],
      default: [],
    },
  },
  { timestamps: true }
);

comparisonSchema.index({ user: 1, createdAt: -1 });

export const Comparison =
  mongoose.models.Comparison || mongoose.model('Comparison', comparisonSchema);

export default Comparison;
