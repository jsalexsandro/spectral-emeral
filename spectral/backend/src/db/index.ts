import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { config } from "../config.js"
import * as schema from "./schema.js"

const client = postgres(config.databaseUrl, { prepare: false, max: 5 })

export const db = drizzle(client, { schema })

export async function closeDatabase() {
  await client.end({ timeout: 5 })
}
