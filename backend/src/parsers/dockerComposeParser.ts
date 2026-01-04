// ============================================
// CloudGraph - Docker Compose Parser
// ============================================

import { v4 as uuidv4 } from 'uuid';
import {
    Resource,
    ResourceKind,
    PortMapping,
    VolumeMount,
    EnvVar,
    Dependency,
    DependencyType
} from '../../../shared/types';

interface DockerComposeService {
    image?: string;
    build?: string | { context: string; dockerfile?: string };
    ports?: (string | { target: number; published: number; protocol?: string })[];
    volumes?: (string | { type: string; source: string; target: string; read_only?: boolean })[];
    environment?: string[] | Record<string, string>;
    env_file?: string | string[];
    depends_on?: string[] | Record<string, { condition: string }>;
    networks?: string[] | Record<string, unknown>;
    command?: string | string[];
    entrypoint?: string | string[];
    working_dir?: string;
    labels?: string[] | Record<string, string>;
    deploy?: {
        replicas?: number;
        resources?: {
            limits?: { cpus?: string; memory?: string };
            reservations?: { cpus?: string; memory?: string };
        };
    };
    healthcheck?: {
        test?: string | string[];
        interval?: string;
        timeout?: string;
        retries?: number;
    };
    secrets?: (string | { source: string; target?: string })[];
    configs?: (string | { source: string; target?: string })[];
    expose?: (string | number)[];
    links?: string[];
    container_name?: string;
}

interface DockerComposeFile {
    version?: string;
    services?: Record<string, DockerComposeService>;
    networks?: Record<string, unknown>;
    volumes?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
    configs?: Record<string, unknown>;
}

export interface DockerComposeParseResult {
    resources: Resource[];
    dependencies: Dependency[];
    networks: string[];
    volumes: string[];
    secrets: string[];
    configs: string[];
}

/**
 * Parses Docker Compose file and extracts resources and dependencies
 */
export function parseDockerCompose(
    content: unknown,
    fileName: string
): DockerComposeParseResult {
    const result: DockerComposeParseResult = {
        resources: [],
        dependencies: [],
        networks: [],
        volumes: [],
        secrets: [],
        configs: []
    };

    const compose = content as DockerComposeFile;

    // Extract top-level networks
    if (compose.networks) {
        result.networks = Object.keys(compose.networks);
        for (const networkName of result.networks) {
            result.resources.push(createNetworkResource(networkName, fileName));
        }
    }

    // Extract top-level volumes
    if (compose.volumes) {
        result.volumes = Object.keys(compose.volumes);
        for (const volumeName of result.volumes) {
            result.resources.push(createVolumeResource(volumeName, fileName));
        }
    }

    // Extract top-level secrets
    if (compose.secrets) {
        result.secrets = Object.keys(compose.secrets);
        for (const secretName of result.secrets) {
            result.resources.push(createSecretResource(secretName, fileName));
        }
    }

    // Extract top-level configs
    if (compose.configs) {
        result.configs = Object.keys(compose.configs);
        for (const configName of result.configs) {
            result.resources.push(createConfigResource(configName, fileName));
        }
    }

    // Parse services
    if (compose.services) {
        for (const [serviceName, service] of Object.entries(compose.services)) {
            const { resource, dependencies } = parseService(
                serviceName,
                service,
                fileName,
                result
            );
            result.resources.push(resource);
            result.dependencies.push(...dependencies);
        }
    }

    return result;
}

/**
 * Parses a single Docker Compose service
 */
function parseService(
    name: string,
    service: DockerComposeService,
    fileName: string,
    context: DockerComposeParseResult
): { resource: Resource; dependencies: Dependency[] } {
    const resourceId = `dc-container-${name}`;
    const dependencies: Dependency[] = [];

    // Parse ports
    const ports = parsePorts(service.ports);

    // Parse volumes
    const volumes = parseVolumes(service.volumes);

    // Parse environment variables
    const environment = parseEnvironment(service.environment);

    // Parse labels
    const labels = parseLabels(service.labels);

    // Create the resource
    const resource: Resource = {
        id: resourceId,
        name: service.container_name || name,
        kind: 'Container',
        platform: 'docker-compose',
        labels,
        metadata: {
            image: service.image || (service.build ? '[build]' : undefined),
            replicas: service.deploy?.replicas || 1,
            ports,
            volumes,
            environment,
            command: normalizeCommand(service.command),
            workingDir: service.working_dir,
            resources: service.deploy?.resources ? {
                limits: {
                    cpu: service.deploy.resources.limits?.cpus,
                    memory: service.deploy.resources.limits?.memory
                },
                requests: {
                    cpu: service.deploy.resources.reservations?.cpus,
                    memory: service.deploy.resources.reservations?.memory
                }
            } : undefined,
            healthCheck: service.healthcheck ? {
                type: 'exec',
                command: normalizeCommand(service.healthcheck.test),
                interval: service.healthcheck.interval,
                timeout: service.healthcheck.timeout
            } : undefined
        },
        sourceFile: fileName
    };

    // Extract dependencies

    // 1. depends_on (explicit startup dependencies)
    if (service.depends_on) {
        const deps = Array.isArray(service.depends_on)
            ? service.depends_on
            : Object.keys(service.depends_on);

        for (const dep of deps) {
            dependencies.push({
                id: uuidv4(),
                source: resourceId,
                target: `dc-container-${dep}`,
                type: 'startup',
                isInferred: false,
                confidence: 'high',
                reason: 'Explicit depends_on declaration'
            });
        }
    }

    // 2. links (legacy, implies network dependency)
    if (service.links) {
        for (const link of service.links) {
            const targetService = link.split(':')[0];
            dependencies.push({
                id: uuidv4(),
                source: resourceId,
                target: `dc-container-${targetService}`,
                type: 'network',
                isInferred: false,
                confidence: 'high',
                reason: 'Docker Compose links declaration'
            });
        }
    }

    // 3. Volume dependencies
    for (const vol of volumes) {
        if (vol.type === 'volume' && vol.name) {
            const volumeId = `dc-volume-${vol.name}`;
            dependencies.push({
                id: uuidv4(),
                source: resourceId,
                target: volumeId,
                type: 'storage',
                isInferred: false,
                confidence: 'high',
                reason: `Volume mount at ${vol.mountPath}`
            });
        }
    }

    // 4. Secret dependencies
    if (service.secrets) {
        for (const secret of service.secrets) {
            const secretName = typeof secret === 'string' ? secret : secret.source;
            dependencies.push({
                id: uuidv4(),
                source: resourceId,
                target: `dc-secret-${secretName}`,
                type: 'secret',
                isInferred: false,
                confidence: 'high',
                reason: 'Secret reference in service'
            });
        }
    }

    // 5. Config dependencies
    if (service.configs) {
        for (const config of service.configs) {
            const configName = typeof config === 'string' ? config : config.source;
            dependencies.push({
                id: uuidv4(),
                source: resourceId,
                target: `dc-config-${configName}`,
                type: 'config',
                isInferred: false,
                confidence: 'high',
                reason: 'Config reference in service'
            });
        }
    }

    // 6. Network dependencies
    if (service.networks) {
        const networks = Array.isArray(service.networks)
            ? service.networks
            : Object.keys(service.networks);

        for (const network of networks) {
            dependencies.push({
                id: uuidv4(),
                source: resourceId,
                target: `dc-network-${network}`,
                type: 'network',
                isInferred: false,
                confidence: 'high',
                reason: 'Network membership'
            });
        }
    }

    return { resource, dependencies };
}

