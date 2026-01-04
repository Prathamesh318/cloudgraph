// ============================================
// CloudGraph - MermaidView Component
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import type { MermaidDiagrams } from '../types';

interface MermaidViewProps {
    diagrams: MermaidDiagrams;
}

type DiagramType = 'containerView' | 'serviceView' | 'infrastructureView';

export const MermaidView: React.FC<MermaidViewProps> = ({ diagrams }) => {
    const [activeView, setActiveView] = useState<DiagramType>('containerView');
    const [copied, setCopied] = useState(false);
    const preRef = useRef<HTMLPreElement>(null);

    const views: { id: DiagramType; label: string }[] = [
        { id: 'containerView', label: 'Container View' },
        { id: 'serviceView', label: 'Service View' },
        { id: 'infrastructureView', label: 'Infrastructure View' },
    ];

    const currentDiagram = diagrams[activeView];

    const handleCopy = async () => {
        await navigator.clipboard.writeText(currentDiagram);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Simple Mermaid-like rendering (since we don't have actual mermaid library)
    // In production, you'd use mermaid.js for proper rendering
    const renderDiagramPreview = () => {
        return (
            <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                lineHeight: '1.6',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
            }}>
                {currentDiagram}
            </div>
        );
    };

    return (
        <div className="mermaid-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                <div className="tabs mermaid-tabs" style={{ marginBottom: 0 }}>
                    {views.map((view) => (
                        <button
                            key={view.id}
                            className={`tab ${activeView === view.id ? 'active' : ''}`}
                            onClick={() => setActiveView(view.id)}
                        >
                            {view.label}
                        </button>
                    ))}
                </div>

                <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
                    {copied ? (
                        <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Copied!
                        </>
                    ) : (
                        <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy Code
                        </>
                    )}
                </button>
            </div>

            <div className="mermaid-diagram">
                <pre ref={preRef} style={{
                    margin: 0,
                    padding: 'var(--space-lg)',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'auto',
                    width: '100%'
                }}>
                    {renderDiagramPreview()}
                </pre>
            </div>

            <div style={{
                marginTop: 'var(--space-lg)',
                padding: 'var(--space-md)',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)'
            }}>
                <strong>💡 Tip:</strong> Copy the Mermaid code above and paste it into{' '}
                <a href="https://mermaid.live" target="_blank" rel="noopener noreferrer">
                    mermaid.live
                </a>{' '}
                for an interactive preview, or use it in your documentation.
            </div>
        </div>
    );
};
