// ============================================
// CloudGraph - Kubernetes Manifest Parser
// ============================================

import { v4 as uuidv4 } from 'uuid';
import {
    Resource,
    ResourceKind,
    PortMapping,
    VolumeMount,
    EnvVar,
    Dependency
} from '../../../shared/types';

// Kubernetes API types
interface K8sMetadata {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
}

interface K8sContainer {
    name: string;
    image: string;
    ports?: { containerPort: number; protocol?: string; name?: string }[];
    volumeMounts?: { name: string; mountPath: string; subPath?: string; readOnly?: boolean }[];
    env?: {
        name: string;
        value?: string;
        valueFrom?: {
            configMapKeyRef?: { name: string; key: string };
            secretKeyRef?: { name: string; key: string };
            fieldRef?: { fieldPath: string };
        };
    }[];
    envFrom?: {
        configMapRef?: { name: string };
        secretRef?: { name: string };
    }[];
    command?: string[];
    args?: string[];
    workingDir?: string;
    resources?: {
        limits?: { cpu?: string; memory?: string };
        requests?: { cpu?: string; memory?: string };
    };
    livenessProbe?: K8sProbe;
    readinessProbe?: K8sProbe;
}

interface K8sProbe {
    httpGet?: { path: string; port: number | string };
    tcpSocket?: { port: number | string };
    exec?: { command: string[] };
    initialDelaySeconds?: number;
    periodSeconds?: number;
    timeoutSeconds?: number;
}

interface K8sPodSpec {
    containers: K8sContainer[];
    initContainers?: K8sContainer[];
    volumes?: {
        name: string;
        configMap?: { name: string };
        secret?: { secretName: string };
        persistentVolumeClaim?: { claimName: string };
        emptyDir?: {};
        hostPath?: { path: string };
    }[];
    serviceAccountName?: string;
    nodeSelector?: Record<string, string>;
}

interface K8sWorkload {
    apiVersion: string;
    kind: string;
    metadata: K8sMetadata;
    spec: {
        replicas?: number;
        selector?: { matchLabels: Record<string, string> };
        template?: {
            metadata?: K8sMetadata;
            spec: K8sPodSpec;
        };
        // For Pod kind
        containers?: K8sContainer[];
        volumes?: K8sPodSpec['volumes'];
    };
}

interface K8sService {
    apiVersion: string;
    kind: 'Service';
    metadata: K8sMetadata;
    spec: {
        selector?: Record<string, string>;
        ports?: {
            name?: string;
            port: number;
            targetPort?: number | string;
            protocol?: string;
            nodePort?: number;
        }[];
        type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
        clusterIP?: string;
        externalName?: string;
    };
}

interface K8sIngress {
    apiVersion: string;
    kind: 'Ingress';
    metadata: K8sMetadata;
    spec: {
        ingressClassName?: string;
        tls?: { hosts: string[]; secretName: string }[];
        rules?: {
            host?: string;
            http?: {
                paths: {
                    path: string;
                    pathType: string;
                    backend: {
                        service?: { name: string; port: { number?: number; name?: string } };
                        serviceName?: string; // v1beta1
                        servicePort?: number | string; // v1beta1
                    };
                }[];
            };
        }[];
    };
}

interface K8sConfigMapOrSecret {
    apiVersion: string;
    kind: 'ConfigMap' | 'Secret';
    metadata: K8sMetadata;
    data?: Record<string, string>;
    stringData?: Record<string, string>;
}

interface K8sPVC {
    apiVersion: string;
    kind: 'PersistentVolumeClaim';
    metadata: K8sMetadata;
    spec: {
        accessModes: string[];
        resources: { requests: { storage: string } };
        storageClassName?: string;
        volumeName?: string;
    };
}

export interface KubernetesParseResult {
    resources: Resource[];
    dependencies: Dependency[];
}

/**
 * Parses a Kubernetes manifest and extracts resources and dependencies
 */
export function parseKubernetesManifest(
    content: unknown,
    fileName: string
): KubernetesParseResult {
    const result: KubernetesParseResult = {
        resources: [],
        dependencies: []
    };

    if (!content || typeof content !== 'object') {
        return result;
    }

    const manifest = content as { kind?: string; apiVersion?: string };

    if (!manifest.kind || !manifest.apiVersion) {
        return result;
    }

    switch (manifest.kind) {
        case 'Deployment':
        case 'StatefulSet':
        case 'DaemonSet':
        case 'Job':
        case 'CronJob':
            parseWorkload(manifest as K8sWorkload, fileName, result);
            break;
        case 'Pod':
            parsePod(manifest as K8sWorkload, fileName, result);
            break;
        case 'Service':
            parseService(manifest as K8sService, fileName, result);
            break;
        case 'Ingress':
            parseIngress(manifest as K8sIngress, fileName, result);
            break;
        case 'ConfigMap':
            parseConfigMap(manifest as K8sConfigMapOrSecret, fileName, result);
            break;
        case 'Secret':
            parseSecret(manifest as K8sConfigMapOrSecret, fileName, result);
            break;
        case 'PersistentVolumeClaim':
            parsePVC(manifest as K8sPVC, fileName, result);
            break;
        case 'PersistentVolume':
            parsePV(manifest as K8sPVC, fileName, result);
            break;
        default:
            // Handle unknown kinds generically
            parseGenericResource(manifest as K8sWorkload, fileName, result);
    }

    return result;
}

