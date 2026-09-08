#!/usr/bin/env node
import { compose, composeCapture } from './docker.js';
import { getService, services, serviceKeys, type ServiceDef } from './services/index.js';
import { createKeyspace } from './services/cassandra.js';
import { env } from './env.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function title(text: string): void {
  console.log(`\n${c.bold}${c.cyan}${text}${c.reset}`);
}

function ok(text: string): void {
  console.log(`${c.green}✔${c.reset} ${text}`);
}

function fail(text: string): void {
  console.log(`${c.red}✖${c.reset} ${text}`);
}

function usage(): void {
  console.log(`
${c.bold}bd${c.reset} — levanta bases de datos NoSQL en Docker, una por una

${c.bold}Uso:${c.reset}
  pnpm bd <comando> [servicio...]

${c.bold}Comandos:${c.reset}
  ${c.cyan}list${c.reset}                    Lista los servicios disponibles
  ${c.cyan}up${c.reset} <svc...|all>        Levanta y espera a que estén healthy
  ${c.cyan}down${c.reset} <svc...|all>      Frena y elimina los contenedores (los datos se conservan)
  ${c.cyan}restart${c.reset} <svc...|all>   down + up
  ${c.cyan}status${c.reset}                  Estado de todos los contenedores
  ${c.cyan}logs${c.reset} <svc> [-f]        Muestra los logs (-f para seguirlos)
  ${c.cyan}check${c.reset} [svc...]         Prueba la conexión real desde Node
  ${c.cyan}info${c.reset} [svc...]          Muestra los datos de conexión
  ${c.cyan}shell${c.reset} <svc>            Abre el cliente nativo (mongosh, redis-cli, cypher-shell, cqlsh)
  ${c.cyan}keyspace${c.reset}                Crea el keyspace '${env.cassandra.keyspace}' en Cassandra
  ${c.cyan}reset${c.reset} <svc...|all>     ${c.yellow}Elimina contenedores Y volúmenes (borra los datos)${c.reset}

${c.bold}Servicios:${c.reset} ${serviceKeys.join(', ')}, all

${c.bold}Ejemplos:${c.reset}
  ${c.dim}pnpm bd up mongo${c.reset}
  ${c.dim}pnpm bd up redis neo4j${c.reset}
  ${c.dim}pnpm bd check mongo${c.reset}
  ${c.dim}pnpm bd logs cassandra -f${c.reset}
`);
}

/** Resuelve los nombres pedidos en la CLI a definiciones de servicio. */
function resolve(names: string[], { allowEmpty = false } = {}): ServiceDef[] {
  if (names.length === 0) {
    if (allowEmpty) return services;
    throw new Error(`Faltó indicar el servicio. Opciones: ${serviceKeys.join(', ')}, all`);
  }
  if (names.includes('all')) return services;

  const resolved: ServiceDef[] = [];
  for (const name of names) {
    const svc = getService(name);
    if (!svc) throw new Error(`Servicio desconocido: "${name}". Opciones: ${serviceKeys.join(', ')}, all`);
    if (!resolved.includes(svc)) resolved.push(svc);
  }
  return resolved;
}

function printInfo(svc: ServiceDef): void {
  title(`${svc.label} (${svc.key})`);
  console.log(`  Contenedor: ${svc.container}`);
  console.log(`  Puertos:    ${svc.ports.join(', ')}`);
  for (const line of svc.connection()) console.log(`  ${line}`);
}

async function cmdUp(names: string[]): Promise<number> {
  const targets = resolve(names);
  console.log(`Levantando: ${targets.map((s) => s.label).join(', ')}`);
  if (targets.some((s) => s.key === 'cassandra')) {
    console.log(`${c.dim}(Cassandra puede tardar ~1 minuto en quedar healthy)${c.reset}`);
  }
  const code = await compose(['up', '-d', '--wait', ...targets.map((s) => s.key)]);
  if (code !== 0) {
    fail('docker compose up falló. Revisá los logs con: pnpm bd logs <svc>');
    return code;
  }
  for (const svc of targets) {
    ok(`${svc.label} listo`);
    printInfo(svc);
  }
  return 0;
}

async function cmdDown(names: string[], removeVolumes: boolean): Promise<number> {
  const targets = resolve(names);
  const keys = targets.map((s) => s.key);
  if (removeVolumes) {
    console.log(`${c.yellow}Eliminando contenedores y volúmenes de: ${keys.join(', ')}${c.reset}`);
  }
  const args = ['rm', '-f', '-s', ...(removeVolumes ? ['-v'] : []), ...keys];
  const code = await compose(args);
  if (code !== 0) return code;

  if (removeVolumes) {
    // Los volúmenes nombrados no los borra `compose rm -v`: hay que eliminarlos aparte.
    const volumes: Record<string, string[]> = {
      mongo: ['bd-base_mongo-data'],
      redis: ['bd-base_redis-data'],
      neo4j: ['bd-base_neo4j-data', 'bd-base_neo4j-logs'],
      cassandra: ['bd-base_cassandra-data'],
    };
    const toRemove = keys.flatMap((k) => volumes[k] ?? []);
    if (toRemove.length > 0) {
      const { spawn } = await import('node:child_process');
      await new Promise<void>((resolve_) => {
        const child = spawn('docker', ['volume', 'rm', '-f', ...toRemove], { stdio: 'inherit' });
        child.on('close', () => resolve_());
        child.on('error', () => resolve_());
      });
    }
  }
  ok(`${targets.map((s) => s.label).join(', ')} dado(s) de baja`);
  return 0;
}

