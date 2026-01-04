// ============================================
// CloudGraph - Dashboard Component
// ============================================

import React, { useState } from 'react';
import type { AnalysisResult, FileInput, ResourceKind } from '../types';
import { GraphView } from './GraphView';
import { MermaidView } from './MermaidView';
import { AnalysisView } from './AnalysisView';
import { RisksView } from './RisksView';
import { SummaryView } from './SummaryView';

interface DashboardProps {
    result: AnalysisResult;
    files: FileInput[];
}

type Tab = 'graph' | 'mermaid' | 'summary' | 'analysis' | 'risks';

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

export const Dashboard: React.FC<DashboardProps> = ({ result, files }) => {
    const [activeTab, setActiveTab] = useState<Tab>('graph');

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        {
            id: 'graph',
            label: 'Graph View',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="18" cy="18" r="3" />
                    <circle cx="18" cy="6" r="3" />
                    <path d="M8.5 7.5L15.5 16.5M15.5 7.5L8.5 16.5" />
                </svg>
            ),
        },
        {
            id: 'mermaid',
            label: 'Mermaid',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                </svg>
            ),
        },
        {
            id: 'summary',
            label: 'Summary',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <path d="M9 12h6M9 16h6" />
                </svg>
            ),
        },
        {
            id: 'analysis',
            label: 'Analysis',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20V10M6 20V14M18 20V4" />
                </svg>
            ),
        },
        {
            id: 'risks',
            label: 'Risks',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            ),
        },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'graph':
                return <GraphView graph={result.graph} />;
            case 'mermaid':
                return <MermaidView diagrams={result.diagrams} />;
            case 'summary':
                return <SummaryView summary={result.summary} />;
            case 'analysis':
                return <AnalysisView analysis={result.analysis} />;
            case 'risks':
                return <RisksView risks={result.risks} recommendations={result.recommendations} />;
            default:
                return null;
        }
    };

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-section">
                    <h3 className="sidebar-title">Files</h3>
                    <ul className="file-list">
                        {files.map((file, index) => (
                            <li key={index} className="file-item">
                                <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <span className="file-name">{file.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="sidebar-section">
                    <h3 className="sidebar-title">Resources</h3>
                    <div className="resource-counts">
                        {Object.entries(result.summary.byKind).map(([kind, count]) => (
                            <div key={kind} className="resource-count">
                                <div className="resource-count-label">
                                    <span
                                        className="resource-count-dot"
                                        style={{ backgroundColor: RESOURCE_COLORS[kind as ResourceKind] || 'var(--text-muted)' }}
                                    />
                                    <span>{kind}</span>
                                </div>
                                <span className="resource-count-value">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-section">
                    <h3 className="sidebar-title">Statistics</h3>
                    <div className="resource-counts">
                        <div className="resource-count">
                            <span className="resource-count-label">Total Resources</span>
                            <span className="resource-count-value">{result.summary.totalResources}</span>
                        </div>
                        <div className="resource-count">
                            <span className="resource-count-label">Dependencies</span>
                            <span className="resource-count-value">{result.graph.metadata.totalEdges}</span>
                        </div>
                        <div className="resource-count">
                            <span className="resource-count-label">Risks Found</span>
                            <span className="resource-count-value" style={{ color: result.risks.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
                                {result.risks.length}
                            </span>
                        </div>
                    </div>
                </div>
            </aside>

            <div className="main-panel">
                <div className="tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {renderContent()}
            </div>
        </div>
    );
};
