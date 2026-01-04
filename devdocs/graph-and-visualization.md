# Graph & Visualization

This document explains how CloudGraph renders interactive graphs and visualizations on the frontend.

---

## Visualization Stack

| Library | Purpose |
|---------|---------|
| `react-force-graph-2d` | Force-directed graph rendering |
| `html-to-image` | Export to PNG/SVG |
| `file-saver` | Trigger file downloads |

---

## Graph Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       GraphView.tsx                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Top Toolbar                               ││
│  │  [Search] [Layout: Force ▼] [Labels] [Export ▼]             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │                    Canvas (Force Graph)                      ││
│  │                                                              ││
│  │         ○────────────○                                       ││
│  │        /              \                                      ││
│  │       ○                ○                                     ││
│  │        \              /                                      ││
│  │         ○────────────○                                       ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────────┐     ┌───────────────────┐    ┌──────────────┐ │
│  │    Legend    │     │   Node Panel      │    │ Zoom Controls│ │
│  │  ○ Deployment│     │ Name: backend     │    │  [−] [+] [⊡] │ │
│  │  ○ Service   │     │ Type: Container   │    │              │ │
│  │  ○ ConfigMap │     │ Connections: 3    │    │              │ │
│  └──────────────┘     └───────────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Transformation

### Backend → Frontend Mapping

```typescript
// Backend AnalysisResult.graph
{
    nodes: GraphNode[],
    edges: GraphEdge[],
    metadata: GraphMetadata
}

// Transformed for react-force-graph-2d
const graphData = {
    nodes: graph.nodes.map(node => ({
        id: node.id,
        label: node.label,
        type: node.type,
        color: NODE_COLORS[node.type],
        // ... other props
    })),
    links: graph.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        type: edge.type,
        isInferred: edge.isInferred,
        color: EDGE_COLORS[edge.type],
    }))
};
```

---

## Force Graph Configuration

### Physics Engine

```typescript
// Layout configuration by type
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
```

### Canvas Rendering

Nodes and links are rendered via custom canvas callbacks:

```typescript
<ForceGraph2D
    ref={graphRef}
    graphData={filteredData}
    nodeCanvasObject={paintNode}      // Custom node rendering
    linkCanvasObject={paintLink}      // Custom link rendering
    onNodeClick={handleNodeClick}
    onNodeHover={handleNodeHover}
    enableNodeDrag={true}
    enableZoomInteraction={true}
    enablePanInteraction={true}
/>
```

---

## Node Rendering

### Color Scheme

```typescript
const NODE_COLORS: Record<string, string> = {
    Deployment:           '#3b82f6',  // Blue
    Service:              '#06b6d4',  // Cyan
    Ingress:              '#ec4899',  // Pink
    ConfigMap:            '#8b5cf6',  // Purple
    Secret:               '#ef4444',  // Red
    PersistentVolumeClaim: '#f97316', // Orange
    Container:            '#22c55e',  // Green
    StatefulSet:          '#3b82f6',  // Blue
    DaemonSet:            '#3b82f6',  // Blue
    Volume:               '#f97316',  // Orange
    Network:              '#0ea5e9',  // Light Blue
};
```

### Custom Node Painting

```typescript
const paintNode = (node, ctx, globalScale) => {
    const isSelected = selectedNode === node.id;
    const size = isSelected ? 14 : 10;
    
    // Draw circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Selection ring
    if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    // Label
    if (showLabels && globalScale > 0.5) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.fillText(node.label, node.x, node.y + size + 4);
    }
};
```

---

## Link Rendering

### Edge Styles by Type

```typescript
const EDGE_COLORS: Record<DependencyType, string> = {
    network:  '#3b82f6',  // Blue
    storage:  '#8b5cf6',  // Purple
    config:   '#06b6d4',  // Cyan
    secret:   '#ef4444',  // Red
    startup:  '#f97316',  // Orange
    runtime:  '#22c55e',  // Green
    selector: '#eab308',  // Yellow
    routing:  '#ec4899',  // Pink
};
```

### Inferred Dependencies

Inferred dependencies are rendered with dashed lines:

