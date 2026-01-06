export type Platform = 'docker-compose' | 'kubernetes';
export type ResourceKind = 'Container' | 'Service' | 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'Job' | 'CronJob' | 'Ingress' | 'ConfigMap' | 'Secret' | 'PersistentVolume' | 'PersistentVolumeClaim' | 'Network' | 'Volume';
export type DependencyType = 'network' | 'storage' | 'config' | 'secret' | 'startup' | 'runtime' | 'selector' | 'routing';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export interface PortMapping {
    containerPort: number;
    hostPort?: number;
    protocol: 'TCP' | 'UDP';
    name?: string;
    nodePort?: number;
}
export interface VolumeMount {
    name: string;
    mountPath: string;
    subPath?: string;
    readOnly?: boolean;
    source?: string;
    type?: 'volume' | 'bind' | 'tmpfs' | 'pvc';
}
export interface EnvVar {
    name: string;
    value?: string;
    valueFrom?: {
        configMapKeyRef?: {
            name: string;
            key: string;
        };
        secretKeyRef?: {
            name: string;
            key: string;
        };
        fieldRef?: {
            fieldPath: string;
        };
    };
}
export interface ResourceMetadata {
    image?: string;
    replicas?: number;
    ports?: PortMapping[];
    volumes?: VolumeMount[];
    environment?: EnvVar[];
    selector?: Record<string, string>;
    command?: string[];
    args?: string[];
    workingDir?: string;
    resources?: {
        limits?: {
            cpu?: string;
            memory?: string;
        };
        requests?: {
            cpu?: string;
            memory?: string;
        };
    };
    healthCheck?: {
        type: 'http' | 'tcp' | 'exec';
        path?: string;
        port?: number;
        command?: string[];
        interval?: string;
        timeout?: string;
    };
}
export interface Resource {
    id: string;
    name: string;
    kind: ResourceKind;
    platform: Platform;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    metadata: ResourceMetadata;
    sourceFile: string;
    rawYaml?: string;
}
export interface Dependency {
    id: string;
    source: string;
    target: string;
    type: DependencyType;
    isInferred: boolean;
    confidence: ConfidenceLevel;
    reason?: string;
    metadata?: Record<string, unknown>;
}
export interface GraphNode {
    id: string;
    label: string;
    type: ResourceKind;
    platform: Platform;
    group?: string;
    namespace?: string;
    properties: Record<string, unknown>;
}
export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: DependencyType;
    isInferred: boolean;
    confidence?: ConfidenceLevel;
    label?: string;
}
export interface GraphMetadata {
    totalNodes: number;
    totalEdges: number;
    platforms: Platform[];
    generatedAt: string;
    sourceFiles: string[];
}
export interface DependencyGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    metadata: GraphMetadata;
}
export interface ResourceSummary {
    totalResources: number;
    byKind: Partial<Record<ResourceKind, number>>;
    byPlatform: Partial<Record<Platform, number>>;
    resources: Resource[];
}
export interface MermaidDiagrams {
    containerView: string;
    serviceView: string;
    infrastructureView: string;
}
export interface CriticalPath {
    path: string[];
    description: string;
    riskLevel: Severity;
}
export interface LogicalGroup {
    name: string;
    category: 'frontend' | 'backend' | 'data' | 'infra' | 'external';
    resources: string[];
}
export interface ExternalDependency {
    name: string;
    type: string;
    inferredFrom: string[];
    confidence: ConfidenceLevel;
}
export interface ArchitecturalAnalysis {
    overview: string;
    criticalPaths: CriticalPath[];
    logicalGroups: LogicalGroup[];
    externalDependencies: ExternalDependency[];
}
export interface RiskAssessment {
    id: string;
    severity: Severity;
    category: string;
    title: string;
    description: string;
    affectedResources: string[];
    recommendation: string;
}
export interface Recommendation {
    id: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    affectedResources: string[];
}
export interface AnalysisResult {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    createdAt: string;
    completedAt?: string;
    summary: ResourceSummary;
    graph: DependencyGraph;
    diagrams: MermaidDiagrams;
    analysis: ArchitecturalAnalysis;
    risks: RiskAssessment[];
    recommendations: Recommendation[];
    errors?: string[];
}
export interface FileInput {
    name: string;
    content: string;
}
export interface AnalysisOptions {
    inferDependencies?: boolean;
    includeMetadata?: boolean;
    groupingStrategy?: 'auto' | 'namespace' | 'labels' | 'none';
}
export interface AnalyzeRequest {
    files: FileInput[];
    options?: AnalysisOptions;
}
export interface AnalyzeResponse {
    id: string;
    status: 'completed' | 'error';
    result?: AnalysisResult;
    error?: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    file: string;
    line?: number;
    message: string;
}
export interface ValidationWarning {
    file: string;
    line?: number;
    message: string;
}
