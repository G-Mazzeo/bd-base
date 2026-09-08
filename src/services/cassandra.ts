import cassandraDriver from 'cassandra-driver';
import { env, urls } from '../env.js';
import type { ServiceDef } from './types.js';

export const cassandra: ServiceDef = {
  key: 'cassandra',
  label: 'Cassandra',
  container: 'bd-cassandra',
  ports: [env.cassandra.port],
  connection: () => [
    `Contacto: ${urls.cassandra()}`,
    `DC:       ${env.cassandra.datacenter}`,
    `Keyspace: ${env.cassandra.keyspace} (se crea con: pnpm bd keyspace)`,
    `cqlsh:    docker exec -it bd-cassandra cqlsh`,
  ],
  check: async () => {
    const client = new cassandraDriver.Client({
      contactPoints: [`localhost:${env.cassandra.port}`],
      localDataCenter: env.cassandra.datacenter,
      socketOptions: { connectTimeout: 10000 },
    });
    try {
      await client.connect();
      const result = await client.execute('SELECT release_version FROM system.local');
      return `version ${result.first()?.['release_version'] ?? '?'}`;
    } finally {
      await client.shutdown();
    }
  },
};

/** Crea el keyspace por defecto con SimpleStrategy (single node). */
export async function createKeyspace(): Promise<void> {
  const client = new cassandraDriver.Client({
    contactPoints: [`localhost:${env.cassandra.port}`],
    localDataCenter: env.cassandra.datacenter,
  });
  try {
    await client.connect();
    await client.execute(
      `CREATE KEYSPACE IF NOT EXISTS ${env.cassandra.keyspace} ` +
        `WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}`,
    );
  } finally {
    await client.shutdown();
  }
}