```typescript
if (link.isInferred) {
    ctx.setLineDash([5, 5]);
} else {
    ctx.setLineDash([]);
}
ctx.stroke();
```

### Arrowheads

```typescript
// Draw arrowhead at target
const angle = Math.atan2(target.y - source.y, target.x - source.x);
const arrowLength = 8;

ctx.moveTo(arrowX, arrowY);
ctx.lineTo(
    arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
    arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
);
ctx.lineTo(
    arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
    arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
);
ctx.fill();
```

---

## Interactivity

### Node Selection

```typescript
const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(prev => prev === node.id ? null : node.id);
    
    // Center on selected node
    graphRef.current?.centerAt(node.x, node.y, 500);
    graphRef.current?.zoom(1.5, 500);
};
```

### Connected Highlighting

When a node is selected, connected nodes stay visible while others fade:

```typescript
const isConnected = selectedNode && graphData.links.some(l => {
    const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
    const targetId = typeof l.target === 'object' ? l.target.id : l.target;
    return (sourceId === selectedNode && targetId === node.id) ||
           (targetId === selectedNode && sourceId === node.id);
});

const opacity = selectedNode && !isSelected && !isConnected ? 0.3 : 1;
```

### Search & Filter

```typescript
const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return graphData;
    
    const term = searchTerm.toLowerCase();
    const matchedNodeIds = new Set(
        graphData.nodes
            .filter(n => 
                n.label.toLowerCase().includes(term) ||
                n.type.toLowerCase().includes(term)
            )
            .map(n => n.id)
    );

    return {
        nodes: graphData.nodes.filter(n => matchedNodeIds.has(n.id)),
        links: graphData.links.filter(l => 
            matchedNodeIds.has(l.source) && matchedNodeIds.has(l.target)
        ),
    };
}, [graphData, searchTerm]);
```

---

## Export Functions

### PNG Export

```typescript
const exportPNG = async () => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        saveAs(dataUrl, `cloudgraph-${Date.now()}.png`);
    }
};
```

### SVG Export

```typescript
const exportSVG = async () => {
    const dataUrl = await toSvg(containerRef.current, {
        backgroundColor: '#0f172a',
        filter: (node) => node.tagName !== 'BUTTON',
    });
    saveAs(dataUrl, `cloudgraph-${Date.now()}.svg`);
};
```

### JSON Export

```typescript
const exportJSON = () => {
    const data = JSON.stringify(graph, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    saveAs(blob, `cloudgraph-${Date.now()}.json`);
};
```

---

## Performance Considerations

### Canvas vs SVG

We use Canvas (via react-force-graph-2d) instead of SVG because:

- Better performance with many nodes (100+)
- Smoother animations
- Lower memory usage

### Optimization Techniques

1. **Memoization** - Graph data transformations are memoized with `useMemo`
2. **Conditional rendering** - Labels only shown when zoomed in (`globalScale > 0.5`)
3. **Throttled hover** - Hover events don't trigger re-renders of entire graph
4. **Cool-down** - Physics simulation stops after `cooldownTicks={100}`

### Limits

| Metric | Comfortable Range | Warning Zone |
|--------|-------------------|--------------|
| Nodes | 1-100 | 100-500 |
| Edges | 1-200 | 200-1000 |
| Labels | Always off for >50 nodes | Consider disabling |

---

## Mermaid Diagrams

The MermaidView component displays diagram code (not rendered) for copy/paste:

```typescript
const MermaidView: React.FC<{ diagrams: MermaidDiagrams }> = ({ diagrams }) => {
    const [activeTab, setActiveTab] = useState('container');
    
    return (
        <div className="mermaid-container">
            <TabGroup>
                <Tab onClick={() => setActiveTab('container')}>Container</Tab>
                <Tab onClick={() => setActiveTab('service')}>Service</Tab>
                <Tab onClick={() => setActiveTab('infrastructure')}>Infra</Tab>
            </TabGroup>
            
            <pre>
                {diagrams[`${activeTab}View`]}
            </pre>
        </div>
    );
};
```

---

## Next Steps

- [Architecture Overview](architecture-overview.md) - System design
- [Infrastructure](infrastructure.md) - Deployment configuration
