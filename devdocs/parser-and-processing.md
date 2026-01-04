# Parser & Processing

This document explains how CloudGraph parses YAML configuration files, validates them, and transforms them into structured data.

---

## Parsing Pipeline

```
Input File(s)                    Output
     │                              │
     ▼                              │
┌─────────────┐                     │
│ YAML Parser │  js-yaml            │
│ loadAll()   │                     │
└──────┬──────┘                     │
       │                            │
       ▼                            │
┌─────────────────┐                 │
│ Platform        │                 │
│ Detection       │                 │
└────────┬────────┘                 │
         │                          │
    ┌────┴────┐                     │
    ▼         ▼                     │
┌───────┐ ┌───────┐                 │
│Docker │ │  K8s  │                 │
│Compose│ │Parser │                 │
│Parser │ └───┬───┘                 │
└───┬───┘     │                     │
    │         │                     │
    └────┬────┘                     │
         │                          │
         ▼                          ▼
    ┌─────────────────────────────────┐
    │  Resources[] + Dependencies[]   │
    └─────────────────────────────────┘
```

---

## YAML Parser Module

**Location**: `backend/src/utils/yamlParser.ts`

### Functions

#### `parseYamlFiles(files: FileInput[]): ParsedYamlFile[]`

Parses an array of file inputs and returns structured document objects.

```typescript
interface ParsedYamlFile {
    fileName: string;
    platform: Platform;    // 'docker-compose' | 'kubernetes'
    documents: unknown[];  // Parsed YAML documents
    errors: string[];      // Any parsing errors
}
```

**Multi-Document Support**: Uses `yaml.loadAll()` to handle files with multiple documents separated by `---`.

#### `detectPlatform(content: unknown): Platform`

Determines if a document is Docker Compose or Kubernetes.

**Detection Logic**:

```typescript
// Docker Compose indicators
if (doc.version || doc.services || doc.networks || (doc.volumes && !doc.apiVersion)) {
    return 'docker-compose';
}

// Kubernetes indicators
if (doc.apiVersion && doc.kind) {
    return 'kubernetes';
}

// Default fallback
return 'kubernetes';
```

#### `validateYaml(files: FileInput[]): ValidationResult`

Validates YAML files without performing full analysis.

```typescript
interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];    // Critical issues
    warnings: ValidationWarning[]; // Non-fatal issues
}
```

---

## Docker Compose Parser

**Location**: `backend/src/parsers/dockerComposeParser.ts`

### Input Structure

```yaml
version: "3.9"
services:
  frontend:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - backend
networks:
  app-net:
    driver: bridge
volumes:
  data:
```

### Parsing Steps

1. **Extract Services** → Each service becomes a `Container` resource
2. **Extract Networks** → Each network becomes a `Network` resource
3. **Extract Volumes** → Each named volume becomes a `Volume` resource
4. **Extract Dependencies**:
   - `depends_on` → `startup` dependency type
   - Shared networks → `network` dependency type
   - Volume mounts → `storage` dependency type

### Resource Extraction

```typescript
function parseService(name: string, service: DockerService, fileName: string): Resource {
    return {
        id: uuidv4(),
        name: name,
        kind: 'Container',
        platform: 'docker-compose',
        metadata: {
            image: service.image,
            ports: parsePorts(service.ports),
            environment: parseEnvironment(service.environment),
            volumes: parseVolumes(service.volumes),
            command: service.command,
            healthCheck: service.healthcheck ? parseHealthCheck(service.healthcheck) : undefined,
        },
        sourceFile: fileName,
    };
}
```

### Port Parsing

Handles multiple formats:

```yaml
# Short syntax
ports:
  - "3000:3000"
  - "8080:80"
  - "9090"

# Long syntax
ports:
  - target: 80
    published: 8080
    protocol: tcp
```

### Environment Variable Parsing

