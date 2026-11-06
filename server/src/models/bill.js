import mongoose from 'mongoose';

const billSchema = new mongoose.Schema({
  congress: {
    type: Number,
  },
  chamber: {
    type: String,
    enum: {
      values: ['house', 'senate'],
      message: 'Bill chamber must be house or senate',
    },
  },
  number: {
    type: String,
    trim: true,
  },
  title: {
    type: String,
    trim: true,
  },
  summary: {
    type: String,
    trim: true,
  },
  topics: {
    type: [String],
    default: [],
  },
  introducedAt: {
    type: Date,
  },
  sponsor: {
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
});

billSchema.index({ congress: 1, chamber: 1, number: 1 }, { unique: true });

export const Bill = mongoose.models.Bill || mongoose.model('Bill', billSchema);

export default Bill;
