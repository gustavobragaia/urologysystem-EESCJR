import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../lib/env';

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  prepare: false, // Necessário para Supabase (PgBouncer transaction mode)
});

export const db = drizzle(queryClient, { schema });
