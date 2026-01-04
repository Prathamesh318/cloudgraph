# Architecture Overview

This document provides a deep dive into CloudGraph's system architecture, component boundaries, and data flow.

---

## System Architecture

CloudGraph follows a classic **client-server architecture** with a React frontend and Node.js backend. There is no database - all processing happens in-memory per request.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER                                       │
│                    (Browser / HTTP Client)                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                         │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │ FileUpload     │  │ Dashboard      │  │ GraphView              │ │
│  │ Component      │  │ Layout         │  │ (react-force-graph-2d) │ │
│  └───────┬────────┘  └───────┬────────┘  └───────────┬────────────┘ │
│          │                   │                       │               │
│          └───────────────────┼───────────────────────┘               │
│                              │                                       │
│  ┌───────────────────────────┴───────────────────────────────────┐  │
│  │                    API Service (api.ts)                        │  │
│  │            Handles HTTP requests to backend                    │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               │ HTTP POST /api/analyze
                               │ HTTP POST /api/validate
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express)                      │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      Routes (analyze.ts)                         ││
│  │              /api/analyze, /api/validate, /api/health            ││
│  └──────────────────────────────┬──────────────────────────────────┘│
│                                 │                                    │
│  ┌──────────────────────────────┴──────────────────────────────────┐│
│  │                    YAML Parser (yamlParser.ts)                   ││
│  │  - Parse YAML content using js-yaml                              ││
│  │  - Detect platform (Docker Compose vs Kubernetes)                ││
│  │  - Validate structure                                            ││
│  └──────────────────────────────┬──────────────────────────────────┘│
│                                 │                                    │
│      ┌──────────────────────────┴──────────────────────────┐        │
│      │                                                      │        │
│      ▼                                                      ▼        │
│  ┌──────────────────────┐                    ┌──────────────────────┐│
│  │ Docker Compose       │                    │ Kubernetes           ││
│  │ Parser               │                    │ Parser               ││
│  │ - Services           │                    │ - Deployments        ││
│  │ - Networks           │                    │ - Services           ││
│  │ - Volumes            │                    │ - Ingress            ││
│  │ - depends_on         │                    │ - ConfigMaps         ││
│  └──────────┬───────────┘                    └──────────┬───────────┘│
│             │                                           │            │
│             └─────────────────┬─────────────────────────┘            │
│                               │                                      │
│  ┌────────────────────────────┴────────────────────────────────────┐│
│  │                  Analysis Service (analysisService.ts)           ││
│  │  - Build dependency graph                                        ││
│  │  - Resolve selector-based dependencies                           ││
│  │  - Infer dependencies from environment variables                 ││
│  │  - Generate Mermaid diagrams                                     ││
│  │  - Detect risks                                                   ││
│  │  - Generate recommendations                                       ││
│  └──────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Service Boundaries

### Frontend Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `FileUpload.tsx` | Handle file drag-drop, read content, trigger analysis |
| `Dashboard.tsx` | Layout container, tab navigation, state management |
| `GraphView.tsx` | Render interactive force-directed graph |
| `MermaidView.tsx` | Display Mermaid diagram code |
| `AnalysisView.tsx` | Show architectural overview |
| `RisksView.tsx` | Display detected risks and recommendations |
| `SummaryView.tsx` | Show resource counts by type |
| `api.ts` | HTTP client for backend communication |

### Backend Responsibilities

| Module | Responsibility |
|--------|----------------|
| `app.ts` | Express server setup, middleware, CORS |
| `routes/analyze.ts` | API endpoint handlers |
| `utils/yamlParser.ts` | YAML parsing, platform detection, validation |
| `parsers/dockerComposeParser.ts` | Extract resources from Docker Compose |
| `parsers/kubernetesParser.ts` | Extract resources from K8s manifests |
| `services/analysisService.ts` | Core analysis, graph building, risk detection |

---

## Data Flow

### Request Processing Flow

