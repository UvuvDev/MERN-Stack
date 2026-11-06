import mongoose from 'mongoose';

export const getHealth = (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    db:
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
};

export default { getHealth };
