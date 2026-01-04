// ============================================
// CloudGraph - Shared Type Definitions
// Container Orchestration Dependency Analyzer
// ============================================

// Platform Types
export type Platform = 'docker-compose' | 'kubernetes';

// Resource Kind Types
export type ResourceKind =
    | 'Container'
    | 'Service'
    | 'Deployment'
    | 'StatefulSet'
    | 'DaemonSet'
    | 'Job'
    | 'CronJob'
    | 'Ingress'
    | 'ConfigMap'
    | 'Secret'
    | 'PersistentVolume'
    | 'PersistentVolumeClaim'
    | 'Network'
    | 'Volume';

// Dependency Types
export type DependencyType =
    | 'network'      // Container-to-container networking
    | 'storage'      // Volume/PVC mounts
    | 'config'       // ConfigMap/environment references
    | 'secret'       // Secret references
    | 'startup'      // Startup ordering (depends_on)
    | 'runtime'      // Runtime dependencies
    | 'selector'     // K8s label selectors
    | 'routing';     // Ingress routing

// Confidence Levels for Inferred Dependencies
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Severity Levels for Risks
export type Severity = 'critical' | 'high' | 'medium' | 'low';

// ============================================
// Port and Volume Mappings
// ============================================

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
    source?: string;  // For Docker Compose bind mounts
    type?: 'volume' | 'bind' | 'tmpfs' | 'pvc';
}

export interface EnvVar {
    name: string;
    value?: string;
    valueFrom?: {
        configMapKeyRef?: { name: string; key: string };
        secretKeyRef?: { name: string; key: string };
        fieldRef?: { fieldPath: string };
    };
}

// ============================================
// Resource Metadata
// ============================================

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
        limits?: { cpu?: string; memory?: string };
        requests?: { cpu?: string; memory?: string };
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

// ============================================
// Core Resource Definition
// ============================================

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

// ============================================
// Dependency Definition
// ============================================

export interface Dependency {
    id: string;
    source: string;      // Resource ID
    target: string;      // Resource ID
    type: DependencyType;
    isInferred: boolean;
    confidence: ConfidenceLevel;
    reason?: string;     // Explanation for inferred dependencies
    metadata?: Record<string, unknown>;
}

// ============================================
// Graph Data Structures
// ============================================

export interface GraphNode {
    id: string;
    label: string;
    type: ResourceKind;
    platform: Platform;
    group?: string;      // Logical grouping (frontend, backend, data, infra)
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

// ============================================
// Analysis Output Types
// ============================================

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
    path: string[];      // Resource IDs
    description: string;
    riskLevel: Severity;
}

export interface LogicalGroup {
    name: string;
    category: 'frontend' | 'backend' | 'data' | 'infra' | 'external';
    resources: string[];  // Resource IDs
}

export interface ExternalDependency {
    name: string;
    type: string;        // database, message-broker, api, etc.
    inferredFrom: string[];  // Resource IDs that reference it
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
    affectedResources: string[];  // Resource IDs
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

// ============================================
// Complete Analysis Result
// ============================================

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

// ============================================
// API Request/Response Types
// ============================================

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
