import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error("MONGODB_URI is not defined");
}

export async function connectMongoose() {
  if (globalThis._mongooseConnection) {
    return globalThis._mongooseConnection;
  }

  const options = dbName ? { dbName } : {};
  globalThis._mongooseConnection = mongoose.connect(uri, options);
  return globalThis._mongooseConnection;
}

export default connectMongoose;
