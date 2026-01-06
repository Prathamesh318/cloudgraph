// ============================================
// CloudGraph CLI - Analyze Command
// ============================================

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import yaml from 'js-yaml';
import { parseYaml, detectPlatform } from '../parser';
import { analyze } from '../analyzer';
import type { AnalysisResult } from '../types';

interface AnalyzeOptions {
    output: 'json' | 'table' | 'summary';
    mermaid?: boolean;
    color?: boolean;
    quiet?: boolean;
}

export async function analyzeCommand(files: string[], options: AnalyzeOptions): Promise<void> {
    const spinner = ora('Reading files...').start();

    try {
        // Read files
        const fileInputs = [];
        for (const filePath of files) {
            const absolutePath = path.resolve(filePath);

            if (!fs.existsSync(absolutePath)) {
                spinner.fail(chalk.red(`File not found: ${filePath}`));
                process.exit(1);
            }

            const content = fs.readFileSync(absolutePath, 'utf-8');
            fileInputs.push({
                name: path.basename(absolutePath),
                content
            });
        }

        spinner.text = 'Parsing YAML...';

        // Parse YAML
        const parsed = parseYaml(fileInputs);

        if (parsed.errors.length > 0) {
            spinner.warn(chalk.yellow('Parsing completed with warnings'));
            for (const error of parsed.errors) {
                console.log(chalk.yellow(`  ⚠ ${error}`));
            }
        }

        spinner.text = 'Analyzing dependencies...';

        // Analyze
        const result = analyze(parsed);

        spinner.succeed(chalk.green('Analysis complete!'));
        console.log('');

        // Output based on format
        if (options.output === 'json') {
            console.log(JSON.stringify(result, null, 2));
        } else if (options.output === 'table') {
            printTableOutput(result);
        } else {
            printSummaryOutput(result);
        }

        // Mermaid diagram
        if (options.mermaid) {
            console.log('');
            console.log(chalk.cyan.bold('📊 Mermaid Diagram:'));
            console.log(chalk.gray('────────────────────────────────────────'));
            console.log(result.diagrams.containerView);
        }

    } catch (error) {
        spinner.fail(chalk.red('Analysis failed'));
        console.error(chalk.red((error as Error).message));
        process.exit(1);
    }
}

function printTableOutput(result: AnalysisResult): void {
    // Resources Table
    console.log(chalk.cyan.bold('📦 Resources:'));

    const resourceTable = new Table({
        head: [
            chalk.white.bold('Name'),
            chalk.white.bold('Type'),
            chalk.white.bold('Platform'),
            chalk.white.bold('File')
        ],
        style: { head: [], border: ['gray'] }
    });

    for (const resource of result.summary.resources) {
        resourceTable.push([
            chalk.white(resource.name),
            getResourceBadge(resource.kind),
            resource.platform === 'docker-compose' ? chalk.blue('Docker') : chalk.magenta('K8s'),
            chalk.gray(resource.sourceFile || '-')
        ]);
    }

    console.log(resourceTable.toString());
    console.log('');

    // Dependencies Table
    console.log(chalk.cyan.bold('🔗 Dependencies:'));

    const depTable = new Table({
        head: [
            chalk.white.bold('From'),
            chalk.white.bold('To'),
            chalk.white.bold('Type'),
            chalk.white.bold('Inferred')
        ],
        style: { head: [], border: ['gray'] }
    });

    const nodeMap = new Map(result.graph.nodes.map(n => [n.id, n.label]));

    for (const edge of result.graph.edges) {
        depTable.push([
            chalk.white(nodeMap.get(edge.source) || edge.source),
            chalk.white(nodeMap.get(edge.target) || edge.target),
            getDependencyBadge(edge.type),
            edge.isInferred ? chalk.yellow('Yes') : chalk.gray('No')
        ]);
    }

    console.log(depTable.toString());
    console.log('');

    // Risks
    if (result.risks.length > 0) {
        console.log(chalk.yellow.bold(`⚠️  Risks Found: ${result.risks.length}`));
        for (const risk of result.risks) {
            const icon = risk.severity === 'critical' ? '🔴' :
                risk.severity === 'high' ? '🟠' :
                    risk.severity === 'medium' ? '🟡' : '🟢';
            console.log(`  ${icon} ${risk.title}`);
        }
    } else {
        console.log(chalk.green.bold('✅ No risks detected'));
    }
}

function printSummaryOutput(result: AnalysisResult): void {
    console.log(chalk.cyan.bold('📊 Summary:'));
    console.log(chalk.gray('────────────────────────────────────────'));
    console.log(`  ${chalk.white('Total Resources:')} ${chalk.cyan(result.summary.totalResources)}`);
    console.log(`  ${chalk.white('Dependencies:')} ${chalk.cyan(result.graph.metadata.totalEdges)}`);
    console.log(`  ${chalk.white('Risks:')} ${result.risks.length > 0 ? chalk.yellow(result.risks.length) : chalk.green('0')}`);
    console.log('');

    console.log(chalk.white('  By Type:'));
    for (const [kind, count] of Object.entries(result.summary.byKind)) {
        console.log(`    ${getResourceBadge(kind)} ${count}`);
    }
}

function getResourceBadge(kind: string): string {
    const colors: Record<string, (s: string) => string> = {
        Deployment: chalk.blue,
        Service: chalk.cyan,
        Ingress: chalk.magenta,
        ConfigMap: chalk.yellow,
        Secret: chalk.red,
        Container: chalk.green,
        Volume: chalk.gray,
        Network: chalk.blueBright,
    };
    const colorFn = colors[kind] || chalk.white;
    return colorFn(kind);
}

function getDependencyBadge(type: string): string {
    const colors: Record<string, (s: string) => string> = {
        network: chalk.blue,
        startup: chalk.yellow,
        runtime: chalk.green,
        config: chalk.cyan,
        secret: chalk.red,
        storage: chalk.magenta,
    };
    const colorFn = colors[type] || chalk.gray;
    return colorFn(type);
}