/**
 * Parses workload resources (Deployment, StatefulSet, DaemonSet, Job, CronJob)
 */
function parseWorkload(
    workload: K8sWorkload,
    fileName: string,
    result: KubernetesParseResult
): void {
    const kind = workload.kind as ResourceKind;
    const namespace = workload.metadata.namespace || 'default';
    const resourceId = `k8s-${kind.toLowerCase()}-${namespace}-${workload.metadata.name}`;

    const podSpec = workload.spec.template?.spec;
    if (!podSpec) return;

    // Parse container information
    const mainContainer = podSpec.containers[0];
    const allContainers = [...podSpec.containers, ...(podSpec.initContainers || [])];

    // Collect all ports from all containers
    const ports: PortMapping[] = [];
    for (const container of podSpec.containers) {
        if (container.ports) {
            ports.push(...container.ports.map(p => ({
                containerPort: p.containerPort,
                protocol: (p.protocol || 'TCP') as 'TCP' | 'UDP',
                name: p.name
            })));
        }
    }

    // Collect all volume mounts
    const volumes: VolumeMount[] = [];
    for (const container of podSpec.containers) {
        if (container.volumeMounts) {
            volumes.push(...container.volumeMounts.map(vm => ({
                name: vm.name,
                mountPath: vm.mountPath,
                subPath: vm.subPath,
                readOnly: vm.readOnly,
                type: 'pvc' as const
            })));
        }
    }

    // Collect environment variables from main container
    const environment = parseK8sEnvironment(mainContainer);

    // Create the workload resource
    const resource: Resource = {
        id: resourceId,
        name: workload.metadata.name,
        kind,
        platform: 'kubernetes',
        namespace,
        labels: workload.metadata.labels,
        annotations: workload.metadata.annotations,
        metadata: {
            image: mainContainer?.image,
            replicas: workload.spec.replicas || 1,
            ports,
            volumes,
            environment,
            selector: workload.spec.selector?.matchLabels,
            command: mainContainer?.command,
            args: mainContainer?.args,
            workingDir: mainContainer?.workingDir,
            resources: mainContainer?.resources,
            healthCheck: mainContainer?.livenessProbe ? {
                type: mainContainer.livenessProbe.httpGet ? 'http' :
                    mainContainer.livenessProbe.tcpSocket ? 'tcp' : 'exec',
                path: mainContainer.livenessProbe.httpGet?.path,
                port: typeof mainContainer.livenessProbe.httpGet?.port === 'number'
                    ? mainContainer.livenessProbe.httpGet.port : undefined,
                command: mainContainer.livenessProbe.exec?.command
            } : undefined
        },
        sourceFile: fileName
    };

    result.resources.push(resource);

    // Extract dependencies from all containers
    for (const container of allContainers) {
        extractContainerDependencies(container, resourceId, namespace, result);
    }

    // Extract volume dependencies
    if (podSpec.volumes) {
        for (const vol of podSpec.volumes) {
            if (vol.configMap) {
                result.dependencies.push({
                    id: uuidv4(),
                    source: resourceId,
                    target: `k8s-configmap-${namespace}-${vol.configMap.name}`,
                    type: 'config',
                    isInferred: false,
                    confidence: 'high',
                    reason: `ConfigMap volume: ${vol.name}`
                });
            }
            if (vol.secret) {
                result.dependencies.push({
                    id: uuidv4(),
                    source: resourceId,
                    target: `k8s-secret-${namespace}-${vol.secret.secretName}`,
                    type: 'secret',
                    isInferred: false,
                    confidence: 'high',
                    reason: `Secret volume: ${vol.name}`
                });
            }
            if (vol.persistentVolumeClaim) {
                result.dependencies.push({
                    id: uuidv4(),
                    source: resourceId,
                    target: `k8s-pvc-${namespace}-${vol.persistentVolumeClaim.claimName}`,
                    type: 'storage',
                    isInferred: false,
                    confidence: 'high',
                    reason: `PVC mount: ${vol.name}`
                });
            }
        }
    }
}

/**
 * Parses Pod resource
 */
