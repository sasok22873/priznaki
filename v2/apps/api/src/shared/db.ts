import { PrismaClient } from '@prisma/client';

export type Db = PrismaClient;

let client: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}
