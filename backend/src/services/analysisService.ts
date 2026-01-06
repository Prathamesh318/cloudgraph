// ============================================
// CloudGraph - Analysis Service
// ============================================

import { v4 as uuidv4 } from 'uuid';
import {
    AnalysisResult,
    Resource,
    Dependency,
    DependencyGraph,
    GraphNode,
    GraphEdge,
    ResourceSummary,
    MermaidDiagrams,
    ArchitecturalAnalysis,
    RiskAssessment,
    Recommendation,
    FileInput,
    AnalysisOptions,
    ResourceKind,
    Platform,
    LogicalGroup,
    CriticalPath,
    ExternalDependency
} from '../types';
import { parseYamlFiles, ParsedYamlFile } from '../utils/yamlParser';
import { parseDockerCompose } from '../parsers/dockerComposeParser';
import { parseKubernetesManifest } from '../parsers/kubernetesParser';

/**
 * Main analysis service - orchestrates parsing and dependency analysis
 */
export async function analyzeFiles(
    files: FileInput[],
    options: AnalysisOptions = {}
): Promise<AnalysisResult> {
    const analysisId = uuidv4();
    const startTime = new Date();

    // Debug: Log input files
    console.log('[DEBUG] analyzeFiles called with', files.length, 'files');
    for (const file of files) {
        console.log('[DEBUG] File:', file.name, 'Content length:', file.content?.length || 0);
        console.log('[DEBUG] Content preview:', file.content?.substring(0, 200));
    }

    // Parse YAML files
    const parsedFiles = parseYamlFiles(files);

    // Debug: Log parsed results
    console.log('[DEBUG] Parsed files:', parsedFiles.length);
    for (const parsed of parsedFiles) {
        console.log('[DEBUG] Parsed file:', parsed.fileName);
        console.log('[DEBUG]   Platform:', parsed.platform);
        console.log('[DEBUG]   Documents:', parsed.documents.length);
        console.log('[DEBUG]   Errors:', parsed.errors);
        if (parsed.documents.length > 0) {
            console.log('[DEBUG]   First doc keys:', Object.keys(parsed.documents[0] as object || {}));
        }
    }

    // Extract resources and dependencies
    const allResources: Resource[] = [];
    const allDependencies: Dependency[] = [];
    const errors: string[] = [];

    for (const parsed of parsedFiles) {
        if (parsed.errors.length > 0) {
            errors.push(...parsed.errors);
            continue;
        }

        for (const doc of parsed.documents) {
            try {
                if (parsed.platform === 'docker-compose') {
                    console.log('[DEBUG] Parsing as Docker Compose...');
                    const result = parseDockerCompose(doc, parsed.fileName);
                    console.log('[DEBUG] Docker Compose result:', result.resources.length, 'resources,', result.dependencies.length, 'dependencies');
                    allResources.push(...result.resources);
                    allDependencies.push(...result.dependencies);
                } else {
                    console.log('[DEBUG] Parsing as Kubernetes...');
                    const result = parseKubernetesManifest(doc, parsed.fileName);
                    console.log('[DEBUG] Kubernetes result:', result.resources.length, 'resources');
                    allResources.push(...result.resources);
                    allDependencies.push(...result.dependencies);
                }
            } catch (err) {
                console.log('[DEBUG] Parse error:', (err as Error).message);
                errors.push(`Error parsing ${parsed.fileName}: ${(err as Error).message}`);
            }
        }
    }

    console.log('[DEBUG] Total resources:', allResources.length);
    console.log('[DEBUG] Total dependencies:', allDependencies.length);
    console.log('[DEBUG] Errors:', errors);

    // Resolve selector dependencies
    const resolvedDependencies = resolveSelectorDependencies(allDependencies, allResources);

    // Infer additional dependencies if enabled
    let finalDependencies = resolvedDependencies;
    if (options.inferDependencies !== false) {
        const inferred = inferDependencies(allResources, resolvedDependencies);
        finalDependencies = [...resolvedDependencies, ...inferred];
    }

    // Build the dependency graph
    const graph = buildDependencyGraph(allResources, finalDependencies, files);

    // Generate Mermaid diagrams
    const diagrams = generateMermaidDiagrams(allResources, finalDependencies);

    // Perform architectural analysis
    const analysis = performArchitecturalAnalysis(allResources, finalDependencies);

    // Detect risks
    const risks = detectRisks(allResources, finalDependencies);

    // Generate recommendations
    const recommendations = generateRecommendations(risks, allResources);

    // Build resource summary
    const summary = buildResourceSummary(allResources);

    return {
        id: analysisId,
        status: errors.length === 0 ? 'completed' : 'completed',
        createdAt: startTime.toISOString(),
        completedAt: new Date().toISOString(),
        summary,
        graph,
        diagrams,
        analysis,
        risks,
        recommendations,
        errors: errors.length > 0 ? errors : undefined
    };
}

