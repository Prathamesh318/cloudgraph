// ============================================
// CloudGraph - FileUpload Component
// ============================================

import React, { useCallback, useState } from 'react';
import type { FileInput } from '../types';
import { fetchFromGit } from '../services/api';

interface FileUploadProps {
    files: FileInput[];
    onFilesChange: (files: FileInput[]) => void;
    onAnalyze: () => void;
    onSampleLoad: (type: 'docker' | 'k8s') => void;
    isLoading: boolean;
    error: string | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    files,
    onFilesChange,
    onAnalyze,
    onSampleLoad,
    isLoading,
    error
}) => {
    const [isDragActive, setIsDragActive] = useState(false);
    const [gitUrl, setGitUrl] = useState('');
    const [isGitFetching, setIsGitFetching] = useState(false);
    const [gitError, setGitError] = useState<string | null>(null);
    const [showGitInput, setShowGitInput] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragActive(true);
        } else if (e.type === 'dragleave') {
            setIsDragActive(false);
        }
    }, []);

    const processFiles = useCallback(async (fileList: FileList) => {
        const newFiles: FileInput[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            if (file.name.endsWith('.yml') || file.name.endsWith('.yaml')) {
                const content = await file.text();
                newFiles.push({ name: file.name, content });
            }
        }

        onFilesChange([...files, ...newFiles]);
    }, [files, onFilesChange]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    }, [processFiles]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
        }
    }, [processFiles]);

    const removeFile = useCallback((index: number) => {
        onFilesChange(files.filter((_, i) => i !== index));
    }, [files, onFilesChange]);

    const handleGitFetch = async () => {
        if (!gitUrl.trim()) return;

        setIsGitFetching(true);
        setGitError(null);

        try {
            const result = await fetchFromGit(gitUrl.trim());

            if (result.files.length === 0) {
                setGitError(result.message || 'No YAML files found in this repository');
                return;
            }

            onFilesChange([...files, ...result.files]);
            setGitUrl('');
            setShowGitInput(false);

            if (result.errors.length > 0) {
                console.warn('Git fetch warnings:', result.errors);
            }
        } catch (err) {
            setGitError((err as Error).message);
        } finally {
            setIsGitFetching(false);
        }
    };

    return (
        <div className="upload-screen">
            <div className="upload-header animate-fade-in">
                <h1>
                    Analyze Your <span className="gradient-text">Infrastructure</span>
                </h1>
                <p>
                    Upload Docker Compose or Kubernetes configuration files to visualize
                    dependencies and discover architectural insights.
                </p>
            </div>

            <div
                className={`dropzone animate-slide-up ${isDragActive ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    id="file-input"
                    multiple
                    accept=".yml,.yaml"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                />

                <svg className="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 18a4.6 4.4 0 0 1 0-9 5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" />
                    <path d="M12 13v9" />
                    <path d="m9 16 3-3 3 3" />
                </svg>

                <h3>Drop your YAML files here</h3>
                <p>Supports Docker Compose & Kubernetes manifests</p>

                <div className="file-types">
                    <span className="file-type-badge docker">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.186m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.185-.186h-2.119a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />
                        </svg>
                        docker-compose.yml
                    </span>
                    <span className="file-type-badge k8s">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10.204 14.35l.007.01-.999 2.413a5.171 5.171 0 0 1-2.075-2.597l2.578-.437.004.005a.44.44 0 0 1 .484.606zm-.833-2.129a.44.44 0 0 0 .173-.756l.002-.011L7.585 9.7a5.143 5.143 0 0 0-.73 3.255l2.514-.725.002-.009zm1.145-1.98a.44.44 0 0 0 .699-.337l.01-.005.15-2.62a5.144 5.144 0 0 0-3.01 1.442l2.147 1.523.004-.003zm2.369 2.223a.44.44 0 0 0-.484.606l-.004.005.999 2.413a5.171 5.171 0 0 0 2.075-2.597l-2.578-.437-.008.01zm.833-2.129a.44.44 0 0 1-.173-.756l-.002-.011 1.96-1.754a5.143 5.143 0 0 1 .73 3.255l-2.514-.725-.001-.009zm-1.145-1.98a.44.44 0 0 1-.699-.337l-.01-.005-.15-2.62a5.144 5.144 0 0 1 3.01 1.442l-2.147 1.523-.004-.003zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5c4.687 0 8.5 3.813 8.5 8.5s-3.813 8.5-8.5 8.5S3.5 16.687 3.5 12 7.313 3.5 12 3.5z" />
                        </svg>
                        *.yaml
                    </span>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <label htmlFor="file-input" className="btn btn-primary btn-lg">
                        Browse Files
                    </label>
                    <button
                        type="button"
                        className={`btn btn-secondary btn-lg ${showGitInput ? 'active' : ''}`}
                        onClick={() => setShowGitInput(!showGitInput)}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                        </svg>
                        From Git
                    </button>
                </div>
            </div>

            {/* Git URL Input */}
            {showGitInput && (
                <div className="git-input-section animate-slide-up" style={{
                    marginTop: 'var(--space-lg)',
                    width: '100%',
                    maxWidth: '600px',
                    padding: 'var(--space-lg)',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-lg)'
                }}>
                    <h4 style={{
                        marginBottom: 'var(--space-md)',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-sm)'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                        </svg>
                        Fetch from Git Repository
                    </h4>
                    <p style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        marginBottom: 'var(--space-md)'
                    }}>
                        Enter a GitHub or GitLab repository URL to fetch YAML configuration files.
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        <input
                            type="url"
                            placeholder="https://github.com/owner/repo or https://github.com/owner/repo/tree/main/k8s"
                            value={gitUrl}
                            onChange={(e) => setGitUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGitFetch()}
                            disabled={isGitFetching}
                            style={{
                                flex: 1,
                                padding: 'var(--space-sm) var(--space-md)',
                                backgroundColor: 'var(--bg-tertiary)',
                                border: '1px solid var(--bg-hover)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontSize: '0.875rem'
                            }}
                        />
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleGitFetch}
                            disabled={isGitFetching || !gitUrl.trim()}
                        >
                            {isGitFetching ? (
                                <>
                                    <span className="spinner" style={{ width: '14px', height: '14px' }}></span>
                                    Fetching...
                                </>
                            ) : (
                                'Fetch'
                            )}
                        </button>
                    </div>
                    {gitError && (
                        <p style={{
                            marginTop: 'var(--space-sm)',
                            fontSize: '0.875rem',
                            color: 'var(--status-error)'
                        }}>
                            {gitError}
                        </p>
                    )}
                    <p style={{
                        marginTop: 'var(--space-sm)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)'
                    }}>
                        Supports public repositories. For private repos, authentication coming soon.
                    </p>
                </div>
            )}

            {files.length > 0 && (
                <div className="uploaded-files animate-slide-up" style={{ marginTop: 'var(--space-lg)', width: '100%', maxWidth: '600px' }}>
                    <h4 style={{ marginBottom: 'var(--space-sm)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Uploaded Files ({files.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                        {files.map((file, index) => (
                            <div
                                key={index}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-sm) var(--space-md)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    borderRadius: 'var(--radius-md)',
                                }}
                            >
                                <span style={{ fontSize: '0.875rem' }}>{file.name}</span>
                                <button
                                    onClick={() => removeFile(index)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: 'var(--space-xs)'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={onAnalyze}
                        disabled={isLoading}
                        style={{ marginTop: 'var(--space-md)', width: '100%' }}
                    >
                        {isLoading ? (
                            <>
                                <span className="spinner"></span>
                                Analyzing...
                            </>
                        ) : (
                            'Analyze Dependencies'
                        )}
                    </button>
                </div>
            )}

            {error && (
                <div
                    className="animate-slide-up"
                    style={{
                        marginTop: 'var(--space-lg)',
                        padding: 'var(--space-md)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--danger)',
                        maxWidth: '600px',
                        width: '100%'
                    }}
                >
                    {error}
                </div>
            )}

            <div className="sample-configs animate-fade-in">
                <p>Or try with a sample configuration:</p>
                <div className="sample-buttons">
                    <button
                        className="btn btn-secondary"
                        onClick={() => onSampleLoad('docker')}
                        disabled={isLoading}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.186" />
                        </svg>
                        Microservices Stack
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => onSampleLoad('k8s')}
                        disabled={isLoading}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5c4.687 0 8.5 3.813 8.5 8.5s-3.813 8.5-8.5 8.5S3.5 16.687 3.5 12 7.313 3.5 12 3.5z" />
                        </svg>
                        Kubernetes App
                    </button>
                </div>
            </div>
        </div>
    );
};
