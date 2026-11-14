const mongoose = require("mongoose");

// On Vercel each warm serverless instance re-runs requests in the same Node
// process, so we keep ONE connection promise per process and reuse it instead
// of reconnecting. Never call process.exit() here: on serverless that kills
// the instance; a failed attempt is simply retried on the next request.
let connectionPromise = null;

const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGO_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
      })
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((error) => {
        console.error(`MongoDB connection error: ${error.message}`);
        connectionPromise = null; // allow a retry on the next request
        throw error;
      });
  }
  return connectionPromise;
};

module.exports = connectDB;
