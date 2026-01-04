// ============================================
// CloudGraph - RisksView Component
// ============================================

import React, { useState } from 'react';
import type { RiskAssessment, Recommendation, Severity } from '../types';

interface RisksViewProps {
    risks: RiskAssessment[];
    recommendations: Recommendation[];
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

export const RisksView: React.FC<RisksViewProps> = ({ risks, recommendations }) => {
    const [filter, setFilter] = useState<Severity | 'all'>('all');
    const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());

    const filteredRisks = filter === 'all'
        ? risks
        : risks.filter((r) => r.severity === filter);

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedRisks);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRisks(newExpanded);
    };

    const severityCounts = {
        critical: risks.filter((r) => r.severity === 'critical').length,
        high: risks.filter((r) => r.severity === 'high').length,
        medium: risks.filter((r) => r.severity === 'medium').length,
        low: risks.filter((r) => r.severity === 'low').length,
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)' }}>
                {SEVERITY_ORDER.map((severity) => (
                    <div
                        key={severity}
                        className="card"
                        style={{
                            padding: 'var(--space-md)',
                            textAlign: 'center',
                            cursor: 'pointer',
                            borderColor: filter === severity ? `var(--severity-${severity})` : undefined,
                            borderWidth: filter === severity ? 2 : 1,
                        }}
                        onClick={() => setFilter(filter === severity ? 'all' : severity)}
                    >
                        <div style={{
                            fontSize: '2rem',
                            fontWeight: 700,
                            color: `var(--severity-${severity})`
                        }}>
                            {severityCounts[severity]}
                        </div>
                        <div style={{
                            fontSize: '0.75rem',
                            textTransform: 'capitalize',
                            color: 'var(--text-secondary)'
                        }}>
                            {severity}
                        </div>
                    </div>
                ))}
            </div>

            {/* Risks List */}
            <div className="analysis-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Risk Assessment
                    </h3>
                    {filter !== 'all' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setFilter('all')}>
                            Clear Filter
                        </button>
                    )}
                </div>

                {filteredRisks.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: 'var(--space-xl)',
                        color: 'var(--text-muted)'
                    }}>
                        {risks.length === 0 ? (
                            <>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" style={{ margin: '0 auto var(--space-md)' }}>
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                <p style={{ color: 'var(--success)' }}>No risks detected! Your configuration looks good.</p>
                            </>
                        ) : (
                            <p>No risks match the selected filter.</p>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {filteredRisks.map((risk) => (
                            <div key={risk.id} className="risk-card">
                                <div
                                    className="risk-header"
                                    onClick={() => toggleExpand(risk.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <span className={`badge severity-${risk.severity}`}>
                                        {risk.severity}
                                    </span>
                                    <span className="badge" style={{ backgroundColor: 'var(--bg-hover)' }}>
                                        {risk.category}
                                    </span>
                                    <span className="risk-title" style={{ flex: 1 }}>{risk.title}</span>
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        style={{
                                            transform: expandedRisks.has(risk.id) ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform var(--transition-fast)'
                                        }}
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </div>

                                <p className="risk-description">{risk.description}</p>

                                {expandedRisks.has(risk.id) && (
                                    <div className="animate-slide-up" style={{ marginTop: 'var(--space-md)' }}>
                                        <div style={{
                                            padding: 'var(--space-md)',
                                            backgroundColor: 'var(--bg-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            marginBottom: 'var(--space-sm)'
                                        }}>
                                            <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                RECOMMENDATION
                                            </strong>
                                            <p style={{ marginTop: 'var(--space-xs)', fontSize: '0.875rem' }}>
                                                {risk.recommendation}
                                            </p>
                                        </div>

                                        <div className="risk-resources">
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 'var(--space-sm)' }}>
                                                Affected:
                                            </span>
                                            {risk.affectedResources.map((res, i) => (
                                                <code key={i} style={{ fontSize: '0.7rem' }}>{res}</code>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recommendations Section */}
            {recommendations.length > 0 && (
                <div className="analysis-section">
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Recommendations
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {recommendations.map((rec) => (
                            <div key={rec.id} className="card" style={{ padding: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                                    <span className={`badge ${rec.priority === 'high' ? 'badge-danger' : rec.priority === 'medium' ? 'badge-warning' : 'badge-info'}`}>
                                        {rec.priority} priority
                                    </span>
                                    <span style={{ fontWeight: 600 }}>{rec.title}</span>
                                </div>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    {rec.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
