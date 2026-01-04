// ============================================
// CloudGraph - Interactive GraphView Component
// ============================================

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { toSvg } from 'html-to-image';
import { saveAs } from 'file-saver';
import type { DependencyGraph, ResourceKind, DependencyType } from '../types';

interface GraphViewProps {
    graph: DependencyGraph;
}

// Node colors by resource kind
const NODE_COLORS: Record<string, string> = {
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
    Network: '#0ea5e9',
    Pod: '#84cc16',
    Job: '#a855f7',
    CronJob: '#a855f7',
};

// Edge colors by dependency type
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

// Layout options
type LayoutType = 'force' | 'radial' | 'hierarchical';

interface GraphNode extends NodeObject {
    id: string;
    label: string;
    type: ResourceKind;
    platform: string;
    group?: string;
    namespace?: string;
    color?: string;
    properties?: Record<string, unknown>;
}

interface GraphLink extends LinkObject {
    id: string;
    source: string | GraphNode;
    target: string | GraphNode;
    type: DependencyType;
    isInferred: boolean;
    color?: string;
}

export const GraphView: React.FC<GraphViewProps> = ({ graph }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);

    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [layout, setLayout] = useState<LayoutType>('force');
    const [showLabels, setShowLabels] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    // Transform graph data to force-graph format
    const graphData = useMemo(() => {
        const nodes: GraphNode[] = graph.nodes.map(node => ({
            id: node.id,
            label: node.label,
            type: node.type,
            platform: node.platform,
            group: node.group,
            namespace: node.namespace,
            properties: node.properties,
            color: NODE_COLORS[node.type] || '#64748b',
        }));

        const links: GraphLink[] = graph.edges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            isInferred: edge.isInferred,
            color: EDGE_COLORS[edge.type] || '#64748b',
        }));

        return { nodes, links };
    }, [graph]);

    // Filter nodes based on search
    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return graphData;

        const term = searchTerm.toLowerCase();
        const matchedNodeIds = new Set(
            graphData.nodes
                .filter(n =>
                    n.label.toLowerCase().includes(term) ||
                    n.type.toLowerCase().includes(term) ||
                    n.group?.toLowerCase().includes(term)
                )
                .map(n => n.id)
        );

        return {
            nodes: graphData.nodes.filter(n => matchedNodeIds.has(n.id)),
            links: graphData.links.filter(l => {
                const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                const targetId = typeof l.target === 'object' ? l.target.id : l.target;
                return matchedNodeIds.has(sourceId) && matchedNodeIds.has(targetId);
            }),
        };
    }, [graphData, searchTerm]);

    // Apply layout
    useEffect(() => {
        if (!graphRef.current) return;

        const fg = graphRef.current;

        switch (layout) {
            case 'radial':
                fg.d3Force('charge')?.strength(-300);
                fg.d3Force('link')?.distance(100);
                break;
            case 'hierarchical':
                fg.d3Force('charge')?.strength(-500);
                fg.d3Force('link')?.distance(150);
                break;
            default: // force
                fg.d3Force('charge')?.strength(-200);
                fg.d3Force('link')?.distance(80);
        }

        fg.d3ReheatSimulation();
    }, [layout]);

    // Node click handler
    const handleNodeClick = useCallback((node: GraphNode) => {
        setSelectedNode(prev => prev === node.id ? null : node.id);

        // Center on node
        if (graphRef.current) {
            graphRef.current.centerAt(node.x, node.y, 500);
            graphRef.current.zoom(1.5, 500);
        }
    }, []);

    // Node hover handler
    const handleNodeHover = useCallback((node: GraphNode | null) => {
        setHoveredNode(node);
        if (containerRef.current) {
            containerRef.current.style.cursor = node ? 'pointer' : 'default';
        }
    }, []);

    // Custom node rendering
    const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const isSelected = selectedNode === node.id;
        const isConnected = selectedNode && graphData.links.some(l => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            return (sourceId === selectedNode && targetId === node.id) ||
                (targetId === selectedNode && sourceId === node.id);
        });

        const size = isSelected ? 14 : 10;
        const opacity = selectedNode && !isSelected && !isConnected ? 0.3 : 1;

        // Draw node circle
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
        ctx.fillStyle = node.color || '#64748b';
        ctx.globalAlpha = opacity;
        ctx.fill();

        // Draw selection ring
        if (isSelected) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.globalAlpha = 1;

        // Draw label
        if (showLabels && globalScale > 0.5) {
            const label = node.label.length > 15 ? node.label.slice(0, 15) + '...' : node.label;
            const fontSize = Math.max(10 / globalScale, 3);
            ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.8)';
            ctx.globalAlpha = opacity;
            ctx.fillText(label, node.x!, node.y! + size + 4);
            ctx.globalAlpha = 1;
        }
    }, [selectedNode, showLabels, graphData.links]);

    // Custom link rendering
    const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

        const isConnectedToSelected = selectedNode === sourceId || selectedNode === targetId;
        const opacity = selectedNode && !isConnectedToSelected ? 0.1 : 0.6;

        const source = typeof link.source === 'object' ? link.source : graphData.nodes.find(n => n.id === link.source);
        const target = typeof link.target === 'object' ? link.target : graphData.nodes.find(n => n.id === link.target);

        if (!source?.x || !source?.y || !target?.x || !target?.y) return;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = link.color || '#64748b';
        ctx.globalAlpha = opacity;
        ctx.lineWidth = isConnectedToSelected ? 2 : 1;

        if (link.isInferred) {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Draw arrowhead
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        const arrowLength = 8;
        const arrowX = target.x - 12 * Math.cos(angle);
        const arrowY = target.y - 12 * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
            arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
            arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
            arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = link.color || '#64748b';
        ctx.globalAlpha = opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
    }, [selectedNode, graphData.nodes]);

    // Export functions
    const exportPNG = async () => {
        if (!containerRef.current) return;
        setIsExporting(true);
        try {
            const canvas = containerRef.current.querySelector('canvas');
            if (canvas) {
                const dataUrl = canvas.toDataURL('image/png');
                saveAs(dataUrl, `cloudgraph-${Date.now()}.png`);
            }
        } finally {
            setIsExporting(false);
        }
    };

    const exportSVG = async () => {
        if (!containerRef.current) return;
        setIsExporting(true);
        try {
            const dataUrl = await toSvg(containerRef.current, {
                backgroundColor: '#0f172a',
                filter: (node) => node.tagName !== 'BUTTON',
            });
            saveAs(dataUrl, `cloudgraph-${Date.now()}.svg`);
        } finally {
            setIsExporting(false);
        }
    };

    const exportJSON = () => {
        const data = JSON.stringify(graph, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        saveAs(blob, `cloudgraph-${Date.now()}.json`);
    };

    // Zoom controls
    const handleZoomIn = () => graphRef.current?.zoom(graphRef.current.zoom() * 1.3, 300);
    const handleZoomOut = () => graphRef.current?.zoom(graphRef.current.zoom() / 1.3, 300);
    const handleZoomReset = () => {
        graphRef.current?.zoomToFit(400, 50);
        setSelectedNode(null);
    };

    // Get selected node details
    const selectedNodeData = selectedNode
        ? graph.nodes.find(n => n.id === selectedNode)
        : null;

    return (
        <div className="graph-view-container" ref={containerRef}>
            {/* Top Toolbar */}
            <div className="graph-toolbar graph-toolbar-top">
                {/* Search */}
                <div className="graph-search">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search nodes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="graph-search-clear">×</button>
                    )}
                </div>

                {/* Layout Selector */}
                <div className="graph-layout-selector">
                    <label>Layout:</label>
                    <select value={layout} onChange={(e) => setLayout(e.target.value as LayoutType)}>
                        <option value="force">Force-Directed</option>
                        <option value="radial">Radial</option>
                        <option value="hierarchical">Hierarchical</option>
                    </select>
                </div>

                {/* Toggle Labels */}
                <button
                    className={`btn btn-ghost btn-sm ${showLabels ? 'active' : ''}`}
                    onClick={() => setShowLabels(!showLabels)}
                    title="Toggle Labels"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
                    </svg>
                </button>

                {/* Export Dropdown */}
                <div className="graph-export-menu">
                    <button className="btn btn-primary btn-sm" disabled={isExporting}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        Export
                    </button>
                    <div className="graph-export-dropdown">
                        <button onClick={exportPNG}>Export as PNG</button>
                        <button onClick={exportSVG}>Export as SVG</button>
                        <button onClick={exportJSON}>Export as JSON</button>
                    </div>
                </div>
            </div>

            {/* Graph Canvas */}
            <ForceGraph2D
                ref={graphRef}
                graphData={filteredData}
                nodeId="id"
                nodeLabel=""
                nodeCanvasObject={paintNode}
                nodePointerAreaPaint={(node, color, ctx) => {
                    ctx.beginPath();
                    ctx.arc(node.x!, node.y!, 14, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                }}
                linkCanvasObject={paintLink}
                linkDirectionalArrowLength={0}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                onBackgroundClick={() => setSelectedNode(null)}
                enableNodeDrag={true}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                backgroundColor="transparent"
                width={containerRef.current?.clientWidth || 800}
                height={containerRef.current?.clientHeight || 600}
                cooldownTicks={100}
                onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
            />

            {/* Zoom Controls */}
            <div className="graph-toolbar graph-toolbar-bottom-right">
                <button className="btn btn-ghost btn-sm" onClick={handleZoomOut} title="Zoom Out">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35M8 11h6" />
                    </svg>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleZoomIn} title="Zoom In">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                    </svg>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleZoomReset} title="Fit to View">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                </button>
            </div>

            {/* Hover Tooltip */}
            {hoveredNode && (
                <div
                    className="graph-tooltip"
                    style={{
                        left: hoveredNode.x! + 20,
                        top: hoveredNode.y! - 20,
                    }}
                >
                    <strong>{hoveredNode.label}</strong>
                    <span className="graph-tooltip-type">{hoveredNode.type}</span>
                </div>
            )}

            {/* Selected Node Panel */}
            {selectedNodeData && (
                <div className="graph-node-panel">
                    <div className="graph-node-panel-header">
                        <div
                            className="graph-node-panel-color"
                            style={{ backgroundColor: NODE_COLORS[selectedNodeData.type] || '#64748b' }}
                        />
                        <h4>{selectedNodeData.label}</h4>
                        <button onClick={() => setSelectedNode(null)} className="graph-node-panel-close">×</button>
                    </div>
                    <div className="graph-node-panel-content">
                        <div className="graph-node-panel-row">
                            <span>Type</span>
                            <span className="badge">{selectedNodeData.type}</span>
                        </div>
                        <div className="graph-node-panel-row">
                            <span>Platform</span>
                            <span>{selectedNodeData.platform}</span>
                        </div>
                        {selectedNodeData.namespace && (
                            <div className="graph-node-panel-row">
                                <span>Namespace</span>
                                <span>{selectedNodeData.namespace}</span>
                            </div>
                        )}
                        {selectedNodeData.group && (
                            <div className="graph-node-panel-row">
                                <span>Group</span>
                                <span className="badge">{selectedNodeData.group}</span>
                            </div>
                        )}
                        {(() => {
                            const image = selectedNodeData.properties?.image;
                            return typeof image === 'string' ? (
                                <div className="graph-node-panel-row">
                                    <span>Image</span>
                                    <code>{image}</code>
                                </div>
                            ) : null;
                        })()}
                    </div>
                    <div className="graph-node-panel-connections">
                        <h5>Connections</h5>
                        {graph.edges
                            .filter(e => e.source === selectedNode || e.target === selectedNode)
                            .slice(0, 5)
                            .map(edge => {
                                const otherId = edge.source === selectedNode ? edge.target : edge.source;
                                const otherNode = graph.nodes.find(n => n.id === otherId);
                                const direction = edge.source === selectedNode ? '→' : '←';
                                return (
                                    <div key={edge.id} className="graph-node-panel-connection">
                                        <span style={{ color: EDGE_COLORS[edge.type] }}>{direction}</span>
                                        <span>{otherNode?.label || otherId}</span>
                                        <span className="graph-node-panel-edge-type">{edge.type}</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="graph-legend">
                <div className="graph-legend-section">
                    <h5>Resource Types</h5>
                    <div className="graph-legend-items">
                        {Object.entries(NODE_COLORS).slice(0, 6).map(([type, color]) => (
                            <div key={type} className="graph-legend-item">
                                <div className="graph-legend-color" style={{ backgroundColor: color }} />
                                <span>{type}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="graph-legend-section">
                    <h5>Dependencies</h5>
                    <div className="graph-legend-items">
                        {Object.entries(EDGE_COLORS).slice(0, 4).map(([type, color]) => (
                            <div key={type} className="graph-legend-item">
                                <div className="graph-legend-line" style={{ backgroundColor: color }} />
                                <span>{type}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="graph-stats">
                <span>{filteredData.nodes.length} nodes</span>
                <span>•</span>
                <span>{filteredData.links.length} edges</span>
            </div>
        </div>
    );
};
