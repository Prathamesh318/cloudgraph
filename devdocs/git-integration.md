# Git Integration

This document explains how CloudGraph fetches configuration files directly from GitHub and GitLab repositories.

---

## Overview

CloudGraph can analyze infrastructure configurations directly from Git repositories without requiring users to download files first.

### Supported Providers

| Provider | Status | Auth Support |
|----------|--------|--------------|
| **GitHub** | ✅ Full | Public repos (tokens planned) |
| **GitLab** | ✅ Full | Public repos (tokens planned) |
| Bitbucket | ❌ Planned | - |

### Features

- **URL Parsing** - Supports repo, branch, and path URLs
- **Recursive Scanning** - Finds YAML files in subdirectories
- **Auto-Detection** - Filters to config files only
- **Error Handling** - Rate limits, 404s, access denied

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│                                                                  │
│  FileUpload.tsx                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  [https://github.com/owner/repo__________] [Fetch]          ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  api.ts: fetchFromGit(url)                                      │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ POST /api/git/fetch
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Backend                                 │
│                                                                  │
│  routes/git.ts                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  POST /api/git/fetch                                        ││
│  │  GET  /api/git/validate                                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  services/gitService.ts                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  1. Parse URL → detect provider                             ││
│  │  2. Call provider API (GitHub/GitLab)                       ││
│  │  3. Recursively fetch directory contents                    ││
│  │  4. Filter to YAML files                                    ││
│  │  5. Fetch file contents                                     ││
│  │  6. Return { files, errors, repoInfo }                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## URL Formats Supported

### GitHub

```
# Repo root (uses main branch)
https://github.com/owner/repo

# Specific branch
https://github.com/owner/repo/tree/main

# Specific directory
https://github.com/owner/repo/tree/main/k8s/manifests

# With .git suffix (handled)
https://github.com/owner/repo.git
```

### GitLab

```
# Repo root
https://gitlab.com/owner/repo

# Specific branch
https://gitlab.com/owner/repo/-/tree/main

# Specific directory
https://gitlab.com/owner/repo/-/tree/main/deploy/k8s
```

---

## API Endpoints

### POST /api/git/fetch

Fetch configuration files from a repository.

**Request:**
```json
{
    "url": "https://github.com/kubernetes/examples",
    "token": "ghp_xxxx"  // Optional, for private repos
}
```

**Response (Success):**
```json
{
    "files": [
        { "name": "guestbook/redis-leader-deployment.yaml", "content": "..." },
        { "name": "guestbook/redis-follower-deployment.yaml", "content": "..." }
    ],
    "errors": [],
    "repoInfo": {
        "provider": "github",
        "owner": "kubernetes",
        "repo": "examples",
        "branch": "main",
        "path": ""
    }
}
```

**Response (No Files):**
```json
{
    "files": [],
    "errors": [],
    "repoInfo": { ... },
    "message": "No YAML configuration files found in this repository"
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Missing required field: url | No URL provided |
| 400 | Unsupported provider | Not GitHub/GitLab |
| 404 | Repository not found | Invalid URL or private repo |
| 429 | Rate limit exceeded | Too many API calls |
| 500 | Git Fetch Failed | Other errors |

### GET /api/git/validate

Validate a Git URL without fetching.

**Request:**
```
GET /api/git/validate?url=https://github.com/owner/repo
```

**Response:**
```json
{
    "valid": true,
    "provider": "github"
}
```

---

## File Filtering

### Included Patterns

```typescript
const CONFIG_FILE_PATTERNS = [
    /docker-compose\.ya?ml$/i,   // docker-compose.yaml
    /compose\.ya?ml$/i,          // compose.yaml
    /\.ya?ml$/i,                 // Any .yaml or .yml
];
```

### Excluded Directories

```typescript
const IGNORE_PATTERNS = [
    /node_modules/,
    /\.git/,
    /vendor/,
    /\.github/,
    /test/,
    /tests/,
    /__tests__/,
];
```

---

## Implementation Details

### URL Parsing (GitHub)

```typescript
function parseGitHubUrl(url: string) {
    const patterns = [
        // github.com/owner/repo/tree/branch/path
        /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/?(.*)?/,
        // github.com/owner/repo
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
```

### GitHub API Flow

```typescript
// 1. List directory contents
const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
const contents = await fetch(apiUrl).then(r => r.json());

// 2. For each file, fetch content
for (const item of contents) {
    if (item.type === 'file' && shouldIncludeFile(item.path)) {
        const content = await fetch(item.download_url).then(r => r.text());
        files.push({ name: item.path, content });
    }
    
    // 3. Recurse into directories
    if (item.type === 'dir') {
        await processDirectory(item.path);
    }
}
```

### GitLab API Flow

```typescript
// 1. List all files recursively
const projectPath = encodeURIComponent(`${owner}/${repo}`);
const apiUrl = `https://gitlab.com/api/v4/projects/${projectPath}/repository/tree?ref=${branch}&recursive=true`;

// 2. Filter to YAML files
const yamlFiles = contents.filter(c => c.type === 'blob' && shouldIncludeFile(c.path));

// 3. Fetch each file's content
for (const file of yamlFiles) {
    const fileUrl = `https://gitlab.com/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(file.path)}/raw?ref=${branch}`;
    const content = await fetch(fileUrl).then(r => r.text());
}
```

---

## Rate Limits

### GitHub (Unauthenticated)

- **60 requests/hour** per IP
- Recursive fetching counts multiple requests
- Large repos may hit limits quickly

### GitHub (With Token)

- **5,000 requests/hour**
- Recommended for production use

### GitLab

- **60 requests/minute** for some endpoints
- More generous than GitHub for tree/file endpoints

---

## Error Handling

| Scenario | Detection | User Message |
|----------|-----------|--------------|
| Invalid URL | Regex doesn't match | "Invalid GitHub/GitLab URL format" |
| Repo not found | 404 response | "Repository or path not found" |
| Rate limited | 403 response | "API rate limit exceeded" |
| Private repo | 404 response | "Check the URL or ensure the repo is public" |
| Network error | fetch throws | "Failed to fetch from Git" |

---

## Frontend Integration

### FileUpload Component

```tsx
const [gitUrl, setGitUrl] = useState('');
const [isGitFetching, setIsGitFetching] = useState(false);

const handleGitFetch = async () => {
    setIsGitFetching(true);
    try {
        const result = await fetchFromGit(gitUrl);
        onFilesChange([...files, ...result.files]);
    } catch (err) {
        setGitError(err.message);
    } finally {
        setIsGitFetching(false);
    }
};
```

### User Flow

1. Click "From Git" button
2. Enter repository URL
3. Click "Fetch" or press Enter
4. Files are added to the list
5. Click "Analyze Dependencies"

---

## Security Considerations

- **No credentials stored** - Tokens are passed per-request only
- **Public repos only** (currently) - Private repo support planned
- **No server-side caching** - Each request fetches fresh data
- **URL validation** - Only GitHub/GitLab URLs accepted

---

## Future Enhancements

1. **Private Repo Support** - OAuth flow for GitHub/GitLab
2. **Bitbucket Support** - Third provider
3. **Branch Selection UI** - Dropdown of branches
4. **File Preview** - Show files before analyzing
5. **Caching** - Reduce API calls for repeated fetches

---

## Related Documentation

- [Architecture Overview](architecture-overview.md) - System design
- [Parser & Processing](parser-and-processing.md) - How YAML files are parsed
