// ============================================
// CloudGraph CLI - Validate Command
// ============================================

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import yaml from 'js-yaml';

interface ValidateOptions {
    strict?: boolean;
}

export async function validateCommand(files: string[], options: ValidateOptions): Promise<void> {
    const spinner = ora('Validating files...').start();

    let hasErrors = false;
    let hasWarnings = false;
    const results: { file: string; valid: boolean; errors: string[]; warnings: string[] }[] = [];

    for (const filePath of files) {
        const absolutePath = path.resolve(filePath);
        const fileName = path.basename(absolutePath);

        if (!fs.existsSync(absolutePath)) {
            results.push({
                file: fileName,
                valid: false,
                errors: [`File not found: ${filePath}`],
                warnings: []
            });
            hasErrors = true;
            continue;
        }

        const content = fs.readFileSync(absolutePath, 'utf-8');
        const fileResult = validateYamlFile(fileName, content);
        results.push(fileResult);

        if (fileResult.errors.length > 0) hasErrors = true;
        if (fileResult.warnings.length > 0) hasWarnings = true;
    }

    spinner.stop();
    console.log('');
    console.log(chalk.cyan.bold('📋 Validation Results:'));
    console.log(chalk.gray('────────────────────────────────────────'));

    for (const result of results) {
        const icon = result.valid ?
            (result.warnings.length > 0 ? chalk.yellow('⚠') : chalk.green('✓')) :
            chalk.red('✗');

        console.log(`  ${icon} ${chalk.white(result.file)}`);

        for (const error of result.errors) {
            console.log(`    ${chalk.red('✗')} ${error}`);
        }

        for (const warning of result.warnings) {
            console.log(`    ${chalk.yellow('⚠')} ${warning}`);
        }
    }

    console.log('');

    if (hasErrors) {
        console.log(chalk.red.bold('❌ Validation failed with errors'));
        process.exit(1);
    } else if (hasWarnings && options.strict) {
        console.log(chalk.yellow.bold('⚠️  Validation failed (strict mode) with warnings'));
        process.exit(1);
    } else if (hasWarnings) {
        console.log(chalk.yellow.bold('⚠️  Validation passed with warnings'));
    } else {
        console.log(chalk.green.bold('✅ All files validated successfully'));
    }
}

function validateYamlFile(fileName: string, content: string): {
    file: string;
    valid: boolean;
    errors: string[];
    warnings: string[]
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
        // Try to parse YAML
        const docs = yaml.loadAll(content);

        if (docs.length === 0) {
            errors.push('Empty YAML file');
            return { file: fileName, valid: false, errors, warnings };
        }

        for (let i = 0; i < docs.length; i++) {
            const doc = docs[i] as Record<string, unknown>;

            if (doc === null || doc === undefined) {
                warnings.push(`Document ${i + 1}: Empty document`);
                continue;
            }

            // Check for Docker Compose
            if (doc.version || doc.services) {
                validateDockerCompose(doc, warnings, i + 1);
            }
            // Check for Kubernetes
            else if (doc.apiVersion && doc.kind) {
                validateKubernetes(doc, errors, warnings, i + 1);
            }
            else {
                warnings.push(`Document ${i + 1}: Unknown format (not Docker Compose or Kubernetes)`);
            }
        }

    } catch (error) {
        errors.push(`YAML syntax error: ${(error as Error).message}`);
        return { file: fileName, valid: false, errors, warnings };
    }

    return {
        file: fileName,
        valid: errors.length === 0,
        errors,
        warnings
    };
}

function validateDockerCompose(doc: Record<string, unknown>, warnings: string[], docNum: number): void {
    const prefix = `Doc ${docNum}:`;

    // Check version
    if (!doc.version && !doc.services) {
        warnings.push(`${prefix} No version or services found`);
    }

    // Check services
    if (doc.services && typeof doc.services === 'object') {
        const services = doc.services as Record<string, unknown>;
        for (const [name, service] of Object.entries(services)) {
            if (typeof service === 'object' && service !== null) {
                const svc = service as Record<string, unknown>;
                if (!svc.image && !svc.build) {
                    warnings.push(`${prefix} Service '${name}' has no image or build`);
                }
            }
        }
    }
}

function validateKubernetes(
    doc: Record<string, unknown>,
    errors: string[],
    warnings: string[],
    docNum: number
): void {
    const prefix = `Doc ${docNum}:`;
    const kind = doc.kind as string;

    // Check metadata
    if (!doc.metadata) {
        errors.push(`${prefix} Missing metadata`);
    } else {
        const metadata = doc.metadata as Record<string, unknown>;
        if (!metadata.name) {
            errors.push(`${prefix} Missing metadata.name`);
        }
    }

    // Check spec for workloads
    const workloadKinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'];
    if (workloadKinds.includes(kind)) {
        if (!doc.spec) {
            errors.push(`${prefix} ${kind} missing spec`);
        } else {
            const spec = doc.spec as Record<string, unknown>;
            if (spec.replicas === 1) {
                warnings.push(`${prefix} ${kind} has only 1 replica`);
            }
        }
    }
}
