# architecture-parse — examples

A single worked example. Walks a typical React + Node monorepo from
discovery → emitted JSON. Use this as a template for new applications of
the skill; the [REFERENCE.md](REFERENCE.md) tables cover the
classifications.

---

## Input: a sample monorepo

```
acme-saas/
├── package.json              # workspaces: ["apps/*", "packages/*"]
├── pnpm-workspace.yaml
├── apps/
│   ├── web/                  # React SPA (Vite, TanStack Query, Zustand)
│   │   └── package.json      # react, @tanstack/react-query, zustand, @clerk/clerk-react
│   └── api/                  # Fastify API (TypeScript)
│       └── package.json      # fastify, drizzle-orm, pg, ioredis, bullmq, stripe
├── packages/
│   └── shared-types/
└── infra/
    ├── terraform/            # AWS: CloudFront, RDS Postgres, ElastiCache, SQS
    └── README.md
```

### Discovery checklist (what the parsing agent does)

- [x] Read `pnpm-workspace.yaml` → monorepo, single project JSON output.
- [x] Read `apps/web/package.json` → React SPA, TanStack Query (server
      state), Zustand (client state), Clerk (auth provider).
- [x] Read `apps/api/package.json` → Fastify (service, inbound `rest`),
      Drizzle ORM + `pg` (datastore Postgres, `jdbc`), `ioredis` (cache),
      `bullmq` (queue), `stripe` (external payments).
- [x] Read `infra/terraform/` → confirms CloudFront (CDN), RDS Postgres,
      ElastiCache (Redis), SQS (queue alternative).
- [x] External actor: "End user" (web SPA present).

### Plan

- **Context diagram** (`context`): 7 boxes — End user, CDN, Web (SPA), API
  (service), Postgres (datastore), Clerk (auth), Stripe (payments). The
  Web and API nodes drill into `frontend` and `backend` respectively.
- **Frontend diagram** (`frontend`): Vite (infra), entry, router, state,
  query, shared components, design system.
- **Backend diagram** (`backend`): Fastify server, auth middleware, domain
  services, Postgres, Redis cache, BullMQ queue.

---

## Output

