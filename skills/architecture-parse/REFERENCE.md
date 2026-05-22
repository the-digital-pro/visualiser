# architecture-parse — reference

Detail tables for the parsing heuristics, layout grid, and canonical output
format. Linked from [SKILL.md](SKILL.md).

## Detection heuristics

The classifications below are *hints*, not rules. If a project's
`ARCHITECTURE.md`, `docs/adr/`, or README contradicts a heuristic, defer to
the documented intent.

### Node enum (memorise — these are the only kinds)

`actor`, `system`, `application`, `service`, `datastore`, `queue`, `infra`, `group`.

### Edge type enum

`rest`, `graphql`, `grpc`, `jdbc`, `async`, `file`, `auth`, `generic`.

### From `package.json` (Node / JavaScript / TypeScript)

| Dependency signal | Suggested node | Edge / tag hint |
|---|---|---|
| `react`, `vue`, `svelte`, `solid-js`, `preact` | `application` (SPA) | tag `client` |
| `next`, `remix`, `nuxt`, `astro`, `sveltekit` | `application` spanning SPA + API → consider splitting into application + service nodes | mixed |
| `express`, `fastify`, `koa`, `hono`, `@nestjs/*`, `oak` | `service` (HTTP API) | inbound `rest` |
| `apollo-server`, `graphql-yoga`, `mercurius`, `@apollo/server` | `service` (GraphQL) | inbound `graphql` |
| `@grpc/grpc-js`, `grpc-tools` | `service` (gRPC) | inbound `grpc` |
| `socket.io`, `ws`, `bun-ws`, `uWebSockets.js` | `service` (WebSocket / push) | outbound `async` |
| `pg`, `postgres`, `prisma`, `drizzle-orm`, `kysely`, `@neondatabase/serverless` | `datastore` (Postgres) | `jdbc` |
| `mysql`, `mysql2`, `mariadb` | `datastore` (MySQL) | `jdbc` |
| `mongodb`, `mongoose` | `datastore` (MongoDB) | `jdbc` |
| `redis`, `ioredis`, `@upstash/redis` | `datastore` tag `cache` (Redis) | `jdbc` |
| `bullmq`, `bull`, `agenda`, `bee-queue` | `queue` | `async` |
| `kafkajs`, `node-rdkafka` | `queue` (Kafka) | `async` |
| `amqplib` | `queue` (RabbitMQ) | `async` |
| `@google-cloud/pubsub`, `aws-sdk/client-sns`, `aws-sdk/client-sqs` | `queue` (managed pub/sub) | `async` |
| `@aws-sdk/*`, `@google-cloud/*`, `@azure/*` | `infra` (cloud) — be specific (`@aws-sdk/client-s3` → datastore "S3") | varies |
| `vite`, `webpack`, `turbopack`, `esbuild`, `rollup`, `parcel`, `bun build` | `infra` (build) | `file` |
| `auth0`, `@clerk/*`, `next-auth`, `passport`, `@supabase/supabase-js#auth` | `system` (auth provider) | `auth` |
| `stripe`, `@adyen/api-library`, `paddle` | `system` (payments, external) | outbound `rest` |
| `@sentry/*`, `posthog-js`, `mixpanel`, `@datadog/*` | `system` (observability / analytics, external) | outbound `async` |
| `tailwindcss`, `next-themes`, `shadcn`, `@radix-ui/*` | fold into the SPA application node — don't create separate nodes | — |

### From `pyproject.toml` / `requirements.txt`

| Dep | Node | Edge |
|---|---|---|
| `fastapi`, `flask`, `django`, `aiohttp`, `starlette`, `sanic` | `service` | `rest` |
| `strawberry-graphql`, `graphene` | `service` | `graphql` |
| `sqlalchemy`, `psycopg2`, `psycopg`, `asyncpg` | `datastore` (Postgres) | `jdbc` |
| `pymongo`, `motor` | `datastore` (Mongo) | `jdbc` |
| `redis`, `aioredis` | `datastore` (Redis, `cache` tag) | `jdbc` |
| `celery`, `kafka-python`, `aiokafka`, `pika`, `confluent-kafka` | `queue` | `async` |
| `boto3`, `google-cloud-*`, `azure-sdk-for-python` | `infra` (cloud) | varies |
| `httpx`, `requests`, `aiohttp` (as client) | implies outbound HTTP; tag the source node | `rest` |

