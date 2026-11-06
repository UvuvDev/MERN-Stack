import mongoose from 'mongoose';

const missingNomineeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    party: { type: String, trim: true },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const raceSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Race name is required'],
      trim: true,
    },
    electionYear: {
      type: Number,
      required: [true, 'Election year is required'],
      index: true,
    },
    electionDate: {
      type: Date,
      default: null,
    },
    office: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Office',
      required: [true, 'Race office is required'],
      index: true,
    },
    state: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
    },
    district: {
      type: String,
      default: null,
      trim: true,
    },
    candidates: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Candidate',
        },
      ],
      default: [],
    },
    missingNominees: {
      type: [missingNomineeSchema],
      default: [],
    },
    description: {
      type: String,
      trim: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    isSample: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

raceSchema.index({ office: 1, electionYear: 1 });

export const Race =
  mongoose.models.Race || mongoose.model('Race', raceSchema);

export default Race;
