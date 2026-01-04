// ============================================
// CloudGraph - AnalysisView Component
// ============================================

import React from 'react';
import type { ArchitecturalAnalysis } from '../types';

interface AnalysisViewProps {
    analysis: ArchitecturalAnalysis;
}

const GROUP_COLORS = {
    frontend: '#3b82f6',
    backend: '#22c55e',
    data: '#8b5cf6',
    infra: '#f97316',
    external: '#ef4444',
};

export const AnalysisView: React.FC<AnalysisViewProps> = ({ analysis }) => {
    return (
        <div className="analysis-panel">
            {/* Overview Section */}
            <div className="analysis-section">
                <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    Architecture Overview
                </h3>
                <div style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.8,
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem'
                }}>
                    {analysis.overview}
                </div>
            </div>

            {/* Logical Groups Section */}
            <div className="analysis-section">
                <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    Logical Groups
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {analysis.logicalGroups.map((group, index) => (
                        <div
                            key={index}
                            style={{
                                padding: 'var(--space-md)',
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                borderLeft: `4px solid ${GROUP_COLORS[group.category] || 'var(--text-muted)'}`
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 'var(--space-sm)'
                            }}>
                                <span style={{ fontWeight: 600 }}>{group.name}</span>
                                <span
                                    className="badge"
                                    style={{
                                        backgroundColor: `${GROUP_COLORS[group.category]}20`,
                                        color: GROUP_COLORS[group.category]
                                    }}
                                >
                                    {group.resources.length} resources
                                </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {group.resources.slice(0, 5).join(', ')}
                                {group.resources.length > 5 && `, +${group.resources.length - 5} more`}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* External Dependencies Section */}
            {analysis.externalDependencies.length > 0 && (
                <div className="analysis-section" style={{ gridColumn: '1 / -1' }}>
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                        External Dependencies
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                        {analysis.externalDependencies.map((dep, index) => (
                            <div
                                key={index}
                                className="card"
                                style={{
                                    padding: 'var(--space-sm) var(--space-md)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-sm)'
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{dep.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {dep.type} • {dep.confidence} confidence
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Critical Paths Section */}
            {analysis.criticalPaths.length > 0 && (
                <div className="analysis-section" style={{ gridColumn: '1 / -1' }}>
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        Critical Paths
                    </h3>
                    {analysis.criticalPaths.map((path, index) => (
                        <div key={index} className="risk-card">
                            <div className="risk-header">
                                <span className={`badge severity-${path.riskLevel}`}>
                                    {path.riskLevel}
                                </span>
                                <span className="risk-title">{path.description}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                {path.path.map((node, i) => (
                                    <React.Fragment key={i}>
                                        <code style={{ fontSize: '0.75rem' }}>{node}</code>
                                        {i < path.path.length - 1 && (
                                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
