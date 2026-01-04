// ============================================
// CloudGraph - Main Express Application
// ============================================

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { analyzeRouter } from './routes/analyze';

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        service: 'cloudgraph-api',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api', analyzeRouter);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
    res.json({
        name: 'CloudGraph API',
        version: '1.0.0',
        description: 'Container Orchestration Dependency Analyzer',
        endpoints: {
            health: 'GET /health',
            analyze: 'POST /api/analyze',
            validate: 'POST /api/validate'
        }
    });
});

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err.message);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🌐 CloudGraph API Server                                ║
║   Container Orchestration Dependency Analyzer             ║
║                                                           ║
║   Server running at: http://localhost:${PORT}              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