### From `Cargo.toml`

| Crate | Node | Edge |
|---|---|---|
| `axum`, `actix-web`, `rocket`, `warp`, `tide`, `poem` | `service` | `rest` |
| `tonic` | `service` (gRPC) | `grpc` |
| `async-graphql` | `service` (GraphQL) | `graphql` |
| `sqlx`, `diesel`, `sea-orm`, `tokio-postgres` | `datastore` (Postgres unless feature gates differ) | `jdbc` |
| `redis`, `bb8-redis`, `deadpool-redis` | `datastore` (Redis) | `jdbc` |
| `lapin` (AMQP), `rdkafka` | `queue` | `async` |
| `aws-sdk-*`, `google-cloud-*` | `infra` | varies |

### From `go.mod`

| Module path prefix | Node | Edge |
|---|---|---|
| `github.com/gin-gonic/gin`, `github.com/labstack/echo`, `github.com/gofiber/fiber`, `github.com/go-chi/chi` | `service` | `rest` |
| `google.golang.org/grpc` | `service` (gRPC) | `grpc` |
| `github.com/99designs/gqlgen` | `service` (GraphQL) | `graphql` |
| `github.com/jackc/pgx`, `gorm.io/gorm`, `entgo.io/ent` | `datastore` (Postgres) | `jdbc` |
| `github.com/redis/go-redis` | `datastore` (Redis) | `jdbc` |
| `github.com/segmentio/kafka-go`, `github.com/IBM/sarama` | `queue` (Kafka) | `async` |
| `github.com/aws/aws-sdk-go`, `cloud.google.com/go` | `infra` | varies |

### From `pom.xml` / `build.gradle` (Maven / Gradle / Spring)

| Dep group | Node | Edge |
|---|---|---|
| `org.springframework.boot:*-web` | `service` | `rest` |
| `org.springframework.boot:*-graphql` | `service` | `graphql` |
| `org.springframework.boot:*-data-jpa`, `org.postgresql:postgresql` | `datastore` (Postgres) | `jdbc` |
| `org.springframework.kafka:*`, `org.apache.kafka:*` | `queue` (Kafka) | `async` |
| `redis.clients:jedis`, `io.lettuce:lettuce-core` | `datastore` (Redis) | `jdbc` |

### From source layout (language-agnostic)

| Path / pattern | Implication |
|---|---|
| `src/components/` AND (`src/pages/` OR `app/`) | SPA application node, internal pages worth a drill-down |
| `routes/`, `app/api/`, `src/api/`, `pages/api/`, `app/routes/` | API surface — one or more `service` nodes |
| `prisma/schema.prisma`, `drizzle.config.*`, `migrations/*.sql`, `db/migrate/`, `alembic/` | At least one `datastore` |
| `infra/`, `terraform/`, `k8s/`, `helm/`, `pulumi/`, `cdk/` | Add `infra` nodes for any obviously-named system (CDN, queue, datastore) referenced in the IaC |
| `public/`, `static/`, `assets/` accompanied by CDN config / `wrangler.toml` / `vercel.json` | `infra` (CDN) |
| `Dockerfile`, `docker-compose.yml` | Containerised deployment — doesn't add a node by itself, but each `docker-compose` service is a hint |
| `.github/workflows/`, `gitlab-ci.yml` | CI — usually omit unless the user wants it foregrounded |
| `docs/adr/`, `ARCHITECTURE.md`, `README.md` (architecture section) | **Read these first**. Let documented intent override your heuristics. |

### External actors (always include at least one)

| Hint | Actor name suggestion |
|---|---|
| Public web UI present (any SPA) | "End user" |
| Webhook endpoints (`/webhook/`, `webhooks/`) | "Webhook source" |
| Internal admin UI / `/admin/` routes | "Admin operator" |
| CLI binary (`bin/` + `package.json#bin` / Cargo `[[bin]]` / Go `cmd/`) | "Operator" |
| Sensor / device / IoT ingest (MQTT, CoAP, custom TCP) | "Device" |

## Layout

### The 20px grid

- Every `position.x` and `position.y` must be a multiple of 20.
- Recommended column x-coordinates: `0, 320, 640, 960, 1280`.
- Recommended row y-coordinates: `60, 200, 340, 480`.

### Default placement template

