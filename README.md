# bd-base

**Sandbox local de bases de datos NoSQL para hacer pruebas.** Una CLI que levanta MongoDB, Redis, Neo4j y Cassandra en Docker — cada una por separado, en segundos, sin instalar nada en tu máquina.

## Para qué sirve

Cuando querés probar algo — una query, un modelo de datos, un driver, un ejercicio de la facultad, una idea antes de meterla en un proyecto real — necesitás una base corriendo. Instalarla localmente ensucia la máquina; escribir un `docker-compose` desde cero cada vez es tedioso; levantar las cuatro juntas se come la RAM al pedo.

Este proyecto resuelve eso:

- **Una base a la vez.** `pnpm bd up mongo` levanta sólo MongoDB. Las otras tres ni se enteran (`docker compose` con *profiles*).
- **Espera a que esté lista.** El comando no vuelve hasta que el healthcheck pasa, así que no probás contra una base que todavía está booteando.
- **Verifica de verdad.** `pnpm bd check` se conecta desde Node con los drivers oficiales (`mongodb`, `ioredis`, `neo4j-driver`, `cassandra-driver`) y hace un ping real, no un `docker ps`.
- **Te tira adentro de la consola.** `pnpm bd shell neo4j` abre `cypher-shell` en el contenedor. Cero clientes instalados en tu Mac.
- **Datos descartables.** Persisten en volúmenes entre `up`/`down`; `pnpm bd reset` borra todo y arrancás de cero.

No hay servidor ni API: es puro tooling. El README de abajo incluye además una guía rápida de cada consola (`mongosh`, `redis-cli`, `cypher-shell`, `cqlsh`) con los primeros comandos de cada una.

Bases incluidas: **MongoDB**, **Redis**, **Neo4j** y **Cassandra**.

---

## Requisitos

- Docker Desktop corriendo (`docker info` debe responder)
- Node >= 20
- pnpm >= 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

## Instalación

```bash
pnpm install
cp .env.example .env   # ya viene copiado; editá puertos/credenciales si hace falta
```

## Uso

```bash
pnpm bd <comando> [servicio...]
```

| Comando | Qué hace |
|---|---|
| `list` | Lista los servicios disponibles |
| `up <svc...\|all>` | Levanta y **espera** a que queden healthy |
| `down <svc...\|all>` | Frena y elimina los contenedores (los datos se conservan) |
| `restart <svc...\|all>` | `down` + `up` |
| `status` | Estado de todos los contenedores |
| `logs <svc> [-f]` | Logs (`-f` para seguirlos) |
| `check [svc...]` | Prueba la conexión real desde Node |
| `info [svc...]` | Datos de conexión |
| `shell <svc>` | Abre el cliente nativo dentro del contenedor |
| `keyspace` | Crea el keyspace de Cassandra |
| `reset <svc...\|all>` | **Borra contenedores y volúmenes (se pierden los datos)** |

### Ejemplos

```bash
pnpm bd up mongo            # solo MongoDB
pnpm bd up redis neo4j      # dos a la vez
pnpm bd up all              # las cuatro
pnpm bd check               # ¿conectan todas?
pnpm bd shell mongo         # mongosh dentro del contenedor
pnpm bd logs cassandra -f
pnpm bd down mongo          # baja MongoDB, los datos quedan
```

---

## Conectarse por consola a cada base

Los clientes (`mongosh`, `redis-cli`, `cypher-shell`, `cqlsh`) **ya vienen dentro de cada imagen**: no hace falta instalar nada en tu Mac.

Atajo de la CLI del proyecto — abre la consola nativa de la base, en modo interactivo:

```bash
pnpm bd shell mongo
pnpm bd shell redis
pnpm bd shell neo4j
pnpm bd shell cassandra
```

Cada uno es un `docker exec -it` por debajo. El detalle por base, con el comando crudo equivalente, está abajo.

---

### MongoDB — `mongosh`

```bash
# Interactivo
pnpm bd shell mongo
# equivale a:
docker exec -it bd-mongo mongosh -u root -p root --authenticationDatabase admin

# Entrando directo a la base 'sandbox'
docker exec -it bd-mongo mongosh -u root -p root --authenticationDatabase admin sandbox

# Una sola consulta, sin entrar al shell
docker exec bd-mongo mongosh -u root -p root --authenticationDatabase admin --quiet \
  --eval 'db.getMongo().getDBNames()'
```

Primeros comandos dentro de `mongosh`:

```javascript
show dbs                                  // lista de bases
use sandbox                                  // se crea recién al insertar algo
db.alumnos.insertOne({ nombre: "Ana" })
db.alumnos.find()
show collections
exit                                      // salir
```

> `MONGO_INITDB_DATABASE=sandbox` no crea la base vacía: MongoDB la materializa con el primer insert. Por eso `show dbs` al principio muestra sólo `admin`, `config` y `local`.

---

### Redis — `redis-cli`

```bash
# Interactivo
pnpm bd shell redis
# equivale a:
docker exec -it bd-redis redis-cli -a redis

# Un solo comando (--no-auth-warning silencia el aviso por pasar la password en la línea)
docker exec bd-redis redis-cli --no-auth-warning -a redis PING
```

Primeros comandos dentro de `redis-cli`:

```
PING                        -> PONG
SET alumno:1 "Ana"
GET alumno:1
KEYS *                      # OK en local; en producción se usa SCAN
TTL alumno:1
EXPIRE alumno:1 60
DEL alumno:1
FLUSHALL                    # borra TODO lo que hay en Redis
INFO server
exit
```

