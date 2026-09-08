# bd-base

**A local NoSQL database sandbox for testing things out.** A CLI that spins up MongoDB, Redis, Neo4j and Cassandra in Docker — each one on its own, in seconds, with nothing installed on your machine.

## What it's for

Whenever you want to try something out — a query, a data model, a driver, a homework exercise, an idea before it goes into a real project — you need a database running. Installing one locally clutters your machine; writing a `docker-compose` file from scratch every time is tedious; and starting all four at once eats your RAM for nothing.

This project fixes that:

- **One database at a time.** `pnpm bd up mongo` starts MongoDB only. The other three never even wake up (`docker compose` *profiles*).
- **Waits until it's actually ready.** The command doesn't return until the healthcheck passes, so you never test against a database that's still booting.
- **Verifies for real.** `pnpm bd check` connects from Node using the official drivers (`mongodb`, `ioredis`, `neo4j-driver`, `cassandra-driver`) and does a real ping — not a `docker ps`.
- **Drops you straight into the shell.** `pnpm bd shell neo4j` opens `cypher-shell` inside the container. Zero clients installed on your machine.
- **Throwaway data.** It persists in volumes across `up`/`down`; `pnpm bd reset` wipes everything so you start from scratch.

There's no server and no API: it's pure tooling. The rest of this README also includes a quick tour of each database shell (`mongosh`, `redis-cli`, `cypher-shell`, `cqlsh`) with the first commands you'll want in each one.

Databases included: **MongoDB**, **Redis**, **Neo4j** and **Cassandra**.

---

## Requirements

- Docker Desktop running (`docker info` must respond)
- Node >= 20
- pnpm >= 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

## Install

```bash
pnpm install
cp .env.example .env   # edit ports/credentials if you need to
```

## Usage

```bash
pnpm bd <command> [service...]
```

| Command | What it does |
|---|---|
| `list` | Lists the available services |
| `up <svc...\|all>` | Starts them and **waits** until they're healthy |
| `down <svc...\|all>` | Stops and removes the containers (data is kept) |
| `restart <svc...\|all>` | `down` + `up` |
| `status` | Status of every container |
| `logs <svc> [-f]` | Logs (`-f` to follow them) |
| `check [svc...]` | Tests a real connection from Node |
| `info [svc...]` | Connection details |
| `shell <svc>` | Opens the native client inside the container |
| `keyspace` | Creates the Cassandra keyspace |
| `reset <svc...\|all>` | **Deletes containers and volumes (data is lost)** |

### Examples

```bash
pnpm bd up mongo            # MongoDB only
pnpm bd up redis neo4j      # two at once
pnpm bd up all              # all four
pnpm bd check               # do they all connect?
pnpm bd shell mongo         # mongosh inside the container
pnpm bd logs cassandra -f
pnpm bd down mongo          # stops MongoDB, data stays
```

---

## Connecting to each database from the console

The clients (`mongosh`, `redis-cli`, `cypher-shell`, `cqlsh`) **already ship inside each image**: you don't need to install anything locally.

Shortcut from the project CLI — opens the database's native shell, interactively:

```bash
pnpm bd shell mongo
pnpm bd shell redis
pnpm bd shell neo4j
pnpm bd shell cassandra
```

Each one is a `docker exec -it` underneath. The per-database detail, with the raw equivalent command, is below.

---

### MongoDB — `mongosh`

```bash
# Interactive
pnpm bd shell mongo
# equivalent to:
docker exec -it bd-mongo mongosh -u root -p root --authenticationDatabase admin

# Going straight into the 'sandbox' database
docker exec -it bd-mongo mongosh -u root -p root --authenticationDatabase admin sandbox

# A single query, without entering the shell
docker exec bd-mongo mongosh -u root -p root --authenticationDatabase admin --quiet \
  --eval 'db.getMongo().getDBNames()'
```

First commands inside `mongosh`:

```javascript
show dbs                                  // list of databases
use sandbox                               // only created once you insert something
db.students.insertOne({ name: "Ana" })
db.students.find()
show collections
exit                                      // quit
```

> `MONGO_INITDB_DATABASE=sandbox` does not create an empty database: MongoDB materializes it on the first insert. That's why `show dbs` initially shows only `admin`, `config` and `local`.

---

### Redis — `redis-cli`

```bash
# Interactive
pnpm bd shell redis
# equivalent to:
docker exec -it bd-redis redis-cli -a redis

# A single command (--no-auth-warning silences the warning about passing the password on the command line)
docker exec bd-redis redis-cli --no-auth-warning -a redis PING
```

First commands inside `redis-cli`:

```
PING                        -> PONG
SET student:1 "Ana"
GET student:1
KEYS *                      # fine locally; use SCAN in production
TTL student:1
EXPIRE student:1 60
DEL student:1
FLUSHALL                    # wipes EVERYTHING in Redis
INFO server
exit
```

