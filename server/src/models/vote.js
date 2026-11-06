import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema({
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: [true, 'Vote candidate is required'],
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: [true, 'Vote bill is required'],
    index: true,
  },
  position: {
    type: String,
    enum: {
      values: ['yes', 'no', 'abstain', 'absent'],
      message: 'Vote position must be yes, no, abstain, or absent',
    },
  },
  castAt: {
    type: Date,
  },
  note: {
    type: String,
    trim: true,
  },
  question: {
    type: String,
    trim: true,
  },
  result: {
    type: String,
    trim: true,
  },
});

voteSchema.index({ candidate: 1, bill: 1 }, { unique: true });

export const Vote = mongoose.models.Vote || mongoose.model('Vote', voteSchema);

export default Vote;
