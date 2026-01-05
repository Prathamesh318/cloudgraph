# Future Scope

Planned features for future CloudGraph releases.

---

## Helm Chart Support

### Goal
Parse Helm charts including Chart.yaml, values.yaml, and template files.

### Structure
```
mychart/
├── Chart.yaml           # Chart metadata
├── values.yaml          # Default values
└── templates/
    ├── deployment.yaml  # {{ .Values.x }} syntax
    ├── service.yaml
    └── _helpers.tpl     # Template helpers
```

### Implementation Approach

1. **Detect Helm structure** - Check for Chart.yaml in uploaded files
2. **Parse values.yaml** - Extract default values
3. **Render templates** - Substitute `{{ .Values.x }}` patterns
4. **Extract resources** - Parse rendered YAML as Kubernetes resources

### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/parsers/helmParser.ts` | Parse Helm chart structure |
| `backend/src/utils/templateRenderer.ts` | Basic Go template substitution |

### Technical Considerations

> ⚠️ **Limitation**: Full Helm template rendering requires Go template engine. 
> Options:
> - Basic substitution (limited but pure JS)
> - Shell out to `helm template` CLI (full support, requires Helm installed)

### Estimated Effort
8-12 hours

---

## Kustomize Support

### Goal
Parse Kustomize configurations including bases and overlays.

### Structure
```
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    └── production/
        ├── kustomization.yaml
        └── patch.yaml
```

### Implementation Approach

1. **Find kustomization.yaml** - Entry point for Kustomize config
2. **Load base resources** - Resolve `resources:` paths
3. **Apply patches** - Strategic merge or JSON patch
4. **Apply transformations** - commonLabels, namespace, images
5. **Generate resources** - configMapGenerator, secretGenerator

### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/parsers/kustomizeParser.ts` | Parse kustomization.yaml |
| `backend/src/utils/patchApplier.ts` | Apply strategic merge patches |

### kustomization.yaml Keys to Support

| Key | Priority | Complexity |
|-----|----------|------------|
| `resources` | High | Low |
| `bases` | High | Low |
| `commonLabels` | High | Low |
| `namespace` | High | Low |
| `patches` | High | Medium |
| `patchesStrategicMerge` | Medium | Medium |
| `configMapGenerator` | Medium | Medium |
| `secretGenerator` | Medium | Medium |
| `images` | Low | Low |

### Estimated Effort
6-10 hours

---

## Priority

These features are planned for after Mermaid Live and Git Integration are complete.

| Feature | Value | Complexity | Status |
|---------|-------|------------|--------|
| Helm Charts | Medium | High | Planned |
| Kustomize | Medium | High | Planned |
