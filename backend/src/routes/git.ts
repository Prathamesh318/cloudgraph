// ============================================
// CloudGraph - Git Routes
// API endpoints for Git integration
// ============================================

import { Router, Request, Response } from 'express';
import { fetchFromGit } from '../services/gitService';

const router = Router();

/**
 * POST /api/git/fetch
 * Fetch configuration files from a GitHub or GitLab repository
 * 
 * Body:
 * - url: string - GitHub or GitLab repository URL
 * - token?: string - Optional access token for private repos
 */
router.post('/fetch', async (req: Request, res: Response) => {
    try {
        const { url, token } = req.body;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({
                error: 'Missing required field: url',
                message: 'Please provide a valid GitHub or GitLab repository URL',
            });
        }

        // Validate URL format
        if (!url.includes('github.com') && !url.includes('gitlab.com')) {
            return res.status(400).json({
                error: 'Unsupported provider',
                message: 'Only GitHub and GitLab URLs are supported',
            });
        }

        console.log(`[Git] Fetching from: ${url}`);

        const result = await fetchFromGit(url, token);

        console.log(`[Git] Fetched ${result.files.length} files from ${result.repoInfo.provider}`);

        if (result.files.length === 0) {
            return res.status(200).json({
                files: [],
                errors: result.errors,
                repoInfo: result.repoInfo,
                message: 'No YAML configuration files found in this repository or path',
            });
        }

        return res.json({
            files: result.files,
            errors: result.errors,
            repoInfo: result.repoInfo,
        });

    } catch (error) {
        console.error('[Git] Fetch error:', error);

        const message = (error as Error).message;

        // Determine appropriate status code
        let statusCode = 500;
        if (message.includes('not found')) {
            statusCode = 404;
        } else if (message.includes('rate limit')) {
            statusCode = 429;
        } else if (message.includes('Invalid')) {
            statusCode = 400;
        }

        return res.status(statusCode).json({
            error: 'Git Fetch Failed',
            message,
        });
    }
});

/**
 * GET /api/git/validate
 * Validate a Git URL without fetching files
 */
router.get('/validate', (req: Request, res: Response) => {
    const url = req.query.url as string;

    if (!url) {
        return res.status(400).json({ valid: false, error: 'No URL provided' });
    }

    const isGitHub = url.includes('github.com');
    const isGitLab = url.includes('gitlab.com');

    if (!isGitHub && !isGitLab) {
        return res.json({
            valid: false,
            error: 'Only GitHub and GitLab URLs are supported'
        });
    }

    return res.json({
        valid: true,
        provider: isGitHub ? 'github' : 'gitlab',
    });
});

export default router;
