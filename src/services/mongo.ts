import { MongoClient } from 'mongodb';
import { env, urls } from '../env.js';
import type { ServiceDef } from './types.js';

export const mongo: ServiceDef = {
  key: 'mongo',
  label: 'MongoDB',
  container: 'bd-mongo',
  ports: [env.mongo.port],
  connection: () => [
    `URI:      ${urls.mongo()}`,
    `Base:     ${env.mongo.database}`,
    `Shell:    docker exec -it bd-mongo mongosh -u ${env.mongo.user} -p ${env.mongo.password}`,
  ],
  check: async () => {
    const client = new MongoClient(urls.mongo(), { serverSelectionTimeoutMS: 5000 });
    try {
      await client.connect();
      const info = await client.db('admin').admin().serverStatus();
      return `version ${info['version']}`;
    } finally {
      await client.close();
    }
  },
};
