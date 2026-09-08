import neo4j from 'neo4j-driver';
import { env, urls } from '../env.js';
import type { ServiceDef } from './types.js';

export const neo4jService: ServiceDef = {
  key: 'neo4j',
  label: 'Neo4j',
  container: 'bd-neo4j',
  ports: [env.neo4j.httpPort, env.neo4j.boltPort],
  connection: () => [
    `Bolt:     ${urls.neo4j()}`,
    `Browser:  ${urls.neo4jBrowser()}`,
    `Usuario:  ${env.neo4j.user} / ${env.neo4j.password}`,
    `Cypher:   docker exec -it bd-neo4j cypher-shell -u ${env.neo4j.user} -p ${env.neo4j.password}`,
  ],
  check: async () => {
    const driver = neo4j.driver(
      urls.neo4j(),
      neo4j.auth.basic(env.neo4j.user, env.neo4j.password),
      { connectionTimeout: 5000 },
    );
    try {
      const info = await driver.getServerInfo();
      return `${info.agent ?? 'neo4j'} en ${info.address ?? urls.neo4j()}`;
    } finally {
      await driver.close();
    }
  },
};