/**
 * Resolves selector-based dependencies (Service -> Deployment via labels)
 */
function resolveSelectorDependencies(
    dependencies: Dependency[],
    resources: Resource[]
): Dependency[] {
    const resolved: Dependency[] = [];

    for (const dep of dependencies) {
        if (dep.type === 'selector' && dep.target.startsWith('selector:')) {
            // Parse the selector
            const selectorJson = dep.target.replace('selector:', '');
            const selector = JSON.parse(selectorJson) as Record<string, string>;

            // Find resources matching the selector
            for (const resource of resources) {
                if (matchesSelector(resource, selector)) {
                    resolved.push({
                        ...dep,
                        id: uuidv4(),
                        target: resource.id,
                        reason: `Selector match: ${JSON.stringify(selector)}`
                    });
                }
            }
        } else {
            resolved.push(dep);
        }
    }

    return resolved;
}

/**
 * Checks if a resource matches a label selector
 */
function matchesSelector(resource: Resource, selector: Record<string, string>): boolean {
    if (!resource.labels) return false;

    for (const [key, value] of Object.entries(selector)) {
        if (resource.labels[key] !== value) {
            return false;
        }
    }
    return true;
}

/**
 * Infers additional dependencies from environment variables
 */
function inferDependencies(
    resources: Resource[],
    existing: Dependency[]
): Dependency[] {
    const inferred: Dependency[] = [];

    // Patterns for inferring dependencies
    const patterns = [
        { regex: /postgres|postgresql/i, type: 'database', name: 'PostgreSQL' },
        { regex: /mysql|mariadb/i, type: 'database', name: 'MySQL' },
        { regex: /mongodb|mongo/i, type: 'database', name: 'MongoDB' },
        { regex: /redis/i, type: 'cache', name: 'Redis' },
        { regex: /rabbitmq|amqp/i, type: 'message-broker', name: 'RabbitMQ' },
        { regex: /kafka/i, type: 'message-broker', name: 'Kafka' },
        { regex: /elasticsearch/i, type: 'search', name: 'Elasticsearch' },
    ];

    for (const resource of resources) {
        if (!resource.metadata.environment) continue;

        for (const env of resource.metadata.environment) {
            const envString = `${env.name}=${env.value || ''}`;

            for (const pattern of patterns) {
                if (pattern.regex.test(envString)) {
                    // Check if we already have a dependency to a service of this type
                    const existingDep = existing.find(d =>
                        d.source === resource.id &&
                        d.target.toLowerCase().includes(pattern.name.toLowerCase())
                    );

                    if (!existingDep) {
                        // Try to find a matching service in resources
                        const matchingService = resources.find(r =>
                            r.name.toLowerCase().includes(pattern.name.toLowerCase()) ||
                            r.metadata.image?.toLowerCase().includes(pattern.name.toLowerCase())
                        );

                        if (matchingService && matchingService.id !== resource.id) {
                            inferred.push({
                                id: uuidv4(),
                                source: resource.id,
                                target: matchingService.id,
                                type: 'runtime',
                                isInferred: true,
                                confidence: 'medium',
                                reason: `Inferred from environment variable: ${env.name}`
                            });
                        }
                    }
                }
            }
        }
    }

    return inferred;
}

/**
 * Builds the dependency graph structure
 */
function buildDependencyGraph(
    resources: Resource[],
    dependencies: Dependency[],
    files: FileInput[]
): DependencyGraph {
    const nodes: GraphNode[] = resources.map(r => ({
        id: r.id,
        label: r.name,
        type: r.kind,
        platform: r.platform,
        namespace: r.namespace,
        group: categorizeResource(r),
        properties: {
            image: r.metadata.image,
            replicas: r.metadata.replicas,
            ports: r.metadata.ports,
            sourceFile: r.sourceFile
        }
    }));

    const edges: GraphEdge[] = dependencies
        .filter(d => !d.target.startsWith('selector:'))
        .map(d => ({
            id: d.id,
            source: d.source,
            target: d.target,
            type: d.type,
            isInferred: d.isInferred,
            confidence: d.confidence,
            label: d.type
        }));

    const platforms = [...new Set(resources.map(r => r.platform))];

    return {
        nodes,
        edges,
        metadata: {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            platforms,
            generatedAt: new Date().toISOString(),
            sourceFiles: files.map(f => f.name)
        }
    };
}