```
+-------------------+--------------------+--------------------+
|  Actor (left)     |  Subject system    |  External system   |
|  e.g. End user    |  e.g. Your SPA     |  e.g. Auth         |
|  x=0,   y=200     |  x=320, y=200      |  x=960, y=100      |
|                   |  (childDiagramId)  |                    |
|                   |                    |  External system   |
|                   |                    |  e.g. Payments     |
|                   |                    |  x=960, y=300      |
+-------------------+--------------------+--------------------+
```

Adjust as needed. Two principles:

1. **Left-to-right flow**: external actors on the left, subject in the
   middle, externals you call on the right.
2. **No overlaps**: nodes are typically ~180×80 — keep at least 60px
   horizontal and 80px vertical spacing.

### Diagram conventions

- **Context** diagram: ≤10 nodes. One-sentence node descriptions.
- **Drill-down** diagrams: focused on internals of one parent node;
  reference the parent via `childDiagramId` on the parent node.
- Each drill-down should have ≤12 nodes. Split further if exceeded.
- Use `kind: "group"` sparingly — only when ≥3 sibling nodes share a clear
  containment relationship (Kubernetes namespace, layered group like
  "Pages"). Children point at the group via `parentId`. Nested groups are
  not allowed in v1.

## Output format

### Canonical key order (mandatory — produces byte-identical round-trip)

**Project (top level):**
1. `schemaVersion` (always `1`)
2. `id`
3. `name`
4. `description` *(omit if missing)*
5. `owners` *(omit if missing)*
6. `tags` *(omit if missing)*
7. `homeDiagramId`
8. `diagrams`
9. `tours` — required: emit the start-to-finish walkthrough as `tours[0]`. Additional themed tours optional.

**Tour:**
1. `id` (the walkthrough tour must use `walkthrough`)
2. `name`
3. `description` *(omit if missing)*
4. `stops`

**TourStop:**
1. `ref` — `projectId:diagramId` or `projectId:diagramId:nodeId`
2. `note` — one or two plain-English sentences

**Diagram:**
1. `id`
2. `name`
3. `description` *(omit if missing)*
4. `nodes`
5. `edges`

**Node:**
1. `id`
2. `kind`
3. `name`
4. `description` *(omit if missing)*
5. `parentId` *(omit if missing)*
6. `childDiagramId` *(omit if missing)*
7. `tags` *(omit if missing)*
8. `position`
9. `metadata` *(omit if missing)*

**Edge:**
1. `id`
2. `source`
3. `target` *(XOR with `targetRef` — exactly one)*
4. `targetRef` *(XOR with `target` — exactly one; format `projectId:diagramId:nodeId`)*
5. `type`
6. `label` *(omit if missing)*
7. `tags` *(omit if missing)*
8. `metadata` *(omit if missing)*

### Formatting rules

- JSON indented with **2 spaces**.
- **Trailing newline** at end of file (single `\n`, not blank line).
- Omit any field whose value is `undefined` / missing — do **not** emit
  `null`.
- Arrays preserve the order you write them in. Order nodes meaningfully
  (actors first, system-under-design second, externals third). Order edges
  in flow order.

### Constraints (any violation = build failure)

- `id` at project / diagram / node level: must match `^[a-z0-9][a-z0-9-]*$`.
- Edges: **exactly one** of `target` or `targetRef` (XOR).
- `targetRef` format: `projectId:diagramId:nodeId` with all three present.
- `kind` ∈ {`actor`, `system`, `application`, `service`, `datastore`,
  `queue`, `infra`, `group`}.
- `type` ∈ {`rest`, `graphql`, `grpc`, `jdbc`, `async`, `file`, `auth`,
  `generic`}.
- Every diagram must have ≥1 node.
- `homeDiagramId` must reference one of the project's diagram ids.
- `parentId`, if set, must point at a `group` node in the same diagram.
  Nested groups (group inside group) are rejected by structural validation
  in v1.

## Validation

The architecture-visualizer's Vite plugin validates every project JSON at
build time. After writing:

```bash
# from the visualizer repo
npm run build
```

Build failure → schema mismatch. The error message includes `issue.path`
pointing at the offending field. Tier-2 (referential) and tier-3 (soft)
issues — dangling refs, orphan nodes, missing positions — won't fail the
build but appear in the editor's Validation panel.
