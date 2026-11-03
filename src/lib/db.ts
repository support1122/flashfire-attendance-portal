import "server-only";
import mongoose from "mongoose";
import { env } from "./env";

/**
 * One connection per serverless instance. Vercel reuses warm instances, and in dev Next reloads modules,
 * so the promise lives on globalThis instead of module scope.
 */
const globalForMongo = globalThis as unknown as { mongoosePromise?: Promise<typeof mongoose> };

export function connectDb(): Promise<typeof mongoose> {
  if (!globalForMongo.mongoosePromise) {
    globalForMongo.mongoosePromise = mongoose
      .connect(env.mongoUri(), { dbName: env.mongoDb(), maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 })
      .catch((error: unknown) => {
        // Drop the failed promise so the next request retries instead of failing forever.
        globalForMongo.mongoosePromise = undefined;
        throw error;
      });
  }
  return globalForMongo.mongoosePromise;
}
