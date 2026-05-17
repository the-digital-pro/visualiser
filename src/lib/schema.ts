import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1 as const;

export const NodeKindSchema = z.enum([
  "actor",
  "system",
  "application",
  "service",
  "datastore",
  "queue",
  "infra",
  "group",
]);
export type NodeKind = z.infer<typeof NodeKindSchema>;

export const EdgeTypeSchema = z.enum([
  "rest",
  "graphql",
  "grpc",
  "jdbc",
  "async",
  "file",
  "auth",
  "generic",
]);
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

const TargetRefSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/,
    "targetRef must match `projectId:diagramId:nodeId`",
  );

const MetadataSchema = z.record(z.string(), z.unknown());

const NodeInputSchema = z.object({
  id: z.string().min(1),
  kind: NodeKindSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  position: PositionSchema.optional(),
  parentId: z.string().min(1).optional(),
  childDiagramId: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  metadata: MetadataSchema.optional(),
});

const EdgeInputSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1).optional(),
    targetRef: TargetRefSchema.optional(),
    type: EdgeTypeSchema,
    label: z.string().optional(),
    tags: z.array(z.string().min(1)).optional(),
    metadata: MetadataSchema.optional(),
  })
  .refine((e) => (e.target == null) !== (e.targetRef == null), {
    message: "edge must have exactly one of `target` or `targetRef`",
  });

const DiagramInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(NodeInputSchema),
  edges: z.array(EdgeInputSchema),
});

/**
 * A TourStop is a single waypoint. `targetRef` follows the same `projectId:
 * diagramId:nodeId?` shape used by edges — but `nodeId` is optional for stops
 * that just spotlight a diagram. Cross-project stops therefore Just Work
 * (ADR-0001), and the player drives them through NavigationController.
 */
const TourStopSchema = z.object({
  ref: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)?$/,
      "ref must be `projectId:diagramId` or `projectId:diagramId:nodeId`",
    ),
  note: z.string().min(1),
});

const TourSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  stops: z.array(TourStopSchema).min(1),
});
export type Tour = z.infer<typeof TourSchema>;
export type TourStop = z.infer<typeof TourStopSchema>;

/**
 * Lenient on-disk shape. Accepts what humans write into JSON files.
 * Position is optional; missing positions are handled by the loader.
 *
 * `tours` is optional so existing seeds (which don't carry tours) still
 * round-trip byte-identically.
 */
export const ProjectInputSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/, "id must be kebab-case ascii"),
  name: z.string().min(1),
  description: z.string().optional(),
  owners: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
  homeDiagramId: z.string().min(1),
  diagrams: z.array(DiagramInputSchema).min(1),
  tours: z.array(TourSchema).optional(),
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export type NodeInput = z.infer<typeof NodeInputSchema>;
export type EdgeInput = z.infer<typeof EdgeInputSchema>;
export type DiagramInput = z.infer<typeof DiagramInputSchema>;

/**
 * Validated in-store shape. Positions are guaranteed present
 * (filled by loader, either from the input or via fallback grid).
 *
 * INVARIANT (ADR-0007): the store ONLY ever holds Project, never ProjectInput.
 */
const NodeSchema = NodeInputSchema.extend({
  position: PositionSchema,
});

const EdgeSchema = EdgeInputSchema;

const DiagramSchema = DiagramInputSchema.extend({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});

export const ProjectSchema = ProjectInputSchema.extend({
  diagrams: z.array(DiagramSchema).min(1),
});
export type Project = z.infer<typeof ProjectSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type Diagram = z.infer<typeof DiagramSchema>;

export const ManifestEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  owners: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  homeDiagramId: z.string().min(1),
  file: z.string().min(1),
  hash: z.string().min(1),
});
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export const ManifestSchema = z.object({
  projects: z.array(ManifestEntrySchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const SearchIndexEntrySchema = z.object({
  projectId: z.string(),
  diagramId: z.string(),
  nodeId: z.string(),
  name: z.string(),
  kind: NodeKindSchema,
  tags: z.array(z.string()),
  description: z.string(),
});
export type SearchIndexEntry = z.infer<typeof SearchIndexEntrySchema>;
