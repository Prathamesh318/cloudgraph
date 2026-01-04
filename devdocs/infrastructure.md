# Infrastructure

This document covers the development and deployment infrastructure for CloudGraph.

---

## Development Setup

### Local Environment

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer Machine                            │
│                                                                  │
│  ┌─────────────────────┐       ┌─────────────────────┐          │
│  │  Terminal 1         │       │  Terminal 2         │          │
│  │                     │       │                     │          │
│  │  cd backend         │       │  cd frontend        │          │
│  │  npm run dev        │       │  npm run dev        │          │
│  │                     │       │                     │          │
│  │  ┌───────────────┐  │       │  ┌───────────────┐  │          │
│  │  │ Express       │  │◄──────│  │ Vite          │  │          │
│  │  │ :3001         │  │ HTTP  │  │ :5173         │  │          │
│  │  │               │  │       │  │               │  │          │
│  │  │ nodemon + ts  │  │       │  │ HMR + React   │  │          │
│  │  └───────────────┘  │       │  └───────────────┘  │          │
│  └─────────────────────┘       └─────────────────────┘          │
│                                                                  │
│                    ┌─────────────────────┐                      │
│                    │  Browser            │                      │
│                    │  localhost:5173     │                      │
│                    └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### Development Tools

| Tool | Purpose |
|------|---------|
| `nodemon` | Auto-restart backend on file changes |
| `ts-node` | Run TypeScript directly without compilation |
| `vite` | Fast frontend dev server with HMR |
| `eslint` | Code linting |
| `typescript` | Type checking |

---

## Backend Configuration

### Express Server (app.ts)

```typescript
const app = express();

// Middleware
app.use(cors());                    // Enable CORS for all origins
app.use(express.json({              // JSON body parsing
    limit: '10mb'                   // Max payload size
}));

// Routes
app.use('/api', analyzeRouter);

// Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`CloudGraph backend running on port ${PORT}`);
});
```

### TypeScript Configuration (backend/tsconfig.json)

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "lib": ["ES2020"],
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "declaration": true,
        "declarationMap": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules"]
}
```

---

## Frontend Configuration

### Vite Configuration (vite.config.ts)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true
            }
        }
    }
});
```

### TypeScript Configuration (frontend/tsconfig.json)

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "useDefineForClassFields": true,
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "skipLibCheck": true,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true
    },
    "include": ["src"]
}
```

---

## CI/CD Pipeline

### GitHub Actions (.github/workflows/build.yml)

```yaml
name: Full Build Check (Frontend + Backend)

on:
  push:
    branches: [master, staging-*]
  pull_request:
    branches: [master, staging-*]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
        working-directory: backend
      - run: npm run build
        working-directory: backend

  frontend:
    runs-on: ubuntu-latest
    needs: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
        working-directory: frontend
      - run: npm run lint
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
```

---

## Production Deployment (Planned)

### Docker Deployment

```dockerfile
# Backend Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/app.js"]
```

```dockerfile
# Frontend Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

### Docker Compose (Production)

```yaml
version: "3.9"

services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
```

---

## Networking

### Development

| Service | Port | Protocol |
|---------|------|----------|
| Frontend (Vite) | 5173 | HTTP |
| Backend (Express) | 3001 | HTTP |

### Production (Planned)

```
Internet
    │
    ▼
┌─────────────┐
│  Nginx      │  :80 / :443
│  (frontend) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Backend    │  :3001 (internal only)
│  (Express)  │
└─────────────┘
```

---

## Volume Management

### Current State

- **No persistent volumes** - All processing is ephemeral
- Database-free architecture

### If Adding Persistence

```yaml
volumes:
  analysis_data:
    driver: local

services:
  backend:
    volumes:
      - analysis_data:/app/data
```

---

## Logging

### Current Strategy

- `console.log` / `console.error` to stdout
- No structured logging framework
- No log aggregation

### Recommended for Production

```typescript
// Use structured logging (e.g., pino)
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});

logger.info({ event: 'analysis_started', fileCount: files.length });
```

---

## Metrics (Not Implemented)

For production, consider:

```typescript
// Prometheus metrics
import promClient from 'prom-client';

const analysisCounter = new promClient.Counter({
    name: 'cloudgraph_analyses_total',
    help: 'Total number of analyses performed',
    labelNames: ['platform', 'status']
});

analysisCounter.inc({ platform: 'docker-compose', status: 'success' });
```

---

## Next Steps

- [Security](security.md) - Security considerations
- [Scaling & Failure](scaling-and-failure.md) - Performance and resilience