function parsePod(
    pod: K8sWorkload,
    fileName: string,
    result: KubernetesParseResult
): void {
    const namespace = pod.metadata.namespace || 'default';
    const resourceId = `k8s-pod-${namespace}-${pod.metadata.name}`;

    const podSpec = pod.spec as unknown as K8sPodSpec;
    const mainContainer = podSpec.containers[0];

    const resource: Resource = {
        id: resourceId,
        name: pod.metadata.name,
        kind: 'Container',
        platform: 'kubernetes',
        namespace,
        labels: pod.metadata.labels,
        metadata: {
            image: mainContainer?.image,
            replicas: 1
        },
        sourceFile: fileName
    };

    result.resources.push(resource);
}

/**
 * Parses Service resource
 */
function parseService(
    svc: K8sService,
    fileName: string,
    result: KubernetesParseResult
): void {
    const namespace = svc.metadata.namespace || 'default';
    const resourceId = `k8s-service-${namespace}-${svc.metadata.name}`;

    const ports: PortMapping[] = (svc.spec.ports || []).map(p => ({
        containerPort: typeof p.targetPort === 'number' ? p.targetPort : p.port,
        hostPort: p.port,
        nodePort: p.nodePort,
        protocol: (p.protocol || 'TCP') as 'TCP' | 'UDP',
        name: p.name
    }));

    const resource: Resource = {
        id: resourceId,
        name: svc.metadata.name,
        kind: 'Service',
        platform: 'kubernetes',
        namespace,
        labels: svc.metadata.labels,
        metadata: {
            ports,
            selector: svc.spec.selector
        },
        sourceFile: fileName
    };

    result.resources.push(resource);

    // Service selects pods based on labels - this creates a selector dependency
    // The actual binding will be resolved during dependency analysis
    if (svc.spec.selector) {
        result.dependencies.push({
            id: uuidv4(),
            source: resourceId,
            target: `selector:${JSON.stringify(svc.spec.selector)}`,
            type: 'selector',
            isInferred: false,
            confidence: 'high',
            reason: 'Service selector',
            metadata: { selector: svc.spec.selector }
        });
    }
}

/**
 * Parses Ingress resource
 */
function parseIngress(
    ingress: K8sIngress,
    fileName: string,
    result: KubernetesParseResult
): void {
    const namespace = ingress.metadata.namespace || 'default';
    const resourceId = `k8s-ingress-${namespace}-${ingress.metadata.name}`;

    const resource: Resource = {
        id: resourceId,
        name: ingress.metadata.name,
        kind: 'Ingress',
        platform: 'kubernetes',
        namespace,
        labels: ingress.metadata.labels,
        annotations: ingress.metadata.annotations,
        metadata: {},
        sourceFile: fileName
    };

    result.resources.push(resource);

    // Extract routing dependencies to services
    if (ingress.spec.rules) {
        for (const rule of ingress.spec.rules) {
            if (rule.http?.paths) {
                for (const path of rule.http.paths) {
                    const serviceName = path.backend.service?.name || path.backend.serviceName;
                    if (serviceName) {
                        result.dependencies.push({
                            id: uuidv4(),
                            source: resourceId,
                            target: `k8s-service-${namespace}-${serviceName}`,
                            type: 'routing',
                            isInferred: false,
                            confidence: 'high',
                            reason: `Ingress path: ${path.path} -> ${serviceName}`,
                            metadata: {
                                host: rule.host,
                                path: path.path
                            }
                        });
                    }
                }
            }
        }
    }

    // TLS secret dependencies
    if (ingress.spec.tls) {
        for (const tls of ingress.spec.tls) {
            if (tls.secretName) {
                result.dependencies.push({
                    id: uuidv4(),
                    source: resourceId,
                    target: `k8s-secret-${namespace}-${tls.secretName}`,
                    type: 'secret',
                    isInferred: false,
                    confidence: 'high',
                    reason: 'TLS certificate secret'
                });
            }
        }
    }
}

/**
 * Parses ConfigMap resource
 */
function parseConfigMap(
    cm: K8sConfigMapOrSecret,
    fileName: string,
    result: KubernetesParseResult
): void {
    const namespace = cm.metadata.namespace || 'default';
    const resourceId = `k8s-configmap-${namespace}-${cm.metadata.name}`;

    const resource: Resource = {
        id: resourceId,
        name: cm.metadata.name,
        kind: 'ConfigMap',
        platform: 'kubernetes',
        namespace,
        labels: cm.metadata.labels,
        metadata: {},
        sourceFile: fileName
    };

    result.resources.push(resource);
}

/**
 * Parses Secret resource
 */
