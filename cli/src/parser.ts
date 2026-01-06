// ============================================
// CloudGraph CLI - YAML Parser
// ============================================

import yaml from 'js-yaml';
import type { FileInput, ParsedResult, Platform, Resource, Dependency } from './types';

export function parseYaml(files: FileInput[]): ParsedResult {
    const resources: Resource[] = [];
    const dependencies: Dependency[] = [];
    const errors: string[] = [];

    for (const file of files) {
        try {
            const docs = yaml.loadAll(file.content) as Record<string, unknown>[];

            for (const doc of docs) {
                if (!doc) continue;

                const platform = detectPlatform(doc);

                if (platform === 'docker-compose') {
                    parseDockerCompose(doc, file.name, resources, dependencies);
                } else {
                    parseKubernetes(doc, file.name, resources, dependencies);
                }
            }
        } catch (error) {
            errors.push(`${file.name}: ${(error as Error).message}`);
        }
    }

    return { resources, dependencies, errors };
}

export function detectPlatform(doc: Record<string, unknown>): Platform {
    if (doc.version || doc.services || (doc.networks && !doc.apiVersion)) {
        return 'docker-compose';
    }
    return 'kubernetes';
}

function parseDockerCompose(
    doc: Record<string, unknown>,
    fileName: string,
    resources: Resource[],
    dependencies: Dependency[]
): void {
    const services = doc.services as Record<string, Record<string, unknown>> | undefined;

    if (!services) return;

    for (const [name, service] of Object.entries(services)) {
        const id = `container-${name}`;

        resources.push({
            id,
            name,
            kind: 'Container',
            platform: 'docker-compose',
            sourceFile: fileName,
            metadata: {
                image: service.image as string | undefined,
                ports: parsePorts(service.ports as (string | Record<string, unknown>)[] | undefined),
                environment: parseEnvironment(service.environment),
            }
        });

        // Parse depends_on
        if (service.depends_on) {
            const dependsOn = Array.isArray(service.depends_on)
                ? service.depends_on
                : Object.keys(service.depends_on);

            for (const dep of dependsOn) {
                dependencies.push({
                    id: `dep-${name}-${dep}`,
                    source: id,
                    target: `container-${dep}`,
                    type: 'startup',
                    isInferred: false
                });
            }
        }
    }
}

function parseKubernetes(
    doc: Record<string, unknown>,
    fileName: string,
    resources: Resource[],
    dependencies: Dependency[]
): void {
    const kind = doc.kind as string;
    const metadata = doc.metadata as Record<string, unknown> | undefined;

    if (!kind || !metadata) return;

    const name = metadata.name as string;
    const id = `${kind.toLowerCase()}-${name}`;

    resources.push({
        id,
        name,
        kind: kind as Resource['kind'],
        platform: 'kubernetes',
        sourceFile: fileName,
        metadata: {
            namespace: metadata.namespace as string | undefined,
            labels: metadata.labels as Record<string, string> | undefined,
        }
    });

    // Parse Service selectors
    if (kind === 'Service') {
        const spec = doc.spec as Record<string, unknown> | undefined;
        if (spec?.selector) {
            const selector = spec.selector as Record<string, string>;
            // Find matching deployments
            for (const resource of resources) {
                if (resource.kind === 'Deployment' || resource.kind === 'StatefulSet') {
                    const labels = resource.metadata?.labels as Record<string, string> | undefined;
                    if (labels && matchesSelector(labels, selector)) {
                        dependencies.push({
                            id: `dep-${id}-${resource.id}`,
                            source: id,
                            target: resource.id,
                            type: 'selector',
                            isInferred: false
                        });
                    }
                }
            }
        }
    }
}

function matchesSelector(labels: Record<string, string>, selector: Record<string, string>): boolean {
    for (const [key, value] of Object.entries(selector)) {
        if (labels[key] !== value) return false;
    }
    return true;
}

function parsePorts(ports: (string | Record<string, unknown>)[] | undefined): string[] {
    if (!ports) return [];
    return ports.map(p => typeof p === 'string' ? p : JSON.stringify(p));
}

function parseEnvironment(env: unknown): Record<string, string> {
    if (!env) return {};

    if (Array.isArray(env)) {
        const result: Record<string, string> = {};
        for (const e of env) {
            if (typeof e === 'string') {
                const [key, ...valueParts] = e.split('=');
                result[key] = valueParts.join('=');
            }
        }
        return result;
    }

    if (typeof env === 'object') {
        return env as Record<string, string>;
    }

    return {};
}
