// ============================================
// CloudGraph - API Routes
// ============================================

import { Router, Request, Response } from 'express';
import { analyzeFiles } from '../services/analysisService';
import { validateYaml } from '../utils/yamlParser';
import { AnalyzeRequest, FileInput, AnalysisOptions } from '../../../shared/types';

export const analyzeRouter = Router();

/**
 * POST /api/analyze
 * Analyzes uploaded configuration files and returns dependency analysis
 */
analyzeRouter.post('/analyze', async (req: Request, res: Response) => {
    try {
        const body = req.body as AnalyzeRequest;

        // Validate request
        if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'No files provided. Please include at least one YAML file.'
            });
        }

        // Validate each file has required fields
        for (const file of body.files) {
            if (!file.name || typeof file.name !== 'string') {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Each file must have a name property.'
                });
            }
            if (!file.content || typeof file.content !== 'string') {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: `File "${file.name}" is missing content.`
                });
            }
        }

        const files: FileInput[] = body.files;
        const options: AnalysisOptions = body.options || {};

        // Perform analysis
        const result = await analyzeFiles(files, options);

        return res.json({
            id: result.id,
            status: result.status,
            result
        });
    } catch (error) {
        console.error('Analysis error:', error);
        return res.status(500).json({
            error: 'Analysis Failed',
            message: (error as Error).message
        });
    }
});

/**
 * POST /api/validate
 * Validates YAML files without performing full analysis
 */
analyzeRouter.post('/validate', (req: Request, res: Response) => {
    try {
        const body = req.body as { files: FileInput[] };

        if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'No files provided for validation.'
            });
        }

        const result = validateYaml(body.files);

        return res.json(result);
    } catch (error) {
        console.error('Validation error:', error);
        return res.status(500).json({
            error: 'Validation Failed',
            message: (error as Error).message
        });
    }
});

/**
 * GET /api/health
 * Health check endpoint
 */
analyzeRouter.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});