```json
{
  "schemaVersion": 1,
  "id": "acme-saas",
  "name": "Acme SaaS",
  "description": "React SPA + Fastify API monorepo. Auth via Clerk, payments via Stripe.",
  "tags": [
    "monorepo",
    "react",
    "node-js"
  ],
  "homeDiagramId": "context",
  "diagrams": [
    {
      "id": "context",
      "name": "System context",
      "description": "Top-level view. Drill into Web or API for internals.",
      "nodes": [
        {
          "id": "user",
          "kind": "actor",
          "name": "End user",
          "description": "Customer accessing Acme SaaS via a modern browser.",
          "position": {
            "x": 0,
            "y": 200
          }
        },
        {
          "id": "cdn",
          "kind": "infra",
          "name": "CDN",
          "description": "CloudFront edge caching the SPA bundle and static assets.",
          "tags": [
            "edge"
          ],
          "position": {
            "x": 320,
            "y": 60
          }
        },
        {
          "id": "web",
          "kind": "application",
          "name": "Web (SPA)",
          "description": "React + Vite single-page app. Drill in for internal layering.",
          "childDiagramId": "frontend",
          "tags": [
            "client"
          ],
          "position": {
            "x": 320,
            "y": 200
          }
        },
        {
          "id": "api",
          "kind": "service",
          "name": "API",
          "description": "Fastify service. Drill in for internal layering.",
          "childDiagramId": "backend",
          "position": {
            "x": 640,
            "y": 200
          }
        },
        {
          "id": "db",
          "kind": "datastore",
          "name": "Postgres",
          "description": "Primary store — RDS Postgres, accessed via Drizzle ORM.",
          "position": {
            "x": 960,
            "y": 200
          }
        },
        {
          "id": "clerk",
          "kind": "system",
          "name": "Clerk",
          "description": "Identity provider — handles sign-up, sign-in, sessions.",
          "tags": [
            "external",
            "auth"
          ],
          "position": {
            "x": 960,
            "y": 60
          }
        },
        {
          "id": "stripe",
          "kind": "system",
          "name": "Stripe",
          "description": "Payments provider. Backend posts charges + receives webhooks.",
          "tags": [
            "external"
          ],
          "position": {
            "x": 960,
            "y": 340
          }
        }
      ],
      "edges": [
        {
          "id": "e-user-cdn",
          "source": "user",
          "target": "cdn",
          "type": "rest",
          "label": "GET /"
        },
        {
          "id": "e-cdn-web",
          "source": "cdn",
          "target": "web",
          "type": "file",
          "label": "bundle"
        },
        {
          "id": "e-user-web",
          "source": "user",
          "target": "web",
          "type": "rest"
        },
        {
          "id": "e-web-api",
          "source": "web",
          "target": "api",
          "type": "rest",
          "label": "POST /api/*"
        },
        {
          "id": "e-web-clerk",
          "source": "web",
          "target": "clerk",
          "type": "auth",
          "label": "OAuth / PKCE"
        },
        {
          "id": "e-api-clerk",
          "source": "api",
          "target": "clerk",
          "type": "auth",
          "label": "validate JWT"
        },
        {
          "id": "e-api-db",
          "source": "api",
          "target": "db",
          "type": "jdbc",
          "label": "SQL via Drizzle"
        },
        {
          "id": "e-api-stripe",
          "source": "api",
          "target": "stripe",
          "type": "rest",
          "label": "POST /charges"
        }
      ]
    },
    {
      "id": "frontend",
      "name": "Web internals",
      "description": "How the Vite-built SPA is layered.",
      "nodes": [
        {
          "id": "vite",
          "kind": "infra",
          "name": "Vite",
          "description": "Dev server + production build.",
          "tags": [
            "build"
          ],
          "position": {
            "x": 0,
            "y": 60
          }
        },
        {
          "id": "entry",
          "kind": "application",
          "name": "main.tsx",
          "description": "App entry. Mounts React, sets up providers.",
          "position": {
            "x": 0,
            "y": 200
          }
        },
        {
          "id": "router",
          "kind": "service",
          "name": "Router",
          "description": "React Router. URL ↔ route components.",
          "position": {
            "x": 280,
            "y": 200
          }
        },
        {
          "id": "state",
          "kind": "service",
          "name": "Client state",
          "description": "Zustand store — UI state.",
          "position": {
            "x": 560,
            "y": 100
          }
        },
        {
          "id": "query",
          "kind": "service",
          "name": "Server-state cache",
          "description": "TanStack Query — server data cache + revalidation.",
          "position": {
            "x": 560,
            "y": 240
          }
        }
      ],
      "edges": [
        {
          "id": "e-vite-entry",
          "source": "vite",
          "target": "entry",
          "type": "file",
          "label": "bundles"
        },
        {
          "id": "e-entry-router",
          "source": "entry",
          "target": "router",
          "type": "rest"
        },
        {
          "id": "e-router-state",
          "source": "router",
          "target": "state",
          "type": "rest"
        },
        {
          "id": "e-router-query",
          "source": "router",
          "target": "query",
          "type": "rest"
        }
      ]
    },
    {
      "id": "backend",
      "name": "API internals",
      "description": "Fastify request path + downstream stores.",
      "nodes": [
        {
          "id": "server",
          "kind": "service",
          "name": "Fastify server",
          "description": "Public REST surface — typed routes + Zod-validated bodies.",
          "tags": [
            "public"
          ],
          "position": {
            "x": 0,
            "y": 200
          }
        },
        {
          "id": "auth-mw",
          "kind": "service",
          "name": "Auth middleware",
          "description": "Validates Clerk JWTs, attaches user context.",
          "tags": [
            "auth"
          ],
          "position": {
            "x": 280,
            "y": 60
          }
        },
        {
          "id": "domain",
          "kind": "service",
          "name": "Domain services",
          "description": "Business logic — pure over the domain model.",
          "position": {
            "x": 280,
            "y": 200
          }
        },
        {
          "id": "pg",
          "kind": "datastore",
          "name": "Postgres",
          "description": "RDS Postgres via Drizzle ORM.",
          "position": {
            "x": 560,
            "y": 100
          }
        },
        {
          "id": "redis",
          "kind": "datastore",
          "name": "Redis",
          "description": "ElastiCache — sessions + hot cache.",
          "tags": [
            "cache"
          ],
          "position": {
            "x": 560,
            "y": 240
          }
        },
        {
          "id": "jobs",
          "kind": "queue",
          "name": "BullMQ",
          "description": "Background jobs backed by Redis.",
          "position": {
            "x": 560,
            "y": 380
          }
        }
      ],
      "edges": [
        {
          "id": "e-server-auth",
          "source": "server",
          "target": "auth-mw",
          "type": "auth"
        },
        {
          "id": "e-server-domain",
          "source": "server",
          "target": "domain",
          "type": "rest"
        },
        {
          "id": "e-domain-pg",
          "source": "domain",
          "target": "pg",
          "type": "jdbc"
        },
        {
          "id": "e-domain-redis",
          "source": "domain",
          "target": "redis",
          "type": "jdbc"
        },
        {
          "id": "e-domain-jobs",
          "source": "domain",
          "target": "jobs",
          "type": "async",
          "label": "enqueue"
        }
      ]
    }
  ],
  "tours": [
    {
      "id": "walkthrough",
      "name": "Start-to-finish walkthrough",
      "description": "Follow a customer request from browser to database and back.",
      "stops": [
        {
          "ref": "acme-saas:context:user",
          "note": "A signed-in customer in a modern browser. Every request that matters starts here."
        },
        {
          "ref": "acme-saas:context:cdn",
          "note": "CloudFront serves the SPA bundle and static assets from the edge — first byte is usually a cache hit."
        },
        {
          "ref": "acme-saas:context:web",
          "note": "React SPA boots, validates the Clerk session, and renders the route. Cross into the frontend diagram to see the layering."
        },
        {
          "ref": "acme-saas:frontend:query",
          "note": "TanStack Query is the only thing in the SPA that talks to the API. It batches, caches, and revalidates server data."
        },
        {
          "ref": "acme-saas:context:api",
          "note": "The Fastify service receives the API call over HTTPS. JWT from Clerk gets validated before the handler runs."
        },
        {
          "ref": "acme-saas:backend:domain",
          "note": "Domain services hold the business logic. They are framework-free and unit-tested directly."
        },
        {
          "ref": "acme-saas:backend:pg",
          "note": "Reads/writes go to Postgres through Drizzle. Anything cacheable lands in Redis on the way back."
        },
        {
          "ref": "acme-saas:context:stripe",
          "note": "Charges fire off to Stripe via POST. Stripe webhooks come back in the other direction — that path is worth a second tour."
        }
      ]
    }
  ]
}
```

---

## Notes on the example

- Notice the **column structure**: actors on the left (x=0), the
  subject system in the middle (x=320–640), externals on the right
  (x=960). All on the 20px grid.
- The **owners** field was omitted because no `CODEOWNERS` was found.
- The **walkthrough tour** is the headline output. It walks a real request
  flow: user → CDN → SPA → server-state cache → API → domain → Postgres →
  Stripe. Eight stops; each note explains what's happening at that node,
  not what the diagram already shows.
- The Web and API nodes carry `childDiagramId` so the user can drill in
  from the context diagram — and the walkthrough naturally crosses those
  boundaries by referencing nodes inside the `frontend` and `backend`
  diagrams.
- Cross-project `targetRef` was not needed — this is a single monorepo /
  single project. If two siblings of this skill produce separate JSONs
  for two related codebases, the user can wire cross-project edges by
  hand in the editor (or by a future `suggest-cross-project-refs` skill).
