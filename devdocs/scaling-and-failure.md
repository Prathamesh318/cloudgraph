# Scaling & Failure

This document covers performance characteristics, scaling strategies, and failure handling for CloudGraph.

---

## Current Architecture Limitations

CloudGraph is currently designed for single-node operation:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Single Node Architecture                     │
│                                                                  │
│  ┌─────────────────┐              ┌─────────────────┐           │
│  │                 │              │                 │           │
│  │    Frontend     │──── API ────►│    Backend      │           │
│  │    (Static)     │              │    (Node.js)    │           │
│  │                 │              │                 │           │
│  └─────────────────┘              └─────────────────┘           │
│                                                                  │
│  No database, no message queue, no external dependencies        │
└─────────────────────────────────────────────────────────────────┘
```

### Bottlenecks

| Component | Bottleneck | Impact |
|-----------|------------|--------|
| Backend | Single process | Limited concurrent requests |
| Parsing | Synchronous | Blocks event loop |
| Memory | In-memory processing | Large files use more RAM |
| No caching | Repeat analysis | Same files re-parsed |

---

## Resource Usage

### Memory Consumption

```
┌─────────────────────────────────────────────────────────────────┐
│  Memory Profile During Analysis                                  │
│                                                                  │
│  Request Start   Parsing      Analysis     Response    Cleanup   │
│       │            │             │            │           │      │
│  50MB │────────────│             │            │           │      │
│       │            │             │            │           │      │
│ 100MB │            │─────────────│            │           │      │
│       │            │             │            │           │      │
│ 150MB │            │             │────────────│           │      │
│       │            │             │            │           │      │
│ 100MB │            │             │            │───────────│      │
│       │            │             │            │           │      │
│  50MB │            │             │            │           │──────│
└─────────────────────────────────────────────────────────────────┘
```

### Estimated Usage

| File Size | Resources | Memory Usage |
|-----------|-----------|--------------|
| Small (< 1KB) | 5-10 | ~50MB |
| Medium (5-10KB) | 20-50 | ~100MB |
| Large (50KB+) | 100+ | ~200-500MB |

---

## Scaling Strategies

### Horizontal Scaling (Stateless Backend)

Since the backend is stateless, horizontal scaling is straightforward:

```
                    ┌─────────────┐
                    │   Load      │
        Request ───►│  Balancer   │
                    │ (Round-robin)│
                    └──────┬──────┘
               ┌───────────┼───────────┐
               ▼           ▼           ▼
          ┌────────┐  ┌────────┐  ┌────────┐
          │Backend │  │Backend │  │Backend │
          │   #1   │  │   #2   │  │   #3   │
          └────────┘  └────────┘  └────────┘
```

**Implementation** (Docker Compose):

```yaml
services:
  backend:
    image: cloudgraph-backend
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
```

### Vertical Scaling

For larger files, increase Node.js memory:

```bash
# Increase heap size to 4GB
node --max-old-space-size=4096 dist/app.js
```

---

## Performance Optimization

### 1. Add Caching

Cache analysis results by file hash:

```typescript
import crypto from 'crypto';

const cache = new Map<string, AnalysisResult>();

function getFileHash(files: FileInput[]): string {
    const content = files.map(f => f.content).join('');
    return crypto.createHash('sha256').update(content).digest('hex');
}

async function analyzeFiles(files: FileInput[]): Promise<AnalysisResult> {
    const hash = getFileHash(files);
    
    if (cache.has(hash)) {
        return cache.get(hash)!;
    }
    
    const result = await performAnalysis(files);
    cache.set(hash, result);
    
    return result;
}
```

### 2. Worker Threads for Large Files

Move parsing to worker threads:

```typescript
import { Worker } from 'worker_threads';

function parseInWorker(file: FileInput): Promise<ParsedYamlFile> {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./parser-worker.js', {
            workerData: { file }
        });
        
        worker.on('message', resolve);
        worker.on('error', reject);
    });
}
```

### 3. Streaming for Large Responses

Use streaming for large graph responses:

```typescript
app.get('/api/analyze/stream', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Stream nodes first
    res.write('{"nodes":[');
    for (const node of nodes) {
        res.write(JSON.stringify(node) + ',');
    }
    res.write('],');
    
    // Then edges
    res.write('"edges":[');
    // ...
});
```

---

## Failure Scenarios

### 1. Invalid YAML

**Scenario**: User uploads malformed YAML
**Current Handling**: Error caught, returned in response
**User Impact**: Sees error message, can retry

```typescript
try {
    yaml.loadAll(content);
} catch (err) {
    errors.push(`YAML syntax error: ${err.message}`);
}
```

### 2. Out of Memory

**Scenario**: Very large file exhausts memory
**Current Handling**: Process crashes
**Recovery**: Node.js restarts (if using PM2/Docker)

**Prevention**:
```typescript
const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB

if (req.headers['content-length'] > MAX_CONTENT_SIZE) {
    return res.status(413).json({ error: 'Payload too large' });
}
```

### 3. Request Timeout

**Scenario**: Complex file takes too long
**Current Handling**: No timeout set
**Fix**:

```typescript
import timeout from 'connect-timeout';

app.use('/api/analyze', timeout('30s'));

app.use((req, res, next) => {
    if (!req.timedout) next();
});
```

### 4. Backend Crashes

**Scenario**: Unhandled exception
**Current Handling**: Process exits
**Prevention**:

```typescript
// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    // Log error, cleanup, exit gracefully
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});
```

---

## Graceful Degradation

### Health Checks

```typescript
app.get('/api/health', (req, res) => {
    const healthcheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    };
    
    res.json(healthcheck);
});
```

### Readiness Check

```typescript
let isReady = false;

app.get('/api/ready', (req, res) => {
    if (isReady) {
        res.json({ status: 'ready' });
    } else {
        res.status(503).json({ status: 'not ready' });
    }
});

// Set ready after initialization
app.listen(PORT, () => {
    isReady = true;
});
```

---

## Monitoring Recommendations

### Metrics to Track

| Metric | Type | Purpose |
|--------|------|---------|
| Request count | Counter | Traffic volume |
| Response time | Histogram | Performance |
| Error rate | Counter | Reliability |
| Memory usage | Gauge | Resource health |
| File size | Histogram | Usage patterns |

### Alerting Thresholds

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Error rate > 5% | 5 min window | Page on-call |
| P99 latency > 30s | 5 min window | Investigate |
| Memory > 80% | Sustained | Scale out |

---

## Capacity Planning

### Estimated Capacity (Single Node, 1GB RAM)

| Metric | Capacity |
|--------|----------|
| Concurrent requests | ~10-20 |
| Requests per second | ~5-10 |
| Max file size | ~5-10MB |
| Files per analysis | ~10-20 |

### Scaling Recommendations

| Load Level | Strategy |
|------------|----------|
| < 10 req/s | Single node |
| 10-50 req/s | 2-3 replicas |
| 50-200 req/s | 5-10 replicas + caching |
| 200+ req/s | Consider architecture changes |

---

## Recovery Playbook

### Backend Not Responding

1. Check health endpoint: `GET /api/health`
2. Check logs for errors
3. Check memory usage
4. Restart if necessary
5. Scale up if memory-related

### High Latency

1. Check file sizes being processed
2. Check concurrent request count
3. Add more replicas
4. Enable caching

### Complete Outage

1. Check load balancer health
2. Check all backend instances
3. Roll back recent deployments
4. Enable maintenance mode on frontend

---

## Next Steps

- [Security](security.md) - Security hardening
- [Infrastructure](infrastructure.md) - Deployment configuration
