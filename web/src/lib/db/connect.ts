import mongoose from "mongoose";
import { authConfig } from "@/lib/auth/config";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!authConfig.mongodbUri) {
    throw new Error(
      "MONGODB_URI is not configured. Please create .env.local with a valid MongoDB Atlas connection string."
    );
  }

  // Drop stale cache after disconnect / failed connect so we can retry.
  if (mongoose.connection.readyState === 0) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const isAtlas =
      authConfig.mongodbUri.includes("mongodb+srv") ||
      authConfig.mongodbUri.includes(".mongodb.net");
    const targetType = isAtlas ? "MongoDB Atlas" : "MongoDB";
    console.log(`[DB] Connecting to ${targetType}...`);

    cached.promise = mongoose
      .connect(authConfig.mongodbUri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 10000,
      })
      .then((conn) => {
        console.log("[DB] MongoDB connection established");
        return conn;
      })
      .catch((err) => {
        cached.promise = null;
        cached.conn = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
