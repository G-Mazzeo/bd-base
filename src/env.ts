import 'dotenv/config';

function str(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function num(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error(`La variable ${key} no es un número: "${value}"`);
  return parsed;
}

export const env = {
  mongo: {
    port: num('MONGO_PORT', 27017),
    user: str('MONGO_USER', 'root'),
    password: str('MONGO_PASSWORD', 'root'),
    database: str('MONGO_DB', 'sandbox'),
  },
  redis: {
    port: num('REDIS_PORT', 6379),
    password: str('REDIS_PASSWORD', 'redis'),
  },
  neo4j: {
    httpPort: num('NEO4J_HTTP_PORT', 7474),
    boltPort: num('NEO4J_BOLT_PORT', 7687),
    user: str('NEO4J_USER', 'neo4j'),
    password: str('NEO4J_PASSWORD', 'neo4jpassword'),
  },
  cassandra: {
    port: num('CASSANDRA_PORT', 9042),
    datacenter: str('CASSANDRA_DC', 'datacenter1'),
    keyspace: str('CASSANDRA_KEYSPACE', 'sandbox'),
  },
} as const;

export const urls = {
  mongo: () =>
    `mongodb://${encodeURIComponent(env.mongo.user)}:${encodeURIComponent(env.mongo.password)}@localhost:${env.mongo.port}/?authSource=admin`,
  redis: () => `redis://:${encodeURIComponent(env.redis.password)}@localhost:${env.redis.port}`,
  neo4j: () => `bolt://localhost:${env.neo4j.boltPort}`,
  neo4jBrowser: () => `http://localhost:${env.neo4j.httpPort}`,
  cassandra: () => `localhost:${env.cassandra.port}`,
};