function parseSecret(
    secret: K8sConfigMapOrSecret,
    fileName: string,
    result: KubernetesParseResult
): void {
    const namespace = secret.metadata.namespace || 'default';
    const resourceId = `k8s-secret-${namespace}-${secret.metadata.name}`;

    const resource: Resource = {
        id: resourceId,
        name: secret.metadata.name,
        kind: 'Secret',
        platform: 'kubernetes',
        namespace,
        labels: secret.metadata.labels,
        metadata: {},
        sourceFile: fileName
    };

    result.resources.push(resource);
}

/**
 * Parses PersistentVolumeClaim resource
 */
function parsePVC(
    pvc: K8sPVC,
    fileName: string,
    result: KubernetesParseResult
): void {
    const namespace = pvc.metadata.namespace || 'default';
    const resourceId = `k8s-pvc-${namespace}-${pvc.metadata.name}`;

    const resource: Resource = {
        id: resourceId,
        name: pvc.metadata.name,
        kind: 'PersistentVolumeClaim',
        platform: 'kubernetes',
        namespace,
        labels: pvc.metadata.labels,
        metadata: {},
        sourceFile: fileName
    };

    result.resources.push(resource);

    // If bound to a specific PV
    if (pvc.spec.volumeName) {
        result.dependencies.push({
            id: uuidv4(),
            source: resourceId,
            target: `k8s-pv-${pvc.spec.volumeName}`,
            type: 'storage',
            isInferred: false,
            confidence: 'high',
            reason: 'PVC bound to PV'
        });
    }
}

/**
 * Parses PersistentVolume resource
 */
function parsePV(
    pv: K8sPVC,
    fileName: string,
    result: KubernetesParseResult
): void {
    const resourceId = `k8s-pv-${pv.metadata.name}`;

    const resource: Resource = {
        id: resourceId,
        name: pv.metadata.name,
        kind: 'PersistentVolume',
        platform: 'kubernetes',
        labels: pv.metadata.labels,
        metadata: {},
        sourceFile: fileName
    };

    result.resources.push(resource);
}

/**
 * Parses generic/unknown resource types
 */
function parseGenericResource(
    manifest: K8sWorkload,
    fileName: string,
    result: KubernetesParseResult
): void {
    const namespace = manifest.metadata.namespace || 'default';
    const kind = manifest.kind as ResourceKind;
    const resourceId = `k8s-${kind.toLowerCase()}-${namespace}-${manifest.metadata.name}`;

    const resource: Resource = {
        id: resourceId,
        name: manifest.metadata.name,
        kind,
        platform: 'kubernetes',
        namespace,
        labels: manifest.metadata.labels,
        metadata: {},
        sourceFile: fileName
    };

    result.resources.push(resource);
}

/**
 * Extracts dependencies from container environment variables
 */
function extractContainerDependencies(
    container: K8sContainer,
    resourceId: string,
    namespace: string,
    result: KubernetesParseResult
): void {
    // Environment variable references
    if (container.env) {
        for (const env of container.env) {
            if (env.valueFrom?.configMapKeyRef) {
                result.dependencies.push({
                    id: uuidv4(),
                    source: resourceId,
                    target: `k8s-configmap-${namespace}-${env.valueFrom.configMapKeyRef.name}`,
                    type: 'config',
                    isInferred: false,
                    confidence: 'high',
                    reason: `Environment variable ${env.name} from ConfigMap`
                });
            }
            if (env.valueFrom?.secretKeyRef) {
                result.dependencies.push({
                    id: uuidv4(),
                    source: resourceId,
                    target: `k8s-secret-${namespace}-${env.valueFrom.secretKeyRef.name}`,
                    type: 'secret',
                    isInferred: false,
                    confidence: 'high',
                    reason: `Environment variable ${env.name} from Secret`
                });
            }
        }
    }

    // envFrom references
    if (container.envFrom) {
        for (const envFrom of container.envFrom) {
            if (envFrom.configMapRef) {
                result.dependencies.push({
                    id: uuidv4(),
                    source: resourceId,
                    target: `k8s-configmap-${namespace}-${envFrom.configMapRef.name}`,
                    type: 'config',
                    isInferred: false,
                    confidence: 'high',
                    reason: 'envFrom ConfigMap'
                });
            }
            if (envFrom.secretRef) {
                result.dependencies.push({
                    id: uuidv4(),
                    source: resourceId,
                    target: `k8s-secret-${namespace}-${envFrom.secretRef.name}`,
                    type: 'secret',
                    isInferred: false,
                    confidence: 'high',
                    reason: 'envFrom Secret'
                });
            }
        }
    }
}

/**
 * Parses Kubernetes environment variables
 */
function parseK8sEnvironment(container?: K8sContainer): EnvVar[] {
    if (!container?.env) return [];

    return container.env.map(env => ({
        name: env.name,
        value: env.value,
        valueFrom: env.valueFrom
    }));
}