```yaml
# Array format
environment:
  - NODE_ENV=production
  - DB_HOST=postgres

# Object format
environment:
  NODE_ENV: production
  DB_HOST: postgres
```

---

## Kubernetes Parser

**Location**: `backend/src/parsers/kubernetesParser.ts`

### Supported Resource Types

| Kind | Extracted As |
|------|--------------|
| Deployment | `Deployment` |
| StatefulSet | `StatefulSet` |
| DaemonSet | `DaemonSet` |
| Pod | `Pod` |
| Service | `Service` |
| Ingress | `Ingress` |
| ConfigMap | `ConfigMap` |
| Secret | `Secret` |
| PersistentVolumeClaim | `PersistentVolumeClaim` |

### Parsing Flow

```
┌─────────────────────┐
│  K8s Manifest       │
│  (kind, apiVersion) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Switch on kind     │
└──────────┬──────────┘
           │
     ┌─────┴─────┬─────────────┐
     ▼           ▼             ▼
┌─────────┐ ┌─────────┐ ┌───────────┐
│Workload │ │ Service │ │ Ingress   │
│(Deploy, │ │         │ │           │
│ STS,    │ │         │ │           │
│ DS)     │ │         │ │           │
└────┬────┘ └────┬────┘ └─────┬─────┘
     │           │            │
     └─────────────────────────┘
               │
               ▼
     ┌─────────────────────┐
     │ Extract deps from:  │
     │ - Service selectors │
     │ - ConfigMap refs    │
     │ - Secret refs       │
     │ - Ingress backends  │
     └─────────────────────┘
```

### Selector-Based Dependencies

Services select Pods via label selectors:

```yaml
# Service
spec:
  selector:
    app: backend

# Deployment
metadata:
  labels:
    app: backend
```

The parser creates a `selector` dependency that is resolved in the analysis phase:

```typescript
dependencies.push({
    id: uuidv4(),
    source: serviceId,
    target: `selector:${JSON.stringify(selector)}`,
    type: 'selector',
    isInferred: false,
    confidence: 'high',
});
```

### ConfigMap and Secret References

Extracted from:

1. **envFrom**:
```yaml
envFrom:
  - configMapRef:
      name: app-config
  - secretRef:
      name: app-secrets
```

2. **env valueFrom**:
```yaml
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: db-secret
        key: password
```

3. **Volume mounts**:
```yaml
volumes:
  - name: config
    configMap:
      name: app-config
```

---

## Validation Rules

### Docker Compose Validation

| Check | Severity | Message |
|-------|----------|---------|
| No services defined | Warning | "Docker Compose file has no services" |
| Version not 2.x/3.x | Warning | "Version may not be fully supported" |
| Service missing image/build | Warning | "No image or build context" |

### Kubernetes Validation

| Check | Severity | Message |
|-------|----------|---------|
| Missing apiVersion | Error | "Missing required field: apiVersion" |
| Missing kind | Error | "Missing required field: kind" |
| Missing metadata.name | Error | "Metadata missing name" |
| Workload missing spec | Error | "Missing required field: spec" |

---

## Error Handling

Errors are collected, not thrown immediately:

```typescript
const errors: string[] = [];

for (const parsed of parsedFiles) {
    if (parsed.errors.length > 0) {
        errors.push(...parsed.errors);
        continue; // Skip this file, try others
    }
    
    for (const doc of parsed.documents) {
        try {
            // Parse document
        } catch (err) {
            errors.push(`Error parsing ${parsed.fileName}: ${err.message}`);
        }
    }
}

// Return results with errors array
return { resources, dependencies, errors };
```

---

## Performance Considerations

- **Synchronous parsing** - `js-yaml` is synchronous
- **Memory** - Entire file loaded into memory
- **Large files** - No streaming support; may be slow for huge files
- **Multi-document** - Efficiently handles `---` separators

---

## Next Steps

- [Analysis Engine](analysis-engine.md) - How parsed data is analyzed
- [Architecture Overview](architecture-overview.md) - System design
