// ============================================
// CloudGraph - Git Service
// Fetch configuration files from GitHub/GitLab
// ============================================

// FileInput interface (matching shared/types.ts)
interface FileInput {
    name: string;
    content: string;
}

// Supported file patterns for config files
const CONFIG_FILE_PATTERNS = [
    /docker-compose\.ya?ml$/i,
    /compose\.ya?ml$/i,
    /\.ya?ml$/i,  // Any YAML file
];

// Files/directories to ignore
const IGNORE_PATTERNS = [
    /node_modules/,
    /\.git/,
    /vendor/,
    /\.github/,
    /test/,
    /tests/,
    /__tests__/,
];

interface GitHubContent {
    name: string;
    path: string;
    type: 'file' | 'dir';
    download_url?: string;
    size?: number;
}

interface GitLabContent {
    name: string;
    path: string;
    type: 'blob' | 'tree';
}

export interface GitFetchResult {
    files: FileInput[];
    errors: string[];
    repoInfo: {
        provider: 'github' | 'gitlab';
        owner: string;
        repo: string;
        branch: string;
        path: string;
    };
}

// Parse GitHub URL
// Formats:
// - https://github.com/owner/repo
// - https://github.com/owner/repo/tree/branch
// - https://github.com/owner/repo/tree/branch/path/to/folder
function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string; path: string } | null {
    const patterns = [
        // Full path: github.com/owner/repo/tree/branch/path
        /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/?(.*)?/,
        // Just repo: github.com/owner/repo
        /github\.com\/([^\/]+)\/([^\/]+)\/?$/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return {
                owner: match[1],
                repo: match[2].replace(/\.git$/, ''),
                branch: match[3] || 'main',
                path: match[4] || '',
            };
        }
    }
    return null;
}

// Parse GitLab URL
// Formats:
// - https://gitlab.com/owner/repo
// - https://gitlab.com/owner/repo/-/tree/branch
// - https://gitlab.com/owner/repo/-/tree/branch/path/to/folder
function parseGitLabUrl(url: string): { owner: string; repo: string; branch: string; path: string } | null {
    const patterns = [
        // Full path: gitlab.com/owner/repo/-/tree/branch/path
        /gitlab\.com\/([^\/]+)\/([^\/]+)\/-\/tree\/([^\/]+)\/?(.*)?/,
        // Just repo: gitlab.com/owner/repo
        /gitlab\.com\/([^\/]+)\/([^\/]+)\/?$/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return {
                owner: match[1],
                repo: match[2].replace(/\.git$/, ''),
                branch: match[3] || 'main',
                path: match[4] || '',
            };
        }
    }
    return null;
}

// Check if file should be included
function shouldIncludeFile(path: string): boolean {
    // Check ignore patterns
    for (const pattern of IGNORE_PATTERNS) {
        if (pattern.test(path)) {
            return false;
        }
    }

    // Check if it's a config file
    for (const pattern of CONFIG_FILE_PATTERNS) {
        if (pattern.test(path)) {
            return true;
        }
    }

    return false;
}

// Fetch file content from URL
async function fetchFileContent(url: string, token?: string): Promise<string> {
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3.raw',
    };

    if (token) {
        headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
    }

    return response.text();
}

// Fetch from GitHub API
export async function fetchFromGitHub(url: string, token?: string): Promise<GitFetchResult> {
    const parsed = parseGitHubUrl(url);

    if (!parsed) {
        throw new Error('Invalid GitHub URL format');
    }

    const { owner, repo, branch, path } = parsed;
    const files: FileInput[] = [];
    const errors: string[] = [];

    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
    };

    if (token) {
        headers['Authorization'] = `token ${token}`;
    }

    // Fetch directory contents
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Repository or path not found. Check the URL or ensure the repo is public.');
        }
        if (response.status === 403) {
            throw new Error('API rate limit exceeded. Try again later or provide a GitHub token.');
        }
        throw new Error(`GitHub API error: ${response.status}`);
    }

    const contents = await response.json() as GitHubContent[];

    // Process files and directories
    const fetchPromises: Promise<void>[] = [];

    const processContent = async (content: GitHubContent, basePath: string = '') => {
        const fullPath = basePath ? `${basePath}/${content.name}` : content.name;

        if (content.type === 'file' && content.download_url && shouldIncludeFile(content.path)) {
            try {
                const fileContent = await fetchFileContent(content.download_url, token);
                files.push({
                    name: fullPath,
                    content: fileContent,
                });
            } catch (err) {
                errors.push(`Failed to fetch ${fullPath}: ${(err as Error).message}`);
            }
        } else if (content.type === 'dir' && !IGNORE_PATTERNS.some(p => p.test(content.path))) {
            // Recursively fetch directory contents (limit depth)
            const dirUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${content.path}?ref=${branch}`;
            try {
                const dirResponse = await fetch(dirUrl, { headers });
                if (dirResponse.ok) {
                    const dirContents = await dirResponse.json() as GitHubContent[];
                    for (const item of dirContents) {
                        await processContent(item, fullPath);
                    }
                }
            } catch (err) {
                errors.push(`Failed to fetch directory ${fullPath}: ${(err as Error).message}`);
            }
        }
    };

    // Process all contents
    for (const content of contents) {
        fetchPromises.push(processContent(content));
    }

    await Promise.all(fetchPromises);

    return {
        files,
        errors,
        repoInfo: {
            provider: 'github',
            owner,
            repo,
            branch,
            path,
        },
    };
}

// Fetch from GitLab API
export async function fetchFromGitLab(url: string, token?: string): Promise<GitFetchResult> {
    const parsed = parseGitLabUrl(url);

    if (!parsed) {
        throw new Error('Invalid GitLab URL format');
    }

    const { owner, repo, branch, path } = parsed;
    const files: FileInput[] = [];
    const errors: string[] = [];

    const headers: Record<string, string> = {};

    if (token) {
        headers['PRIVATE-TOKEN'] = token;
    }

    // GitLab uses URL-encoded project path
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const encodedPath = encodeURIComponent(path || '');
    const apiUrl = `https://gitlab.com/api/v4/projects/${projectPath}/repository/tree?ref=${branch}&path=${encodedPath}&recursive=true`;

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Repository or path not found. Check the URL or ensure the repo is public.');
        }
        throw new Error(`GitLab API error: ${response.status}`);
    }

    const contents = await response.json() as GitLabContent[];

    // Filter to files only
    const yamlFiles = contents.filter(c => c.type === 'blob' && shouldIncludeFile(c.path));

    // Fetch file contents
    for (const file of yamlFiles) {
        try {
            const fileUrl = `https://gitlab.com/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(file.path)}/raw?ref=${branch}`;
            const fileResponse = await fetch(fileUrl, { headers });

            if (fileResponse.ok) {
                const content = await fileResponse.text();
                files.push({
                    name: file.path,
                    content,
                });
            }
        } catch (err) {
            errors.push(`Failed to fetch ${file.path}: ${(err as Error).message}`);
        }
    }

    return {
        files,
        errors,
        repoInfo: {
            provider: 'gitlab',
            owner,
            repo,
            branch,
            path,
        },
    };
}

// Detect provider and fetch
export async function fetchFromGit(url: string, token?: string): Promise<GitFetchResult> {
    if (url.includes('github.com')) {
        return fetchFromGitHub(url, token);
    } else if (url.includes('gitlab.com')) {
        return fetchFromGitLab(url, token);
    } else {
        throw new Error('Unsupported Git provider. Only GitHub and GitLab are supported.');
    }
}
