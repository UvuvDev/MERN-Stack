import mongoose from 'mongoose';

let listenersAttached = false;

function attachConnectionListeners() {
  if (listenersAttached) return;

  const connection = mongoose.connection;

  connection.on('connected', () => {
    console.info('[db] MongoDB connected');
  });

  connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  connection.on('reconnected', () => {
    console.info('[db] MongoDB reconnected');
  });

  connection.on('error', (error) => {
    console.error(`[db] MongoDB connection error: ${error.message}`);
  });

  listenersAttached = true;
}

export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI is required to connect to MongoDB');
  }

  attachConnectionListeners();

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return mongoose.connection;
  }

  const options = {
    autoIndex: process.env.NODE_ENV !== 'production',
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
  };

  try {
    await mongoose.connect(uri, options);
  } catch (error) {
    console.error(`[db] Failed to connect to MongoDB: ${error.message}`);
    throw error;
  }

  return mongoose.connection;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
}

export default connectDB;
