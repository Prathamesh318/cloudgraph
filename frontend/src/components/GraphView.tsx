// ============================================
// CloudGraph - GraphView Component
// ============================================

import React, { useRef, useState } from 'react';
import type { DependencyGraph, ResourceKind, DependencyType } from '../types';

interface GraphViewProps {
    graph: DependencyGraph;
}

const NODE_COLORS: Partial<Record<ResourceKind, string>> = {
    Deployment: '#3b82f6',
    Service: '#06b6d4',
    Ingress: '#ec4899',
    ConfigMap: '#8b5cf6',
    Secret: '#ef4444',
    PersistentVolumeClaim: '#f97316',
    Container: '#22c55e',
    StatefulSet: '#3b82f6',
    DaemonSet: '#3b82f6',
    Volume: '#f97316',
    Network: '#3b82f6',
};

const EDGE_COLORS: Record<DependencyType, string> = {
    network: '#3b82f6',
    storage: '#8b5cf6',
    config: '#06b6d4',
    secret: '#ef4444',
    startup: '#f97316',
    runtime: '#22c55e',
    selector: '#eab308',
    routing: '#ec4899',
};

export const GraphView: React.FC<GraphViewProps> = ({ graph }) => {
    const containerRef = useRef<SVGSVGElement>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);

    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.1, 2));
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.5));
    const handleReset = () => setZoom(1);

    // Simple force-directed layout calculation
    const calculateLayout = () => {
        const nodes = graph.nodes.map((node, index) => {
            const angle = (2 * Math.PI * index) / graph.nodes.length;
            const radius = 200;
            return {
                ...node,
                x: 400 + radius * Math.cos(angle),
                y: 300 + radius * Math.sin(angle),
            };
        });
        return nodes;
    };

    const layoutNodes = calculateLayout();
    const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

    return (
        <div className="graph-container">
            <svg
                ref={containerRef}
                className="graph-canvas"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                viewBox="0 0 800 600"
            >
                <defs>
                    <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                    >
                        <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-muted)" />
                    </marker>
                    {Object.entries(EDGE_COLORS).map(([type, color]) => (
                        <marker
                            key={type}
                            id={`arrow-${type}`}
                            markerWidth="10"
                            markerHeight="7"
                            refX="9"
                            refY="3.5"
                            orient="auto"
                        >
                            <polygon points="0 0, 10 3.5, 0 7" fill={color} />
                        </marker>
                    ))}
                </defs>

                {/* Edges */}
                {graph.edges.map((edge) => {
                    const source = nodeMap.get(edge.source);
                    const target = nodeMap.get(edge.target);
                    if (!source || !target) return null;

                    const color = EDGE_COLORS[edge.type] || 'var(--text-muted)';
                    const dashArray = edge.isInferred ? '5,5' : undefined;

                    return (
                        <g key={edge.id}>
                            <line
                                x1={source.x}
                                y1={source.y}
                                x2={target.x}
                                y2={target.y}
                                stroke={color}
                                strokeWidth={2}
                                strokeDasharray={dashArray}
                                markerEnd={`url(#arrow-${edge.type})`}
                                opacity={0.7}
                            />
                        </g>
                    );
                })}

                {/* Nodes */}
                {layoutNodes.map((node) => {
                    const color = NODE_COLORS[node.type] || '#64748b';
                    const isSelected = selectedNode === node.id;

                    return (
                        <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            onClick={() => setSelectedNode(isSelected ? null : node.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            <circle
                                r={isSelected ? 35 : 30}
                                fill={color}
                                opacity={0.9}
                                stroke={isSelected ? 'white' : 'transparent'}
                                strokeWidth={3}
                            />
                            <text
                                textAnchor="middle"
                                dy="0.35em"
                                fill="white"
                                fontSize="10"
                                fontWeight="600"
                            >
                                {node.label.length > 10 ? node.label.slice(0, 10) + '...' : node.label}
                            </text>
                            <text
                                textAnchor="middle"
                                dy="45"
                                fill="var(--text-secondary)"
                                fontSize="9"
                            >
                                {node.type}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Selected Node Info */}
            {selectedNode && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'var(--space-md)',
                        right: 'var(--space-md)',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-md)',
                        minWidth: '200px',
                        boxShadow: 'var(--shadow-lg)',
                    }}
                >
                    {(() => {
                        const node = graph.nodes.find((n) => n.id === selectedNode);
                        if (!node) return null;
                        return (
                            <>
                                <h4 style={{ marginBottom: 'var(--space-sm)' }}>{node.label}</h4>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <strong>Type:</strong> {node.type}<br />
                                    <strong>Platform:</strong> {node.platform}<br />
                                    {node.namespace && <><strong>Namespace:</strong> {node.namespace}<br /></>}
                                    {node.group && <><strong>Group:</strong> {node.group}<br /></>}
                                </p>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Toolbar */}
            <div className="graph-toolbar">
                <button className="btn btn-ghost btn-sm" onClick={handleZoomOut} title="Zoom Out">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35M8 11h6" />
                    </svg>
                </button>
                <span style={{ fontSize: '0.75rem', padding: '0 var(--space-sm)' }}>
                    {Math.round(zoom * 100)}%
                </span>
                <button className="btn btn-ghost btn-sm" onClick={handleZoomIn} title="Zoom In">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                    </svg>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleReset} title="Reset">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" />
                    </svg>
                </button>
            </div>

            {/* Legend */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 'var(--space-md)',
                    left: 'var(--space-md)',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-sm)',
                    fontSize: '0.7rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-sm)',
                    maxWidth: '300px',
                }}
            >
                {Object.entries(EDGE_COLORS).slice(0, 4).map(([type, color]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: 12, height: 2, backgroundColor: color }} />
                        <span>{type}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
