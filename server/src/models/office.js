import mongoose from 'mongoose';

const officeSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    level: {
      type: String,
      enum: {
        values: ['federal', 'state', 'local'],
        message: 'Office level must be federal, state, or local',
      },
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
    description: {
      type: String,
      trim: true,
    },
    isSample: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Office = mongoose.models.Office || mongoose.model('Office', officeSchema);

export default Office;
