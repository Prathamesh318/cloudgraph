// ============================================
// CloudGraph - MermaidView Component
// Live rendering with mermaid.js
// ============================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import mermaid from 'mermaid';
import type { MermaidDiagrams } from '../types';

interface MermaidViewProps {
    diagrams: MermaidDiagrams;
}

type DiagramType = 'containerView' | 'serviceView' | 'infrastructureView';

// Initialize mermaid with dark theme
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, sans-serif',
    themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#f8fafc',
        primaryBorderColor: '#64748b',
        lineColor: '#64748b',
        secondaryColor: '#1e293b',
        tertiaryColor: '#0f172a',
        background: '#0f172a',
        mainBkg: '#1e293b',
        nodeBkg: '#1e293b',
        nodeBorder: '#3b82f6',
        clusterBkg: '#1e293b',
        clusterBorder: '#3b82f6',
        titleColor: '#f8fafc',
        edgeLabelBackground: '#1e293b',
    }
});

export const MermaidView: React.FC<MermaidViewProps> = ({ diagrams }) => {
    const [activeView, setActiveView] = useState<DiagramType>('containerView');
    const [copied, setCopied] = useState(false);
    const [showCode, setShowCode] = useState(false);
    const [renderedSvg, setRenderedSvg] = useState<string>('');
    const [renderError, setRenderError] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const views: { id: DiagramType; label: string }[] = [
        { id: 'containerView', label: 'Container View' },
        { id: 'serviceView', label: 'Service View' },
        { id: 'infrastructureView', label: 'Infrastructure View' },
    ];

    const currentDiagram = diagrams[activeView];

    // Render diagram when activeView or diagrams change
    const renderDiagram = useCallback(async () => {
        if (!currentDiagram) {
            setRenderedSvg('');
            return;
        }

        setIsRendering(true);
        setRenderError(null);

        try {
            // Generate unique ID for this render
            const id = `mermaid-${activeView}-${Date.now()}`;

            // Render the diagram
            const { svg } = await mermaid.render(id, currentDiagram);
            setRenderedSvg(svg);
        } catch (error) {
            console.error('Mermaid render error:', error);
            setRenderError((error as Error).message || 'Failed to render diagram');
            setRenderedSvg('');
        } finally {
            setIsRendering(false);
        }
    }, [currentDiagram, activeView]);

    useEffect(() => {
        renderDiagram();
    }, [renderDiagram]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(currentDiagram);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleExportSvg = () => {
        if (!renderedSvg) return;

        const blob = new Blob([renderedSvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cloudgraph-${activeView}-${Date.now()}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPng = async () => {
        if (!renderedSvg) return;

        // Create canvas from SVG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        const svgBlob = new Blob([renderedSvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            canvas.width = img.width * 2;  // 2x for better quality
            canvas.height = img.height * 2;
            ctx?.scale(2, 2);
            ctx?.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    const pngUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = pngUrl;
                    a.download = `cloudgraph-${activeView}-${Date.now()}.png`;
                    a.click();
                    URL.revokeObjectURL(pngUrl);
                }
            }, 'image/png');

            URL.revokeObjectURL(url);
        };

        img.src = url;
    };

    return (
        <div className="mermaid-container">
            {/* Header with tabs and actions */}
            <div className="mermaid-header">
                <div className="tabs mermaid-tabs">
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

                <div className="mermaid-actions">
                    {/* Toggle Code/Diagram */}
                    <button
                        className={`btn btn-ghost btn-sm ${showCode ? 'active' : ''}`}
                        onClick={() => setShowCode(!showCode)}
                        title={showCode ? 'Show Diagram' : 'Show Code'}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                        </svg>
                        {showCode ? 'Diagram' : 'Code'}
                    </button>

                    {/* Copy Code */}
                    <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
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
                                Copy
                            </>
                        )}
                    </button>

                    {/* Export dropdown */}
                    {!showCode && renderedSvg && (
                        <div className="mermaid-export-menu">
                            <button className="btn btn-primary btn-sm">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                </svg>
                                Export
                            </button>
                            <div className="mermaid-export-dropdown">
                                <button onClick={handleExportSvg}>Export as SVG</button>
                                <button onClick={handleExportPng}>Export as PNG</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Diagram or Code View */}
            <div className="mermaid-diagram" ref={containerRef}>
                {showCode ? (
                    // Code view
                    <pre className="mermaid-code">
                        <code>{currentDiagram}</code>
                    </pre>
                ) : isRendering ? (
                    // Loading state
                    <div className="mermaid-loading">
                        <div className="mermaid-spinner"></div>
                        <span>Rendering diagram...</span>
                    </div>
                ) : renderError ? (
                    // Error state
                    <div className="mermaid-error">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <p>Failed to render diagram</p>
                        <code>{renderError}</code>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowCode(true)}>
                            View Code Instead
                        </button>
                    </div>
                ) : renderedSvg ? (
                    // Rendered SVG
                    <div
                        className="mermaid-svg-container"
                        dangerouslySetInnerHTML={{ __html: renderedSvg }}
                    />
                ) : (
                    // Empty state
                    <div className="mermaid-empty">No diagram available</div>
                )}
            </div>

            {/* Tip */}
            {!showCode && (
                <div className="mermaid-tip">
                    <strong>💡 Tip:</strong> Click "Code" to view the Mermaid source, or{' '}
                    <a href="https://mermaid.live" target="_blank" rel="noopener noreferrer">
                        open in Mermaid Live
                    </a>{' '}
                    for advanced editing.
                </div>
            )}
        </div>
    );
};
