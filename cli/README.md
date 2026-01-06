# CloudGraph CLI

Command-line tool for analyzing Docker Compose and Kubernetes configurations.

## Installation

```bash
cd cli
npm install
npm run build
npm link  # Makes 'cloudgraph' available globally
```

## Usage

### Analyze Configuration Files

```bash
# Analyze a single file
cloudgraph analyze docker-compose.yml

# Analyze multiple files
cloudgraph analyze deployment.yaml service.yaml ingress.yaml

# Output as JSON (for scripting)
cloudgraph analyze docker-compose.yml --output json

# Output with Mermaid diagram
cloudgraph analyze k8s/*.yaml --mermaid
```

### Validate Files

```bash
# Validate YAML syntax and structure
cloudgraph validate docker-compose.yml

# Strict mode (fail on warnings)
cloudgraph validate deployment.yaml --strict
```

### Output Formats

| Format | Option | Description |
|--------|--------|-------------|
| Table | `--output table` | Formatted tables (default) |
| Summary | `--output summary` | Brief statistics |
| JSON | `--output json` | Machine-readable JSON |

### Options

```
-V, --version          Output version number
-h, --help             Display help
-o, --output <format>  Output format: json, table, summary
-m, --mermaid          Generate Mermaid diagram
-q, --quiet            Minimal output
--no-color             Disable colored output
--strict               Fail on warnings (validate only)
```

## Examples

### Analyze a Microservices Stack

```bash
$ cloudgraph analyze docker-compose.yml

╔═══════════════════════════════════════════════╗
║  ☁️  CloudGraph CLI                            ║
║  Container Orchestration Dependency Analyzer  ║
╚═══════════════════════════════════════════════╝

✔ Analysis complete!

📦 Resources:
┌──────────────┬───────────┬──────────┬───────────────────────┐
│ Name         │ Type      │ Platform │ File                  │
├──────────────┼───────────┼──────────┼───────────────────────┤
│ frontend     │ Container │ Docker   │ docker-compose.yml    │
│ api          │ Container │ Docker   │ docker-compose.yml    │
│ db           │ Container │ Docker   │ docker-compose.yml    │
│ redis        │ Container │ Docker   │ docker-compose.yml    │
└──────────────┴───────────┴──────────┴───────────────────────┘

🔗 Dependencies:
┌──────────┬──────────┬─────────┬──────────┐
│ From     │ To       │ Type    │ Inferred │
├──────────┼──────────┼─────────┼──────────┤
│ frontend │ api      │ startup │ No       │
│ api      │ db       │ startup │ No       │
│ api      │ redis    │ runtime │ Yes      │
└──────────┴──────────┴─────────┴──────────┘

✅ No risks detected
```

### Validate Kubernetes Manifests

```bash
$ cloudgraph validate deployment.yaml --strict

📋 Validation Results:
────────────────────────────────────────
  ⚠ deployment.yaml
    ⚠ Doc 1: Deployment has only 1 replica

⚠️  Validation failed (strict mode) with warnings
```

### Export as JSON

```bash
$ cloudgraph analyze k8s/ --output json > analysis.json
```

### Generate Mermaid Diagram

```bash
$ cloudgraph analyze docker-compose.yml --mermaid

📊 Mermaid Diagram:
────────────────────────────────────────
flowchart TB
  container-frontend["frontend"]
  container-api["api"]
  container-db["db"]
  container-frontend --> container-api
  container-api --> container-db
```

## Integration with CI/CD

```yaml
# .github/workflows/validate.yml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install -g @cloudgraph/cli
      - run: cloudgraph validate docker-compose.yml --strict
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Errors found |
