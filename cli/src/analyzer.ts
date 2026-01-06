// ============================================
// CloudGraph CLI - Analyzer
// ============================================

import type { ParsedResult, AnalysisResult, GraphNode, GraphEdge } from './types';

export function analyze(parsed: ParsedResult): AnalysisResult {
    // Build nodes from resources
    const nodes: GraphNode[] = parsed.resources.map(resource => ({
        id: resource.id,
        label: resource.name,
        type: resource.kind,
        platform: resource.platform,
    }));

    // Build edges from dependencies
    const edges: GraphEdge[] = parsed.dependencies.map(dep => ({
        id: dep.id,
        source: dep.source,
        target: dep.target,
        type: dep.type,
        isInferred: dep.isInferred,
    }));

    // Infer additional dependencies from environment variables
    for (const resource of parsed.resources) {
        const env = resource.metadata?.environment as Record<string, string> | undefined;
        if (env) {
            const inferred = inferDependencies(resource.id, env, parsed.resources);
            edges.push(...inferred);
        }
    }

    // Build summary
    const byKind: Record<string, number> = {};
    for (const resource of parsed.resources) {
        byKind[resource.kind] = (byKind[resource.kind] || 0) + 1;
    }

    // Detect risks
    const risks = detectRisks(parsed.resources);

    // Generate Mermaid diagrams
    const diagrams = generateMermaidDiagrams(nodes, edges);

    return {
        summary: {
            totalResources: parsed.resources.length,
            byKind,
            resources: parsed.resources,
        },
        graph: {
            nodes,
            edges,
            metadata: {
                totalNodes: nodes.length,
                totalEdges: edges.length,
            }
        },
        diagrams,
        risks,
        recommendations: risks.map(r => ({
            id: r.id,
            priority: r.severity,
            title: r.title,
            description: r.description,
        }))
    };
}

function inferDependencies(
    sourceId: string,
    env: Record<string, string>,
    resources: ParsedResult['resources']
): GraphEdge[] {
    const inferred: GraphEdge[] = [];
    const envString = Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ');

    const patterns = [
        { pattern: /postgres|postgresql/i, name: 'postgres' },
        { pattern: /mysql|mariadb/i, name: 'mysql' },
        { pattern: /redis/i, name: 'redis' },
        { pattern: /mongo/i, name: 'mongo' },
        { pattern: /kafka/i, name: 'kafka' },
        { pattern: /rabbit|amqp/i, name: 'rabbit' },
    ];

    for (const { pattern, name } of patterns) {
        if (pattern.test(envString)) {
            const target = resources.find(r =>
                r.name.toLowerCase().includes(name) ||
                (r.metadata?.image as string || '').toLowerCase().includes(name)
            );

            if (target && target.id !== sourceId) {
                inferred.push({
                    id: `inferred-${sourceId}-${target.id}`,
                    source: sourceId,
                    target: target.id,
                    type: 'runtime',
                    isInferred: true,
                });
            }
        }
    }

    return inferred;
}

function detectRisks(resources: ParsedResult['resources']): AnalysisResult['risks'] {
    const risks: AnalysisResult['risks'] = [];

    for (const resource of resources) {
        // Single replica check
        if (['Deployment', 'StatefulSet'].includes(resource.kind)) {
            const replicas = (resource.metadata as Record<string, unknown>)?.replicas;
            if (replicas === 1) {
                risks.push({
                    id: `risk-${resource.id}-replicas`,
                    severity: 'medium',
                    title: `Single replica: ${resource.name}`,
                    description: `${resource.kind} "${resource.name}" has only 1 replica`,
                });
            }
        }
    }

    return risks;
}

function generateMermaidDiagrams(nodes: GraphNode[], edges: GraphEdge[]): AnalysisResult['diagrams'] {
    let containerView = 'flowchart TB\n';

    for (const node of nodes) {
        containerView += `  ${node.id}["${node.label}"]\n`;
    }

    for (const edge of edges) {
        const style = edge.isInferred ? '-.->' : '-->';
        containerView += `  ${edge.source} ${style} ${edge.target}\n`;
    }

    return {
        containerView,
        serviceView: containerView,
        infrastructureView: containerView,
    };
}
