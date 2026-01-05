# Mermaid Live Rendering

This document explains the Mermaid diagram visualization feature in CloudGraph.

---

## Overview

CloudGraph generates Mermaid diagram code from your infrastructure configurations and renders them directly in the browser using the [mermaid.js](https://mermaid.js.org/) library.

### Features

- **Live Rendering** - Diagrams render visually instead of showing raw code
- **Dark Theme** - Matches the CloudGraph dark UI
- **Code Toggle** - Switch between rendered diagram and source code
- **Export** - Download as SVG or PNG
- **Error Handling** - Graceful fallback if diagram fails to render

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       MermaidView Component                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Tab Selection                             ││
│  │  [Container View] [Service View] [Infrastructure View]      ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              mermaid.render(id, code)                        ││
│  │                                                              ││
│  │  Input: Mermaid code string                                  ││
│  │  Output: SVG string                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                   │
│  ┌─────────────────────┐        ┌─────────────────────┐         │
│  │   Rendered SVG      │   OR   │    Error State      │         │
│  │   (displayed)       │        │    (show code)      │         │
│  └─────────────────────┘        └─────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Library Configuration

```typescript
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,      // Manual control
    theme: 'dark',           // Dark theme
    securityLevel: 'loose',  // Allow rich features
    fontFamily: 'Inter, system-ui, sans-serif',
    themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#f8fafc',
        primaryBorderColor: '#64748b',
        lineColor: '#64748b',
        secondaryColor: '#1e293b',
        background: '#0f172a',
        nodeBkg: '#1e293b',
        nodeBorder: '#3b82f6',
        clusterBkg: '#1e293b',
        // ... more theme variables
    }
});
```

### Rendering Flow

```typescript
const renderDiagram = async () => {
    try {
        const id = `mermaid-${activeView}-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagramCode);
        setRenderedSvg(svg);
    } catch (error) {
        setRenderError(error.message);
    }
};
```

### Diagram Types

| View | Description | Use Case |
|------|-------------|----------|
| **Container View** | Shows all containers and their dependencies | Overview of service topology |
| **Service View** | K8s Services and their routing | Understanding traffic flow |
| **Infrastructure View** | Resources grouped by category | High-level architecture |

---

## Export Options

### SVG Export

```typescript
const exportSVG = () => {
    const blob = new Blob([renderedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    // Download...
};
```

**Advantages:**
- Vector format (scalable)
- Editable in design tools
- Small file size

### PNG Export

```typescript
const exportPNG = async () => {
    // Create canvas from SVG
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svg]));
    
    img.onload = () => {
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob(blob => /* download */);
    };
};
```

**Advantages:**
- Universal compatibility
- Works in presentations
- 2x resolution for clarity

---

## CSS Structure

```css
.mermaid-container { }      /* Main container */
.mermaid-header { }         /* Tabs and actions */
.mermaid-actions { }        /* Button group */
.mermaid-export-menu { }    /* Dropdown menu */
.mermaid-diagram { }        /* Render area */
.mermaid-svg-container { }  /* SVG wrapper */
.mermaid-code { }           /* Code view */
.mermaid-loading { }        /* Loading state */
.mermaid-error { }          /* Error state */
.mermaid-tip { }            /* Help text */
```

---

## Error Handling

| Error Type | Cause | User Action |
|------------|-------|-------------|
| Syntax Error | Invalid Mermaid code | View code, report issue |
| Render Timeout | Complex diagram | Simplify configuration |
| Unknown Node | Unsupported syntax | Check Mermaid docs |

When rendering fails, users can:
1. Click "View Code" to see raw Mermaid
2. Copy code to [mermaid.live](https://mermaid.live) for debugging
3. Report issue with the diagram generator

---

## Performance

- **Initial render**: ~100-200ms for typical diagrams
- **Re-render on tab switch**: ~50-100ms (cached mermaid instance)
- **Large diagrams** (50+ nodes): May take 500ms+

### Optimization Tips

1. Mermaid is only initialized once at module load
2. Rendering is async to avoid blocking UI
3. Previous SVGs are discarded on re-render

---

## Related Documentation

- [Graph & Visualization](graph-and-visualization.md) - Interactive graph view
- [Analysis Engine](analysis-engine.md) - Diagram code generation
