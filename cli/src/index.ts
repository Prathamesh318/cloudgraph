#!/usr/bin/env node
// ============================================
// CloudGraph CLI - Main Entry Point
// ============================================

import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeCommand } from './commands/analyze';
import { validateCommand } from './commands/validate';
import { version } from '../package.json';

const program = new Command();

// ASCII Banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('☁️  CloudGraph CLI')}                            ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('Container Orchestration Dependency Analyzer')}  ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════╝')}
`;

program
    .name('cloudgraph')
    .description('Analyze Docker Compose and Kubernetes configurations')
    .version(version)
    .hook('preAction', () => {
        console.log(banner);
    });

// Analyze command
program
    .command('analyze <files...>')
    .description('Analyze YAML configuration files')
    .option('-o, --output <format>', 'Output format: json, table, summary', 'table')
    .option('-m, --mermaid', 'Generate Mermaid diagram')
    .option('--no-color', 'Disable colored output')
    .option('-q, --quiet', 'Minimal output')
    .action(analyzeCommand);

// Validate command
program
    .command('validate <files...>')
    .description('Validate YAML files without full analysis')
    .option('--strict', 'Fail on warnings')
    .action(validateCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
