// ============================================
// CloudGraph - SummaryView Component
// ============================================

import React, { useState } from 'react';
import type { ResourceSummary, ResourceKind } from '../types';

interface SummaryViewProps {
    summary: ResourceSummary;
}

const RESOURCE_COLORS: Partial<Record<ResourceKind, string>> = {
    Deployment: 'var(--res-deployment)',
    Service: 'var(--res-service)',
    Ingress: 'var(--res-ingress)',
    ConfigMap: 'var(--res-configmap)',
    Secret: 'var(--res-secret)',
    PersistentVolumeClaim: 'var(--res-pvc)',
    Container: 'var(--res-container)',
    StatefulSet: 'var(--res-deployment)',
    DaemonSet: 'var(--res-deployment)',
    Volume: 'var(--res-pvc)',
    Network: 'var(--dep-network)',
};

export const SummaryView: React.FC<SummaryViewProps> = ({ summary }) => {
    const [filter, setFilter] = useState<string>('all');
    const [search, setSearch] = useState('');

    const filteredResources = summary.resources.filter((resource) => {
        const matchesFilter = filter === 'all' || resource.kind === filter;
        const matchesSearch = resource.name.toLowerCase().includes(search.toLowerCase()) ||
            resource.kind.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const kindOptions = ['all', ...Object.keys(summary.byKind)];

    return (
        <div className="analysis-section" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                        <rect x="9" y="3" width="6" height="4" rx="1" />
                    </svg>
                    Resources Summary
                </h3>
                <span className="badge">{summary.totalResources} total</span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <input
                    type="text"
                    placeholder="Search resources..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ flex: 1 }}
                />
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{ width: '150px' }}
                >
                    {kindOptions.map((kind) => (
                        <option key={kind} value={kind}>
                            {kind === 'all' ? 'All Types' : kind}
                        </option>
                    ))}
                </select>
            </div>

            <div style={{
                display: 'grid',
                gap: 'var(--space-sm)',
                maxHeight: '500px',
                overflowY: 'auto'
            }}>
                {filteredResources.map((resource) => (
                    <div
                        key={resource.id}
                        className="card"
                        style={{ padding: 'var(--space-md)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: RESOURCE_COLORS[resource.kind] || 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.75rem'
                                }}
                            >
                                {resource.kind.slice(0, 3).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, marginBottom: '2px' }}>{resource.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {resource.kind} • {resource.platform}
                                    {resource.namespace && ` • ${resource.namespace}`}
                                </div>
                            </div>
                            {resource.metadata.image && (
                                <code style={{ fontSize: '0.7rem', maxWidth: '200px' }} className="truncate">
                                    {resource.metadata.image}
                                </code>
                            )}
                        </div>

                        {resource.metadata.ports && resource.metadata.ports.length > 0 && (
                            <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                {resource.metadata.ports.map((port, i) => (
                                    <span key={i} className="badge badge-info">
                                        {port.containerPort}/{port.protocol}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {filteredResources.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                    No resources found matching your criteria.
                </div>
            )}
        </div>
    );
};
