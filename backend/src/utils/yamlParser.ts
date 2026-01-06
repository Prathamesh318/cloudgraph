// ============================================
// CloudGraph - YAML Parser Utility
// ============================================

import yaml from 'js-yaml';
import { Platform, FileInput, ValidationResult, ValidationError, ValidationWarning } from '../types';

export interface ParsedYamlFile {
    fileName: string;
    platform: Platform;
    documents: unknown[];
    errors: string[];
}

/**
 * Detects whether a YAML file is Docker Compose or Kubernetes
 */
export function detectPlatform(content: unknown): Platform {
    if (typeof content !== 'object' || content === null) {
        return 'kubernetes'; // Default fallback
    }

    const doc = content as Record<string, unknown>;

    // Docker Compose detection
    if (
        doc.version !== undefined ||
        doc.services !== undefined ||
        doc.networks !== undefined ||
        (doc.volumes !== undefined && !doc.apiVersion)
    ) {
        return 'docker-compose';
    }

    // Kubernetes detection (has apiVersion and kind)
    if (doc.apiVersion !== undefined && doc.kind !== undefined) {
        return 'kubernetes';
    }

    // Default to kubernetes for unknown formats
    return 'kubernetes';
}

/**
 * Validates YAML syntax and structure
 */
export function validateYaml(files: FileInput[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const file of files) {
        try {
            // Attempt to parse the YAML
            const documents = yaml.loadAll(file.content);

            if (documents.length === 0) {
                warnings.push({
                    file: file.name,
                    message: 'File is empty or contains no valid YAML documents'
                });
                continue;
            }

            // Check each document
            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];

                if (doc === null || doc === undefined) {
                    warnings.push({
                        file: file.name,
                        message: `Document ${i + 1} is empty`
                    });
                    continue;
                }

                const platform = detectPlatform(doc);

                // Platform-specific validation
                if (platform === 'docker-compose') {
                    validateDockerCompose(file.name, doc as Record<string, unknown>, errors, warnings);
                } else if (platform === 'kubernetes') {
                    validateKubernetes(file.name, doc as Record<string, unknown>, errors, warnings);
                }
            }
        } catch (err) {
            const yamlError = err as yaml.YAMLException;
            errors.push({
                file: file.name,
                line: yamlError.mark?.line,
                message: `YAML syntax error: ${yamlError.message}`
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validates Docker Compose specific structure
 */
function validateDockerCompose(
    fileName: string,
    doc: Record<string, unknown>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
): void {
    // Check for services
    if (!doc.services && !doc.version) {
        warnings.push({
            file: fileName,
            message: 'Docker Compose file has no services defined'
        });
    }

    // Validate version
    if (doc.version) {
        const version = String(doc.version);
        if (!version.startsWith('2') && !version.startsWith('3')) {
            warnings.push({
                file: fileName,
                message: `Docker Compose version "${version}" may not be fully supported. Versions 2.x and 3.x are recommended.`
            });
        }
    }

    // Validate services
    if (doc.services && typeof doc.services === 'object') {
        const services = doc.services as Record<string, unknown>;
        for (const [name, service] of Object.entries(services)) {
            if (typeof service !== 'object' || service === null) {
                errors.push({
                    file: fileName,
                    message: `Service "${name}" has invalid configuration`
                });
                continue;
            }

            const svc = service as Record<string, unknown>;

            // Check for image or build
            if (!svc.image && !svc.build) {
                warnings.push({
                    file: fileName,
                    message: `Service "${name}" has no image or build context specified`
                });
            }
        }
    }
}

/**
 * Validates Kubernetes manifest structure
 */
function validateKubernetes(
    fileName: string,
    doc: Record<string, unknown>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
): void {
    // Required fields for Kubernetes
    if (!doc.apiVersion) {
        errors.push({
            file: fileName,
            message: 'Kubernetes manifest missing required field: apiVersion'
        });
    }

    if (!doc.kind) {
        errors.push({
            file: fileName,
            message: 'Kubernetes manifest missing required field: kind'
        });
    }

    // Check metadata
    if (!doc.metadata) {
        warnings.push({
            file: fileName,
            message: 'Kubernetes manifest has no metadata section'
        });
    } else {
        const metadata = doc.metadata as Record<string, unknown>;
        if (!metadata.name) {
            errors.push({
                file: fileName,
                message: 'Kubernetes manifest metadata missing required field: name'
            });
        }
    }

    // Validate spec for workloads
    const workloadKinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'Pod'];
    if (workloadKinds.includes(doc.kind as string) && !doc.spec) {
        errors.push({
            file: fileName,
            message: `Kubernetes ${doc.kind} missing required field: spec`
        });
    }
}

/**
 * Parses YAML files and returns structured documents
 */
export function parseYamlFiles(files: FileInput[]): ParsedYamlFile[] {
    const results: ParsedYamlFile[] = [];

    for (const file of files) {
        const parsed: ParsedYamlFile = {
            fileName: file.name,
            platform: 'kubernetes',
            documents: [],
            errors: []
        };

        try {
            const documents = yaml.loadAll(file.content);

            // Filter out null/empty documents
            parsed.documents = documents.filter(doc => doc !== null && doc !== undefined);

            // Detect platform from first document
            if (parsed.documents.length > 0) {
                parsed.platform = detectPlatform(parsed.documents[0]);
            }
        } catch (err) {
            const yamlError = err as yaml.YAMLException;
            parsed.errors.push(`YAML parse error: ${yamlError.message}`);
        }

        results.push(parsed);
    }

    return results;
}

/**
 * Splits multi-document YAML into separate documents
 */
export function splitYamlDocuments(content: string): string[] {
    const documents: string[] = [];
    const lines = content.split('\n');
    let currentDoc: string[] = [];

    for (const line of lines) {
        if (line.trim() === '---') {
            if (currentDoc.length > 0) {
                documents.push(currentDoc.join('\n'));
                currentDoc = [];
            }
        } else {
            currentDoc.push(line);
        }
    }

    // Add last document
    if (currentDoc.length > 0) {
        const docContent = currentDoc.join('\n').trim();
        if (docContent) {
            documents.push(docContent);
        }
    }

    return documents;
}