/**
 * Categorizes a resource into logical groups
 */
function categorizeResource(resource: Resource): string {
    const name = resource.name.toLowerCase();
    const image = resource.metadata.image?.toLowerCase() || '';

    // Frontend indicators
    if (name.includes('frontend') || name.includes('ui') || name.includes('web') ||
        image.includes('nginx') || image.includes('react') || image.includes('vue') ||
        image.includes('angular')) {
        return 'frontend';
    }

    // Data layer indicators
    if (name.includes('postgres') || name.includes('mysql') || name.includes('mongo') ||
        name.includes('redis') || name.includes('database') || name.includes('db') ||
        image.includes('postgres') || image.includes('mysql') || image.includes('mongo') ||
        image.includes('redis')) {
        return 'data';
    }

    // Infrastructure indicators
    if (resource.kind === 'Ingress' || resource.kind === 'Service' ||
        resource.kind === 'ConfigMap' || resource.kind === 'Secret' ||
        resource.kind === 'PersistentVolume' || resource.kind === 'PersistentVolumeClaim') {
        return 'infra';
    }

    // Message brokers
    if (name.includes('rabbit') || name.includes('kafka') || name.includes('queue') ||
        image.includes('rabbitmq') || image.includes('kafka')) {
        return 'infra';
    }

    // Default to backend
    return 'backend';
}

/**
 * Generates Mermaid diagrams for visualization
 */
function generateMermaidDiagrams(
    resources: Resource[],
    dependencies: Dependency[]
): MermaidDiagrams {
    return {
        containerView: generateContainerViewDiagram(resources, dependencies),
        serviceView: generateServiceViewDiagram(resources, dependencies),
        infrastructureView: generateInfrastructureViewDiagram(resources, dependencies)
    };
}

function generateContainerViewDiagram(resources: Resource[], dependencies: Dependency[]): string {
    const containers = resources.filter(r =>
        ['Container', 'Deployment', 'StatefulSet', 'DaemonSet', 'Pod'].includes(r.kind)
    );

    let diagram = 'flowchart TB\n';

    // Add nodes
    for (const container of containers) {
        const label = container.metadata.image
            ? `${container.name}<br/>${container.metadata.image.split('/').pop()}`
            : container.name;
        diagram += `  ${sanitizeId(container.id)}["${label}"]\n`;
    }

    // Add edges
    const containerIds = new Set(containers.map(c => c.id));
    for (const dep of dependencies) {
        if (containerIds.has(dep.source) && containerIds.has(dep.target)) {
            const style = dep.isInferred ? '-.->' : '-->';
            const label = dep.type;
            diagram += `  ${sanitizeId(dep.source)} ${style}|${label}| ${sanitizeId(dep.target)}\n`;
        }
    }

    return diagram;
}

function generateServiceViewDiagram(resources: Resource[], dependencies: Dependency[]): string {
    const services = resources.filter(r => r.kind === 'Service');
    const ingresses = resources.filter(r => r.kind === 'Ingress');
    const workloads = resources.filter(r =>
        ['Deployment', 'StatefulSet', 'DaemonSet', 'Container'].includes(r.kind)
    );

    let diagram = 'flowchart LR\n';
    diagram += '  subgraph External\n';
    diagram += '    Internet((Internet))\n';
    diagram += '  end\n\n';

    if (ingresses.length > 0) {
        diagram += '  subgraph Ingress\n';
        for (const ing of ingresses) {
            diagram += `    ${sanitizeId(ing.id)}[${ing.name}]\n`;
        }
        diagram += '  end\n\n';
    }

    if (services.length > 0) {
        diagram += '  subgraph Services\n';
        for (const svc of services) {
            diagram += `    ${sanitizeId(svc.id)}[${svc.name}]\n`;
        }
        diagram += '  end\n\n';
    }

    if (workloads.length > 0) {
        diagram += '  subgraph Workloads\n';
        for (const wl of workloads) {
            diagram += `    ${sanitizeId(wl.id)}[${wl.name}]\n`;
        }
        diagram += '  end\n\n';
    }

    // Connect ingresses to services
    for (const dep of dependencies) {
        if (dep.type === 'routing') {
            diagram += `  ${sanitizeId(dep.source)} --> ${sanitizeId(dep.target)}\n`;
        }
    }

    // Connect services to workloads
    for (const dep of dependencies) {
        if (dep.type === 'selector') {
            diagram += `  ${sanitizeId(dep.source)} --> ${sanitizeId(dep.target)}\n`;
        }
    }

    return diagram;
}

