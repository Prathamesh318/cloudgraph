// ============================================
// CloudGraph CLI - Types
// ============================================

export interface FileInput {
    name: string;
    content: string;
}

export type Platform = 'docker-compose' | 'kubernetes';

export type ResourceKind =
    | 'Container'
    | 'Deployment'
    | 'StatefulSet'
    | 'DaemonSet'
    | 'Service'
    | 'Ingress'
    | 'ConfigMap'
    | 'Secret'
    | 'PersistentVolumeClaim'
    | 'Volume'
    | 'Network';

export interface Resource {
    id: string;
    name: string;
    kind: ResourceKind | string;
    platform: Platform;
    sourceFile: string;
    metadata?: Record<string, unknown>;
}

export interface Dependency {
    id: string;
    source: string;
    target: string;
    type: 'startup' | 'runtime' | 'network' | 'storage' | 'config' | 'secret' | 'selector';
    isInferred: boolean;
}

export interface ParsedResult {
    resources: Resource[];
    dependencies: Dependency[];
    errors: string[];
}

export interface GraphNode {
    id: string;
    label: string;
    type: string;
    platform: Platform;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    isInferred: boolean;
}

export interface AnalysisResult {
    summary: {
        totalResources: number;
        byKind: Record<string, number>;
        resources: Resource[];
    };
    graph: {
        nodes: GraphNode[];
        edges: GraphEdge[];
        metadata: {
            totalNodes: number;
            totalEdges: number;
        };
    };
    diagrams: {
        containerView: string;
        serviceView: string;
        infrastructureView: string;
    };
    risks: Array<{
        id: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
        title: string;
        description: string;
    }>;
    recommendations: Array<{
        id: string;
        priority: string;
        title: string;
        description: string;
    }>;
}