> If you connect without `-a`, every command answers `NOAUTH Authentication required.`. Fix it by running `AUTH redis` as your first command.

---

### Neo4j — `cypher-shell` (or the web browser)

```bash
# Interactive
pnpm bd shell neo4j
# equivalent to:
docker exec -it bd-neo4j cypher-shell -u neo4j -p neo4jpassword

# A single query
docker exec bd-neo4j cypher-shell -u neo4j -p neo4jpassword "RETURN 'ok' AS status;"

# Choosing a database (Neo4j 5 is multi-database: 'neo4j' is the default, 'system' the admin one)
docker exec -it bd-neo4j cypher-shell -u neo4j -p neo4jpassword -d neo4j
```

First queries inside `cypher-shell` (**each one ends with `;`**):

```cypher
SHOW DATABASES;
CREATE (a:Student {name: "Ana"});
MATCH (a:Student) RETURN a;
MATCH (a:Student {name: "Ana"})
CREATE (c:Course {name: "NoSQL"})
CREATE (a)-[:ENROLLED_IN]->(c);
MATCH (a)-[r]->(b) RETURN a, r, b;
MATCH (n) DETACH DELETE n;              // empties the graph
:exit
```

**Graphical alternative:** open <http://localhost:7474> in your browser and log in with `neo4j` / `neo4jpassword`. That's the Neo4j Browser: the same Cypher console, but it draws the graph. For exploring graphs it's usually more comfortable than the terminal.

---

### Cassandra — `cqlsh`

The image takes ~1 minute to become healthy after `up`. `pnpm bd up` waits for you.

```bash
pnpm bd up cassandra
pnpm bd keyspace          # creates the 'sandbox' keyspace with replication_factor 1

# Interactive
pnpm bd shell cassandra
# equivalent to:
docker exec -it bd-cassandra cqlsh

# A single query
docker exec bd-cassandra cqlsh -e "DESCRIBE KEYSPACES;"
```

First commands inside `cqlsh` (**each one ends with `;`**):

```sql
DESCRIBE KEYSPACES;
USE sandbox;

CREATE TABLE students (
  id uuid PRIMARY KEY,
  name text
);

INSERT INTO students (id, name) VALUES (uuid(), 'Ana');
SELECT * FROM students;
DESCRIBE TABLES;
DESCRIBE TABLE students;
exit
```

> Cassandra doesn't create keyspaces on its own. If you didn't run `pnpm bd keyspace`, do it by hand:
> ```sql
> CREATE KEYSPACE sandbox WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};
> ```
> `SimpleStrategy` with factor 1 works here because it's a single node.

---

### Connecting from your machine instead of from the container

Every port is published on `localhost`, so if you'd rather use locally installed clients:

```bash
brew install mongosh redis          # redis ships redis-cli
brew install cassandra              # ships cqlsh
# cypher-shell comes with Neo4j Desktop, or just use the browser on :7474

mongosh "mongodb://root:root@localhost:27017/?authSource=admin"
redis-cli -h localhost -p 6379 -a redis
cqlsh localhost 9042
```

For GUI clients (MongoDB Compass, DBeaver, RedisInsight) use the same host/port/credentials from the table below.

### Exiting each shell

| Database | How to exit |
|---|---|
| mongosh | `exit` or `Ctrl-D` |
| redis-cli | `exit` or `Ctrl-D` |
| cypher-shell | `:exit` or `Ctrl-D` |
| cqlsh | `exit` or `Ctrl-D` |

Leaving the shell does **not** stop the database. For that: `pnpm bd down <svc>`.

---

## How the isolation works

`docker-compose.yml` uses **profiles**: no service starts on a bare `docker compose up`. Each service only comes up when you name it explicitly, so you can run a single database without touching the others.

Plain Docker equivalents, if you'd rather skip the CLI:

```bash
docker compose up -d --wait mongo
docker compose rm -f -s mongo
docker compose --profile all ps -a
```

## Default connection details

| Database | Port(s) | Credentials |
|---|---|---|
| MongoDB | 27017 | `root` / `root` (authSource `admin`) |
| Redis | 6379 | password `redis` |
| Neo4j | 7474 (HTTP), 7687 (Bolt) | `neo4j` / `neo4jpassword` |
| Cassandra | 9042 | no auth, DC `datacenter1` |

All configurable in `.env`. Data lives in named Docker volumes (`bd-base_mongo-data`, etc.) and survives `down`.

## Structure

```
docker-compose.yml     the 4 services, each with its profile and healthcheck
.env / .env.example    ports and credentials
src/cli.ts             the CLI
src/docker.ts          `docker compose` wrapper
src/env.ts             typed config + connection URIs
src/services/          one definition per database (ports, connection, check)
```

## Build

```bash
pnpm typecheck
pnpm build && pnpm start status
```

## License

[MIT](LICENSE) © Gianni Mazzeo