interface ComposePsRow {
  Service?: string;
  Name?: string;
  State?: string;
  Health?: string;
  Publishers?: { PublishedPort?: number }[];
}

async function cmdStatus(): Promise<number> {
  const { code, stdout } = await composeCapture(['--profile', 'all', 'ps', '-a', '--format', 'json']);
  if (code !== 0) return code;

  const rows: ComposePsRow[] = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as ComposePsRow);

  title('Estado de los servicios');
  for (const svc of services) {
    const row = rows.find((r) => r.Service === svc.key);
    if (!row) {
      console.log(`  ${c.dim}○ ${svc.label.padEnd(10)} no creado${c.reset}`);
      continue;
    }
    const health = row.Health ? ` (${row.Health})` : '';
    const running = row.State === 'running';
    const mark = running ? `${c.green}●${c.reset}` : `${c.yellow}●${c.reset}`;
    console.log(`  ${mark} ${svc.label.padEnd(10)} ${row.State}${health} → puertos ${svc.ports.join(', ')}`);
  }
  return 0;
}

async function cmdLogs(names: string[], follow: boolean): Promise<number> {
  const targets = resolve(names, { allowEmpty: true });
  return compose(['logs', ...(follow ? ['-f'] : ['--tail', '100']), ...targets.map((s) => s.key)]);
}

async function cmdCheck(names: string[]): Promise<number> {
  const targets = resolve(names, { allowEmpty: true });
  title('Chequeo de conexión');
  let failed = 0;
  for (const svc of targets) {
    try {
      const detail = await svc.check();
      ok(`${svc.label.padEnd(10)} ${c.dim}${detail}${c.reset}`);
    } catch (error) {
      failed++;
      fail(`${svc.label.padEnd(10)} ${(error as Error).message}`);
    }
  }
  return failed === 0 ? 0 : 1;
}

const SHELLS: Record<string, string[]> = {
  mongo: ['mongosh', '-u', env.mongo.user, '-p', env.mongo.password, '--authenticationDatabase', 'admin'],
  redis: ['redis-cli', '-a', env.redis.password],
  neo4j: ['cypher-shell', '-u', env.neo4j.user, '-p', env.neo4j.password],
  cassandra: ['cqlsh'],
};

async function cmdShell(names: string[]): Promise<number> {
  const [svc] = resolve(names);
  if (!svc) throw new Error('Indicá un servicio');
  const cmd = SHELLS[svc.key];
  if (!cmd) throw new Error(`No hay shell definida para ${svc.key}`);
  const { spawn } = await import('node:child_process');
  return new Promise((resolve_) => {
    const child = spawn('docker', ['exec', '-it', svc.container, ...cmd], { stdio: 'inherit' });
    child.on('close', (code) => resolve_(code ?? 1));
    child.on('error', () => resolve_(1));
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const flags = argv.filter((a) => a.startsWith('-'));
  const rest = argv.slice(1).filter((a) => !a.startsWith('-'));
  const follow = flags.includes('-f') || flags.includes('--follow');

  let exitCode = 0;

  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      usage();
      break;
    case 'list':
      title('Servicios disponibles');
      for (const svc of services) {
        console.log(`  ${svc.key.padEnd(10)} ${svc.label.padEnd(10)} puertos ${svc.ports.join(', ')}`);
      }
      break;
    case 'up':
      exitCode = await cmdUp(rest);
      break;
    case 'down':
      exitCode = await cmdDown(rest, false);
      break;
    case 'reset':
      exitCode = await cmdDown(rest, true);
      break;
    case 'restart':
      exitCode = (await cmdDown(rest, false)) || (await cmdUp(rest));
      break;
    case 'status':
    case 'ps':
      exitCode = await cmdStatus();
      break;
    case 'logs':
      exitCode = await cmdLogs(rest, follow);
      break;
    case 'check':
      exitCode = await cmdCheck(rest);
      break;
    case 'info':
      for (const svc of resolve(rest, { allowEmpty: true })) printInfo(svc);
      break;
    case 'shell':
      exitCode = await cmdShell(rest);
      break;
    case 'keyspace':
      await createKeyspace();
      ok(`Keyspace '${env.cassandra.keyspace}' listo`);
      break;
    default:
      fail(`Comando desconocido: "${command}"`);
      usage();
      exitCode = 1;
  }

  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  fail((error as Error).message);
  process.exitCode = 1;
});