```
1. USER uploads YAML file(s)
         │
         ▼
2. Frontend reads file content
   - FileReader API
   - Store as { name: string, content: string }
         │
         ▼
3. Frontend calls POST /api/analyze
   - Body: { files: FileInput[], options: AnalysisOptions }
         │
         ▼
4. Backend parses YAML
   - yaml.loadAll() for multi-document support
   - Returns array of parsed documents
         │
         ▼
5. Platform detection
   - Check for 'version' or 'services' → Docker Compose
   - Check for 'apiVersion' and 'kind' → Kubernetes
         │
         ▼
6. Platform-specific parsing
   - Docker Compose: Extract services as Container resources
   - Kubernetes: Extract by kind (Deployment, Service, etc.)
         │
         ▼
7. Dependency extraction
   - Docker: depends_on, networks, volumes
   - K8s: Selectors, ConfigMap refs, Secret refs
         │
         ▼
8. Dependency inference
   - Scan environment variables for patterns
   - Match postgres, redis, kafka, etc.
         │
         ▼
9. Build analysis result
   - Graph (nodes + edges)
   - Mermaid diagrams
   - Risk assessments
   - Recommendations
         │
         ▼
10. Return JSON response to frontend
          │
          ▼
11. Frontend renders visualization
```

---

## Communication Patterns

### Synchronous (HTTP)

All communication is synchronous HTTP request/response:

```
Frontend                          Backend
   │                                 │
   │  POST /api/analyze              │
   │  { files, options }             │
   │ ───────────────────────────────►│
   │                                 │ Parse YAML
   │                                 │ Analyze
   │                                 │ Build graph
   │  200 OK                         │
   │  { result: AnalysisResult }     │
   │ ◄───────────────────────────────│
   │                                 │
```

### No Async Processing

- No message queues
- No background jobs
- No WebSockets
- All processing completes within HTTP request timeout

---

## Error Handling Strategy

### Backend Errors

```typescript
// Route-level error handling
try {
    const result = await analyzeFiles(files, options);
    return res.json({ id: result.id, status: result.status, result });
} catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
        error: 'Analysis Failed',
        message: (error as Error).message
    });
}
```

### Parser Errors

- YAML syntax errors are caught and returned in `errors` array
- Processing continues for valid files even if some fail
- Each file's errors are tracked separately

### Frontend Error Display

- Validation errors shown inline on upload
- Analysis errors displayed in alert component
- Network errors caught and displayed

---

## Key Design Decisions

### 1. Stateless Backend

**Decision**: No database, all processing in-memory per request.

**Rationale**:
- Simplifies deployment
- No state synchronization issues
- Each request is independent
- Easy to scale horizontally (though not implemented)

**Trade-off**: No persistence of results between sessions.

### 2. Shared Types

**Decision**: Common TypeScript types in `shared/types.ts`.

**Rationale**:
- Single source of truth for data structures
- Compile-time type checking across frontend/backend
- Easier refactoring

### 3. Platform Detection

**Decision**: Auto-detect Docker Compose vs Kubernetes from content.

**Rationale**:
- Better UX (user doesn't need to specify)
- Robust detection based on key fields
- Fallback to Kubernetes for unknown formats

### 4. Dependency Inference

**Decision**: Infer dependencies from environment variable patterns.

**Rationale**:
- Catches implicit dependencies not in depends_on
- Useful for K8s where dependencies aren't explicit
- Marked as "inferred" with confidence level

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│                                                                  │
│   FileUpload ──(files)──► App State ──(result)──► GraphView    │
│                               │                      │          │
│                               │                      ▼          │
│                               │               AnalysisView      │
│                               │                      │          │
│                               ▼                      ▼          │
│                           Dashboard ◄─────────── RisksView      │
│                               │                      │          │
│                               ▼                      ▼          │
│                          SummaryView          MermaidView       │
│                                                                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼ API Call
┌─────────────────────────────────────────────────────────────────┐
│                          Backend                                 │
│                                                                  │
│   analyze route ──► yamlParser ──► detector ──► parser          │
│                                                      │          │
│                    analysisService ◄─────────────────┘          │
│                          │                                       │
│            ┌─────────────┼─────────────┐                        │
│            ▼             ▼             ▼                        │
│      graphBuilder   riskDetector   mermaidGen                   │
│            │             │             │                        │
│            └─────────────┼─────────────┘                        │
│                          ▼                                       │
│                   AnalysisResult                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

For more details on specific components, see:

- [Parser & Processing](parser-and-processing.md) - Detailed parsing logic
- [Analysis Engine](analysis-engine.md) - Dependency resolution and risk detection
- [Graph & Visualization](graph-and-visualization.md) - Frontend rendering
