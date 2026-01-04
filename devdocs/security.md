# Security

This document covers security considerations, authentication, and best practices for CloudGraph.

---

## Current Security Posture

> ⚠️ **Important**: CloudGraph is currently a development/demo application without production security hardening.

### What's Protected

| Area | Status | Notes |
|------|--------|-------|
| Authentication | ❌ None | No user authentication |
| Authorization | ❌ None | No access control |
| Input Validation | ⚠️ Basic | YAML parsing only |
| CORS | ⚠️ Wide Open | All origins allowed |
| Rate Limiting | ❌ None | No request throttling |
| HTTPS | ❌ None | HTTP only in development |

---

## Security Considerations

### 1. File Upload Risks

**Current State**:
- Files are read entirely into memory
- Content is parsed as YAML
- No file type validation beyond extension hints

**Risks**:
- Large files could exhaust memory (DoS)
- Malicious YAML could trigger parser bugs
- No virus/malware scanning

**Recommendations**:
```typescript
// Add file size limits
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

if (file.content.length > MAX_FILE_SIZE) {
    throw new Error('File too large');
}

// Validate YAML structure before deep parsing
const quickParse = yaml.load(file.content, { json: true });
if (typeof quickParse !== 'object') {
    throw new Error('Invalid YAML structure');
}
```

### 2. CORS Configuration

**Current State** (app.ts):
```typescript
app.use(cors());  // Allows ALL origins
```

**Production Fix**:
```typescript
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: false
}));
```

### 3. No Authentication

**Risks**:
- Anyone can use the API
- No usage tracking
- No access control

**Recommendations for Production**:
```typescript
// JWT authentication middleware
import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// Apply to routes
app.use('/api', authMiddleware, analyzeRouter);
```

---

## Secrets Management

### Current State

- No secrets in the application
- No database credentials
- No API keys

### If Adding Secrets

**Do NOT**:
```typescript
// Never hardcode secrets
const API_KEY = 'sk-1234567890abcdef';  // ❌ BAD
```

**Do**:
```typescript
// Use environment variables
const API_KEY = process.env.API_KEY;  // ✅ GOOD

// Validate at startup
if (!process.env.API_KEY) {
    throw new Error('API_KEY environment variable required');
}
```

**In Production**:
- Use secret management services (Vault, AWS Secrets Manager)
- Never commit `.env` files
- Use different secrets per environment

---

## Input Validation

### YAML Parsing Safety

The `js-yaml` library is used with default safe options:

```typescript
import yaml from 'js-yaml';

// Default behavior - safe by default
const doc = yaml.load(content);  // ✅ Safe

// NEVER use unsafeLoad
// yaml.unsafeLoad(content);  // ❌ Dangerous
```

### Additional Validation

```typescript
// Validate expected structure
function validateDockerCompose(doc: unknown): boolean {
    if (typeof doc !== 'object' || doc === null) {
        return false;
    }
    
    // Check for expected keys
    const validKeys = ['version', 'services', 'networks', 'volumes'];
    const docKeys = Object.keys(doc);
    
    return docKeys.some(key => validKeys.includes(key));
}
```

---

## Rate Limiting

**Not Implemented** - Should add for production:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,                   // 100 requests per window
    message: { error: 'Too many requests' }
});

app.use('/api', limiter);
```

---

## Network Security

### Development (Current)

```
Browser ──HTTP──► Frontend (5173) ──HTTP──► Backend (3001)
```

### Production (Recommended)

```
Browser ──HTTPS──► Load Balancer ──HTTP──► Backend (internal)
                        │
                        └──► Frontend (static)
```

**Key Points**:
- Terminate TLS at load balancer
- Backend should NOT be publicly accessible
- Use internal networking for service-to-service

---

## Headers Security

**Not Implemented** - Add with [Helmet](https://helmetjs.github.io/):

```typescript
import helmet from 'helmet';

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true
    }
}));
```

---

## Security Checklist for Production

### Must Have

- [ ] Add authentication (JWT, OAuth, etc.)
- [ ] Configure CORS with specific origins
- [ ] Add rate limiting
- [ ] Enable HTTPS
- [ ] Add security headers (Helmet)
- [ ] Set file size limits
- [ ] Add input validation

### Should Have

- [ ] Add request logging with user context
- [ ] Monitor for unusual patterns
- [ ] Add API versioning
- [ ] Implement graceful degradation

### Nice to Have

- [ ] Add OWASP security testing
- [ ] Set up vulnerability scanning
- [ ] Add security alerting
- [ ] Conduct penetration testing

---

## Vulnerability Management

### Dependencies

Check for vulnerabilities:

```bash
npm audit
```

Fix automatically:

```bash
npm audit fix
```

### Keep Updated

```bash
# Check outdated packages
npm outdated

# Update packages
npm update
```

---

## Next Steps

- [Scaling & Failure](scaling-and-failure.md) - Resilience patterns
- [Infrastructure](infrastructure.md) - Deployment setup
