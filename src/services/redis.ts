import { Redis } from 'ioredis';
import { env, urls } from '../env.js';
import type { ServiceDef } from './types.js';

export const redis: ServiceDef = {
  key: 'redis',
  label: 'Redis',
  container: 'bd-redis',
  ports: [env.redis.port],
  connection: () => [
    `URI:      ${urls.redis()}`,
    `CLI:      docker exec -it bd-redis redis-cli -a ${env.redis.password}`,
  ],
  check: async () => {
    const client = new Redis({
      host: 'localhost',
      port: env.redis.port,
      password: env.redis.password,
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    try {
      await client.connect();
      const info = await client.info('server');
      const version = /redis_version:(\S+)/.exec(info)?.[1] ?? '?';
      return `version ${version}`;
    } finally {
      client.disconnect();
    }
  },
};