function generateInfrastructureViewDiagram(resources: Resource[], dependencies: Dependency[]): string {
    let diagram = 'flowchart TB\n';

    // Group by category
    const groups: Record<string, Resource[]> = {
        frontend: [],
        backend: [],
        data: [],
        infra: []
    };

    for (const resource of resources) {
        const group = categorizeResource(resource);
        groups[group].push(resource);
    }

    // Frontend subgraph
    if (groups.frontend.length > 0) {
        diagram += '  subgraph Frontend\n';
        for (const r of groups.frontend) {
            diagram += `    ${sanitizeId(r.id)}["${r.name}"]\n`;
        }
        diagram += '  end\n\n';
    }

    // Backend subgraph
    if (groups.backend.length > 0) {
        diagram += '  subgraph Backend\n';
        for (const r of groups.backend) {
            diagram += `    ${sanitizeId(r.id)}["${r.name}"]\n`;
        }
        diagram += '  end\n\n';
    }

    // Data subgraph
    if (groups.data.length > 0) {
        diagram += '  subgraph Data\n';
        for (const r of groups.data) {
            diagram += `    ${sanitizeId(r.id)}["${r.name}"]\n`;
        }
        diagram += '  end\n\n';
    }

    // Add edges
    for (const dep of dependencies) {
        if (!dep.target.startsWith('selector:')) {
            const style = dep.isInferred ? '-.->' : '-->';
            diagram += `  ${sanitizeId(dep.source)} ${style} ${sanitizeId(dep.target)}\n`;
        }
    }

    return diagram;
}

function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Performs architectural analysis
 */
function performArchitecturalAnalysis(
    resources: Resource[],
    dependencies: Dependency[]
): ArchitecturalAnalysis {
    // Build logical groups
    const groupMap: Record<string, string[]> = {
        frontend: [],
        backend: [],
        data: [],
        infra: []
    };

    for (const resource of resources) {
        const group = categorizeResource(resource);
        groupMap[group].push(resource.id);
    }

    const logicalGroups: LogicalGroup[] = Object.entries(groupMap)
        .filter(([_, ids]) => ids.length > 0)
        .map(([name, resources]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            category: name as 'frontend' | 'backend' | 'data' | 'infra',
            resources
        }));

    // Generate overview
    const platforms = [...new Set(resources.map(r => r.platform))];
    const overview = generateOverview(resources, dependencies, platforms);

    // Detect external dependencies
    const externalDeps = detectExternalDependencies(resources);

    return {
        overview,
        criticalPaths: [],  // TODO: Implement critical path detection
        logicalGroups,
        externalDependencies: externalDeps
    };
}

function generateOverview(
    resources: Resource[],
    dependencies: Dependency[],
    platforms: Platform[]
): string {
    const lines: string[] = [];

    lines.push(`This infrastructure consists of ${resources.length} resources across ${platforms.length} platform(s): ${platforms.join(', ')}.`);

    const workloads = resources.filter(r =>
        ['Container', 'Deployment', 'StatefulSet', 'DaemonSet'].includes(r.kind)
    );
    const services = resources.filter(r => r.kind === 'Service');
    const ingresses = resources.filter(r => r.kind === 'Ingress');

    if (workloads.length > 0) {
        lines.push(`\n**Workloads:** ${workloads.length} container workloads detected.`);
    }

    if (services.length > 0) {
        lines.push(`**Services:** ${services.length} service endpoints configured.`);
    }

    if (ingresses.length > 0) {
        lines.push(`**Ingress:** ${ingresses.length} ingress resources for external access.`);
    }

    const inferredDeps = dependencies.filter(d => d.isInferred);
    if (inferredDeps.length > 0) {
        lines.push(`\n**Note:** ${inferredDeps.length} dependencies were inferred from environment variables and may need verification.`);
    }

    return lines.join('\n');
}

function detectExternalDependencies(resources: Resource[]): ExternalDependency[] {
    const external: ExternalDependency[] = [];
    const seen = new Set<string>();

    for (const resource of resources) {
        if (!resource.metadata.environment) continue;

        for (const env of resource.metadata.environment) {
            const val = env.value || '';

            // Detect external URLs
            const urlMatch = val.match(/https?:\/\/([^\/\s:]+)/);
            if (urlMatch && !seen.has(urlMatch[1])) {
                seen.add(urlMatch[1]);
                external.push({
                    name: urlMatch[1],
                    type: 'external-api',
                    inferredFrom: [resource.id],
                    confidence: 'medium'
                });
            }
        }
    }

    return external;
}

/**
 * Detects risks in the configuration
 */