> Si entrás sin `-a`, cualquier comando responde `NOAUTH Authentication required.`. Se arregla con `AUTH redis` como primer comando.

---

### Neo4j — `cypher-shell` (o el browser web)

```bash
# Interactivo
pnpm bd shell neo4j
# equivale a:
docker exec -it bd-neo4j cypher-shell -u neo4j -p neo4jpassword

# Una sola consulta
docker exec bd-neo4j cypher-shell -u neo4j -p neo4jpassword "RETURN 'ok' AS estado;"

# Eligiendo base (Neo4j 5 es multi-base: 'neo4j' es la default, 'system' la de administración)
docker exec -it bd-neo4j cypher-shell -u neo4j -p neo4jpassword -d neo4j
```

Primeras consultas dentro de `cypher-shell` (**cada una termina en `;`**):

```cypher
SHOW DATABASES;
CREATE (a:Alumno {nombre: "Ana"});
MATCH (a:Alumno) RETURN a;
MATCH (a:Alumno {nombre: "Ana"})
CREATE (m:Curso {nombre: "NoSQL"})
CREATE (a)-[:CURSA]->(m);
MATCH (a)-[r]->(b) RETURN a, r, b;
MATCH (n) DETACH DELETE n;              // vacía el grafo
:exit
```

**Alternativa gráfica:** abrí <http://localhost:7474> en el navegador y logueate con `neo4j` / `neo4jpassword`. Es el Neo4j Browser: misma consola de Cypher pero dibujando el grafo. Para explorar grafos suele ser más cómodo que la terminal.

---

### Cassandra — `cqlsh`

La imagen tarda ~1 minuto en quedar healthy después del `up`. `pnpm bd up` te espera solo.

```bash
pnpm bd up cassandra
pnpm bd keyspace          # crea el keyspace 'sandbox' con replication_factor 1

# Interactivo
pnpm bd shell cassandra
# equivale a:
docker exec -it bd-cassandra cqlsh

# Una sola consulta
docker exec bd-cassandra cqlsh -e "DESCRIBE KEYSPACES;"
```

Primeros comandos dentro de `cqlsh` (**cada uno termina en `;`**):

```sql
DESCRIBE KEYSPACES;
USE sandbox;

CREATE TABLE alumnos (
  id uuid PRIMARY KEY,
  nombre text
);

INSERT INTO alumnos (id, nombre) VALUES (uuid(), 'Ana');
SELECT * FROM alumnos;
DESCRIBE TABLES;
DESCRIBE TABLE alumnos;
exit
```

> Cassandra no crea keyspaces solos. Si no corriste `pnpm bd keyspace`, hacelo a mano:
> ```sql
> CREATE KEYSPACE sandbox WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};
> ```
> `SimpleStrategy` con factor 1 sirve porque es un solo nodo.

---

### Conectarse desde tu Mac en vez de desde el contenedor

Todos los puertos están publicados en `localhost`, así que si preferís los clientes instalados localmente:

```bash
brew install mongosh redis          # redis trae redis-cli
brew install cassandra             # trae cqlsh
# cypher-shell viene con Neo4j Desktop, o usá el browser en :7474

mongosh "mongodb://root:root@localhost:27017/?authSource=admin"
redis-cli -h localhost -p 6379 -a redis
cqlsh localhost 9042
```

Para clientes gráficos (MongoDB Compass, DBeaver, RedisInsight) usá los mismos host/puerto/credenciales de la tabla de abajo.

### Salir de cada consola

| Base | Cómo salir |
|---|---|
| mongosh | `exit` o `Ctrl-D` |
| redis-cli | `exit` o `Ctrl-D` |
| cypher-shell | `:exit` o `Ctrl-D` |
| cqlsh | `exit` o `Ctrl-D` |

Salir de la consola **no** frena la base. Para eso: `pnpm bd down <svc>`.

---

## Cómo funciona el aislamiento

`docker-compose.yml` usa **profiles**: ningún servicio arranca con un `docker compose up` pelado. Cada servicio sólo se levanta cuando lo nombrás explícitamente, y así podés correr una sola base sin tocar las demás.

Equivalentes en Docker puro, si querés saltear la CLI:

```bash
docker compose up -d --wait mongo
docker compose rm -f -s mongo
docker compose --profile all ps -a
```

## Datos de conexión por defecto

| Base | Puerto(s) | Credenciales |
|---|---|---|
| MongoDB | 27017 | `root` / `root` (authSource `admin`) |
| Redis | 6379 | password `redis` |
| Neo4j | 7474 (HTTP), 7687 (Bolt) | `neo4j` / `neo4jpassword` |
| Cassandra | 9042 | sin auth, DC `datacenter1` |

Todo configurable en `.env`. Los datos persisten en volúmenes nombrados de Docker (`bd-base_mongo-data`, etc.) y sobreviven a `down`.

## Estructura

```
docker-compose.yml     los 4 servicios, cada uno con su profile y healthcheck
.env / .env.example    puertos y credenciales
src/cli.ts             la CLI
src/docker.ts          wrapper de `docker compose`
src/env.ts             config tipada + URIs de conexión
src/services/          una definición por base (puertos, conexión, check)
```

## Build

```bash
pnpm typecheck
pnpm build && pnpm start status
```
