import { mongo } from './mongo.js';
import { redis } from './redis.js';
import { neo4jService } from './neo4j.js';
import { cassandra } from './cassandra.js';
import type { ServiceDef } from './types.js';

export const services: ServiceDef[] = [mongo, redis, neo4jService, cassandra];

export const serviceKeys = services.map((s) => s.key);

export function getService(key: string): ServiceDef | undefined {
  return services.find((s) => s.key === key.toLowerCase());
}

export type { ServiceDef };