function detectRisks(
    resources: Resource[],
    dependencies: Dependency[]
): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    // Check for single replicas
    for (const resource of resources) {
        if (['Deployment', 'StatefulSet'].includes(resource.kind)) {
            if (resource.metadata.replicas === 1) {
                risks.push({
                    id: uuidv4(),
                    severity: 'medium',
                    category: 'Availability',
                    title: 'Single Replica Workload',
                    description: `${resource.kind} "${resource.name}" has only 1 replica, creating a single point of failure.`,
                    affectedResources: [resource.id],
                    recommendation: 'Consider increasing replicas to at least 2 for high availability.'
                });
            }
        }
    }

    // Check for missing health checks
    for (const resource of resources) {
        if (['Deployment', 'StatefulSet', 'DaemonSet'].includes(resource.kind)) {
            if (!resource.metadata.healthCheck) {
                risks.push({
                    id: uuidv4(),
                    severity: 'medium',
                    category: 'Reliability',
                    title: 'Missing Health Checks',
                    description: `${resource.kind} "${resource.name}" has no liveness or readiness probes configured.`,
                    affectedResources: [resource.id],
                    recommendation: 'Add liveness and readiness probes for better failure detection.'
                });
            }
        }
    }

    // Check for missing resource limits (Kubernetes)
    for (const resource of resources) {
        if (resource.platform === 'kubernetes' &&
            ['Deployment', 'StatefulSet', 'DaemonSet'].includes(resource.kind)) {
            if (!resource.metadata.resources?.limits) {
                risks.push({
                    id: uuidv4(),
                    severity: 'medium',
                    category: 'Resource Management',
                    title: 'Missing Resource Limits',
                    description: `${resource.kind} "${resource.name}" has no CPU/memory limits defined.`,
                    affectedResources: [resource.id],
                    recommendation: 'Define resource limits to prevent resource exhaustion.'
                });
            }
        }
    }

    // Check for orphaned resources
    const referencedIds = new Set<string>();
    for (const dep of dependencies) {
        referencedIds.add(dep.target);
    }

    for (const resource of resources) {
        if (['ConfigMap', 'Secret', 'PersistentVolumeClaim'].includes(resource.kind)) {
            const isReferenced = referencedIds.has(resource.id);
            if (!isReferenced) {
                risks.push({
                    id: uuidv4(),
                    severity: 'low',
                    category: 'Cleanup',
                    title: 'Potentially Orphaned Resource',
                    description: `${resource.kind} "${resource.name}" is not referenced by any workload.`,
                    affectedResources: [resource.id],
                    recommendation: 'Verify if this resource is still needed or can be removed.'
                });
            }
        }
    }

    return risks;
}

/**
 * Generates recommendations based on detected risks
 */
function generateRecommendations(
    risks: RiskAssessment[],
    resources: Resource[]
): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Group risks by category
    const risksByCategory: Record<string, RiskAssessment[]> = {};
    for (const risk of risks) {
        if (!risksByCategory[risk.category]) {
            risksByCategory[risk.category] = [];
        }
        risksByCategory[risk.category].push(risk);
    }

    // Generate category-level recommendations
    if (risksByCategory['Availability']?.length > 0) {
        recommendations.push({
            id: uuidv4(),
            priority: 'high',
            category: 'Availability',
            title: 'Improve High Availability',
            description: `${risksByCategory['Availability'].length} workloads have single replicas. Consider implementing horizontal pod autoscaling or increasing replica counts.`,
            affectedResources: risksByCategory['Availability'].flatMap(r => r.affectedResources)
        });
    }

    if (risksByCategory['Reliability']?.length > 0) {
        recommendations.push({
            id: uuidv4(),
            priority: 'high',
            category: 'Reliability',
            title: 'Add Health Checks',
            description: `${risksByCategory['Reliability'].length} workloads are missing health checks. Add liveness and readiness probes for better failure detection and recovery.`,
            affectedResources: risksByCategory['Reliability'].flatMap(r => r.affectedResources)
        });
    }

    return recommendations;
}

/**
 * Builds the resource summary
 */
function buildResourceSummary(resources: Resource[]): ResourceSummary {
    const byKind: Partial<Record<ResourceKind, number>> = {};
    const byPlatform: Partial<Record<Platform, number>> = {};

    for (const resource of resources) {
        byKind[resource.kind] = (byKind[resource.kind] || 0) + 1;
        byPlatform[resource.platform] = (byPlatform[resource.platform] || 0) + 1;
    }

    return {
        totalResources: resources.length,
        byKind,
        byPlatform,
        resources
    };
}
