#!/usr/bin/env node

type SanityCheckFinding = import('./sanity-check').SanityCheckFinding;

function printTextReport(findings: SanityCheckFinding[], chalk: any) {
  if (findings.length === 0) {
    console.log(chalk.green('No sanity-check issues found.'));

    return;
  }

  const byFile = new Map<string, SanityCheckFinding[]>();

  for (const finding of findings) {
    const list = byFile.get(finding.file) ?? [];

    list.push(finding);
    byFile.set(finding.file, list);
  }

  const colorFor = (severity: string) =>
    severity === 'error' ? chalk.red : severity === 'warning' ? chalk.yellow : chalk.cyan;

  for (const [file, fileFindings] of byFile) {
    console.log(chalk.bold(file));

    for (const finding of fileFindings) {
      const location = finding.line ? `:${finding.line}` : '';

      console.log(
        `  ${colorFor(finding.severity)(`[${finding.severity}]`)} ${finding.ruleId}${location} — ${finding.message}`,
      );
    }
  }

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  console.log('');
  console.log(chalk.bold(`${errorCount} error(s), ${warningCount} warning(s), ${infoCount} info`));
}

(async function () {
  // @ts-ignore
  const { program, Option, Argument } = await import('commander');
  const path = require('path');
  const fs = require('fs');
  const chalk = require('chalk').default ?? require('chalk');
  const sanityCheck = require('./sanity-check') as typeof import('./sanity-check');

  program
    .addOption(new Option('--v7', 'Check assuming a v7 (Puppeteer/Chromium) build target'))
    .addOption(
      new Option('--format <format>', 'Output format').choices(['text', 'json']).default('text'),
    )
    .addArgument(new Argument('<entry>', 'Custom script entry file'))
    .showHelpAfterError(true)
    .action(async function (this: import('commander').Command) {
      const [entry] = this.args;
      const opts = this.opts() as { v7?: boolean; format: 'text' | 'json' };

      const entryPath = path.resolve(process.cwd(), entry);

      if (!fs.existsSync(entryPath)) {
        console.error(chalk.red(`Entry file not found: ${entryPath}`));
        process.exitCode = 1;

        return;
      }

      let v7 = !!opts.v7;

      if (!opts.v7) {
        // Same %V7% inference bin/create.ts's --update-ai flow uses: infer the target from the
        // consumer's own build script rather than requiring an explicit --v7 every time.
        const pkgJsonPath = path.resolve(process.cwd(), 'package.json');

        if (fs.existsSync(pkgJsonPath)) {
          try {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, { encoding: 'utf-8', flag: 'r' }));

            v7 = (pkgJson.scripts?.build ?? '').includes('--v7');
          } catch {
            //
          }
        }
      }

      const findings = sanityCheck.runSanityChecks(entryPath, {
        v7,
        projectRoot: process.cwd(),
      });

      if (opts.format === 'json') {
        console.log(JSON.stringify(findings, null, 2));
      } else {
        printTextReport(findings, chalk);
      }

      process.exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0;
    });

  program.parse();
})();
