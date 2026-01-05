# CloudGraph

**Container Orchestration Dependency Analyzer**

CloudGraph is a visual analysis tool that parses Docker Compose and Kubernetes configuration files to automatically generate interactive dependency graphs, architectural insights, and risk assessments.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Developer Documentation](#developer-documentation)
- [Important Notes](#-important-notes)
- [Contributing](#contributing)

---

## Overview

CloudGraph helps DevOps engineers and developers understand complex container orchestration setups by:

- **Parsing** Docker Compose and Kubernetes YAML files
- **Visualizing** service dependencies as interactive graphs
- **Analyzing** architecture patterns and potential issues
- **Identifying** risks like single points of failure
- **Generating** Mermaid diagrams for documentation

### Use Cases

- Onboarding new team members to existing infrastructure
- Auditing microservice dependencies before deployment
- Identifying circular dependencies and bottlenecks
- Generating architecture documentation automatically

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ File Upload │  │ Graph View  │  │ Analysis/Risks/Summary  │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
└─────────┼────────────────┼──────────────────────┼───────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                       │
│  - Interactive force-directed graph (react-force-graph-2d)      │
│  - Export to PNG/SVG/JSON                                        │
│  - Mermaid diagram rendering                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP REST API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (Node.js + Express)                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  YAML Parser     │  │ Docker Compose   │  │  Kubernetes   │  │
│  │  (js-yaml)       │  │ Parser           │  │  Parser       │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           └──────────────┬──────┴────────────────────┘          │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Analysis Service                                ││
│  │  - Dependency resolution       - Risk detection              ││
│  │  - Mermaid diagram generation  - Recommendations             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 19, Vite, TypeScript | Interactive UI with graph visualization |
| **Backend** | Node.js, Express 5, TypeScript | REST API for parsing and analysis |
| **Shared** | TypeScript | Common type definitions |

### Data Flow

1. User uploads YAML file(s) via drag-and-drop
2. Frontend sends files to `/api/analyze` endpoint
3. Backend parses YAML and detects platform (Docker Compose vs Kubernetes)
4. Appropriate parser extracts resources and dependencies
5. Analysis service generates graph, risks, and recommendations
6. Frontend renders interactive visualization

---

## Features

### Core Capabilities

- ✅ **Docker Compose Parsing** - Services, networks, volumes, depends_on
- ✅ **Kubernetes Parsing** - Deployments, Services, Ingress, ConfigMaps, Secrets, PVCs
- ✅ **Interactive Graph** - Pan, zoom, drag nodes, select to highlight
- ✅ **Dependency Inference** - Detects connections from environment variables
- ✅ **Risk Detection** - Single replicas, missing health checks, orphaned resources
- ✅ **Export Options** - PNG, SVG, JSON graph data
- ✅ **Mermaid Live Rendering** - Diagrams render visually with SVG/PNG export
- ✅ **Git Integration** - Fetch configs directly from GitHub/GitLab repos

### Visualization Features

- Force-directed layout with physics simulation
- Node coloring by resource type
- Edge styling by dependency type (dashed for inferred)
- Search and filter nodes
- Layout switching (Force, Radial, Hierarchical)
- Zoom controls and fit-to-view

### Git Integration

- Fetch YAML files from GitHub or GitLab repositories
- Support for repo root, specific branches, and subdirectories
- Auto-detection and filtering of config files
- Works with public repositories

---

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/Prathamesh318/cloudgraph.git
cd cloudgraph

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server runs on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

### Using the Application

1. Open http://localhost:5173 in your browser
2. Drag & drop a Docker Compose or Kubernetes YAML file
3. Or click "Sample Configs" to load example data
4. Explore the interactive graph and analysis views

---

## Project Structure

```
cloudgraph/
├── backend/
│   ├── src/
│   │   ├── app.ts              # Express server setup
│   │   ├── routes/
│   │   │   └── analyze.ts      # API endpoints (/analyze, /validate)
│   │   ├── parsers/
│   │   │   ├── dockerComposeParser.ts
│   │   │   └── kubernetesParser.ts
│   │   ├── services/
│   │   │   └── analysisService.ts  # Core analysis logic
│   │   └── utils/
│   │       └── yamlParser.ts   # YAML parsing & validation
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Main app component
│   │   ├── components/
│   │   │   ├── GraphView.tsx   # Interactive graph (react-force-graph-2d)
│   │   │   ├── FileUpload.tsx  # Drag-drop file upload
│   │   │   ├── Dashboard.tsx   # Main layout
│   │   │   ├── MermaidView.tsx # Mermaid diagram display
│   │   │   ├── AnalysisView.tsx
│   │   │   ├── RisksView.tsx
│   │   │   └── SummaryView.tsx
│   │   ├── services/
│   │   │   └── api.ts          # Backend API client
│   │   └── types/
│   │       └── index.ts        # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
│
├── shared/
│   └── types.ts                # Shared type definitions
│
├── .github/
│   └── workflows/
│       └── build.yml           # CI/CD pipeline
│
└── .gitignore
```

---

## Configuration

### Environment Variables

Currently, the application uses default configurations:

| Variable | Default | Description |
|----------|---------|-------------|
| Backend Port | 3001 | Express server port |
| Frontend Port | 5173 | Vite dev server port |
| CORS Origin | * | Allowed origins (development) |

### Build Commands

| Command | Location | Description |
|---------|----------|-------------|
| `npm run dev` | backend/ | Start development server with hot reload |
| `npm run build` | backend/ | Compile TypeScript to JavaScript |
| `npm run dev` | frontend/ | Start Vite dev server |
| `npm run build` | frontend/ | Build production bundle |
| `npm run lint` | frontend/ | Run ESLint |

---

## Developer Documentation

Detailed technical documentation is available in the `devdocs/` folder:

| Document | Description |
|----------|-------------|
| [Architecture Overview](devdocs/architecture-overview.md) | System design, data flow, component boundaries |
| [Parser & Processing](devdocs/parser-and-processing.md) | YAML parsing, validation, transformation |
| [Analysis Engine](devdocs/analysis-engine.md) | Dependency resolution, risk detection, recommendations |
| [Graph & Visualization](devdocs/graph-and-visualization.md) | react-force-graph-2d, rendering, export |
| [Mermaid Live](devdocs/mermaid-live.md) | Live diagram rendering, export, theming |
| [Git Integration](devdocs/git-integration.md) | GitHub/GitLab fetching, URL parsing, API |
| [Infrastructure](devdocs/infrastructure.md) | Docker, networking, deployment |
| [Security](devdocs/security.md) | Authentication, secrets, best practices |
| [Scaling & Failure](devdocs/scaling-and-failure.md) | Performance, bottlenecks, recovery |
| [Future Scope](devdocs/future-scope.md) | Helm Charts, Kustomize (planned) |

---

## ⚠️ Important Notes

### Stateful vs Stateless Services

| Service | State | Notes |
|---------|-------|-------|
| Backend | **Stateless** | No database, processes requests in isolation |
| Frontend | **Stateless** | All state is client-side React state |

### Security Considerations

- ⚠️ **CORS is wide open in development** - Lock down for production
- ⚠️ **No authentication** - Add auth before exposing publicly
- ⚠️ **File uploads not validated** - Large files could cause memory issues
- ⚠️ **No rate limiting** - Add rate limiting for production

### Current Limitations

- **In-memory processing only** - No persistence of analysis results
- **Single-node only** - Not designed for horizontal scaling yet
- **Demo-quality** - Suitable for learning/demos, needs hardening for production

### Common Pitfalls

1. **YAML parsing errors** - Ensure files are valid YAML (use a linter)
2. **Truncated files** - Uploaded files must be complete (no cut-off lines)
3. **Large files** - Very complex compose files may render slowly
4. **Port conflicts** - Backend (3001) and frontend (5173) must be available

### Resource Usage

- Frontend: ~50-100MB RAM in browser
- Backend: ~100-200MB RAM depending on file size
- No CPU-intensive operations (parsing is synchronous but fast)

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ for the DevOps community
</p>