// Helper functions

function parsePorts(ports?: DockerComposeService['ports']): PortMapping[] {
    if (!ports) return [];

    return ports.map(port => {
        if (typeof port === 'string') {
            const parts = port.split(':');
            if (parts.length === 2) {
                return {
                    hostPort: parseInt(parts[0], 10),
                    containerPort: parseInt(parts[1].split('/')[0], 10),
                    protocol: (parts[1].includes('/udp') ? 'UDP' : 'TCP') as 'TCP' | 'UDP'
                };
            } else {
                return {
                    containerPort: parseInt(parts[0].split('/')[0], 10),
                    protocol: (parts[0].includes('/udp') ? 'UDP' : 'TCP') as 'TCP' | 'UDP'
                };
            }
        } else {
            return {
                hostPort: port.published,
                containerPort: port.target,
                protocol: (port.protocol?.toUpperCase() || 'TCP') as 'TCP' | 'UDP'
            };
        }
    });
}

function parseVolumes(volumes?: DockerComposeService['volumes']): VolumeMount[] {
    if (!volumes) return [];

    return volumes.map(vol => {
        if (typeof vol === 'string') {
            const parts = vol.split(':');
            const isNamedVolume = !parts[0].startsWith('/') && !parts[0].startsWith('.');

            return {
                name: isNamedVolume ? parts[0] : `bind-${parts[0].replace(/[\/\\.]/g, '-')}`,
                source: parts[0],
                mountPath: parts[1] || parts[0],
                readOnly: parts[2] === 'ro',
                type: isNamedVolume ? 'volume' : 'bind'
            };
        } else {
            return {
                name: vol.source,
                source: vol.source,
                mountPath: vol.target,
                readOnly: vol.read_only,
                type: vol.type as VolumeMount['type']
            };
        }
    });
}

function parseEnvironment(env?: DockerComposeService['environment']): EnvVar[] {
    if (!env) return [];

    if (Array.isArray(env)) {
        return env.map(e => {
            const [name, ...valueParts] = e.split('=');
            return { name, value: valueParts.join('=') || undefined };
        });
    } else {
        return Object.entries(env).map(([name, value]) => ({
            name,
            value: value !== null ? String(value) : undefined
        }));
    }
}

function parseLabels(labels?: DockerComposeService['labels']): Record<string, string> {
    if (!labels) return {};

    if (Array.isArray(labels)) {
        const result: Record<string, string> = {};
        for (const label of labels) {
            const [key, ...valueParts] = label.split('=');
            result[key] = valueParts.join('=');
        }
        return result;
    }

    return labels;
}

function normalizeCommand(cmd?: string | string[]): string[] | undefined {
    if (!cmd) return undefined;
    return Array.isArray(cmd) ? cmd : [cmd];
}

function createNetworkResource(name: string, fileName: string): Resource {
    return {
        id: `dc-network-${name}`,
        name,
        kind: 'Network',
        platform: 'docker-compose',
        metadata: {},
        sourceFile: fileName
    };
}

function createVolumeResource(name: string, fileName: string): Resource {
    return {
        id: `dc-volume-${name}`,
        name,
        kind: 'Volume',
        platform: 'docker-compose',
        metadata: {},
        sourceFile: fileName
    };
}

function createSecretResource(name: string, fileName: string): Resource {
    return {
        id: `dc-secret-${name}`,
        name,
        kind: 'Secret',
        platform: 'docker-compose',
        metadata: {},
        sourceFile: fileName
    };
}

function createConfigResource(name: string, fileName: string): Resource {
    return {
        id: `dc-config-${name}`,
        name,
        kind: 'ConfigMap',
        platform: 'docker-compose',
        metadata: {},
        sourceFile: fileName
    };
}
