import mongoose from 'mongoose';

const candidateSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    bioguideId: {
      type: String,
      uppercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      trim: true,
    },
    party: {
      type: String,
      trim: true,
    },
    office: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Office',
      required: [true, 'Candidate office is required'],
      index: true,
    },
    state: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    district: {
      type: String,
      default: null,
      trim: true,
    },
    photoUrl: {
      type: String,
      trim: true,
    },
    officialUrl: {
      type: String,
      trim: true,
    },
    bio: {
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

export const Candidate =
  mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);

export default Candidate;
