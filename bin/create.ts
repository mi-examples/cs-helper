#!/usr/bin/env node

type Command = import('commander').Command;

function onCancel() {
  console.log('Terminating...');

  return process.exit(1);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function escapeQuotes(string: string): string {
  return string.replace(/['"`]/g, '\\$&');
}

function getVarRegExp(varName: string, withQuotes: boolean = false) {
  if (withQuotes) {
    return new RegExp(`(["'\`])(${escapeRegExp(varName)})(\\1)`, 'g');
  }

  return new RegExp(escapeRegExp(varName), 'g');
}

function replaceTemplateVar(
  template: string,
  templateVar: { name: string; value: string },
): string {
  const { name, value } = templateVar;

  return template
    .replace(getVarRegExp(name, true), `$1${escapeQuotes(value)}$1`)
    .replace(getVarRegExp(name), value);
}

const aiAddonsUtil = require('./ai-addons') as typeof import('./ai-addons');

(async function () {
  // @ts-ignore
  const { program, Option, Argument } = await import('commander');
  const promptsModule = await import('prompts');
  const prompts = (
    'default' in promptsModule && typeof promptsModule.default === 'function'
      ? promptsModule.default
      : promptsModule
  ) as typeof import('prompts');
  const {
    readdirSync,
    existsSync,
    mkdirSync,
    writeFileSync,
    copyFileSync,
    readFileSync,
  } = await import('fs');
  // @ts-ignore
  const path = await import('path');
  // @ts-ignore
  const { isBinaryFileSync } = await import('isbinaryfile');

  function copyFilesRecursive(
    target: string,
    destination: string,
    middleware?: (
      filepath: string,
      destination: string,
    ) => string | Buffer | boolean,
    filenameMiddleware?: (filename: string, destination: string) => string,
  ) {
    if (!existsSync(destination)) {
      mkdirSync(destination, { recursive: true });
    }

    const readDir = readdirSync(target, { withFileTypes: true });

    for (const t of readDir) {
      const targetFile = path.resolve(target, t.name);

      if (t.isDirectory()) {
        copyFilesRecursive(
          targetFile,
          path.resolve(destination, t.name),
          middleware,
          filenameMiddleware,
        );
      } else if (t.isFile()) {
        const destinationPath = path.resolve(
          destination,
          typeof filenameMiddleware === 'function'
            ? filenameMiddleware(t.name, destination)
            : t.name,
        );

        if (typeof middleware === 'function') {
          const result = middleware(targetFile, destination);

          if (typeof result === 'string' || Buffer.isBuffer(result)) {
            writeFileSync(destinationPath, result as string | Uint8Array);
          } else if (result !== false) {
            copyFileSync(targetFile, destinationPath);
          }
        } else {
          copyFileSync(targetFile, destinationPath);
        }
      }
    }
  }

  const templatesDirectory = path.resolve(__dirname, '..', '..', 'templates');
  const aiAddonsDirectory = path.resolve(__dirname, '..', '..', 'ai-addons');
  const pluginPackageJson = JSON.parse(
    readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), {
      encoding: 'utf-8',
      flag: 'r',
    }),
  );

  const templates = readdirSync(templatesDirectory, {
    encoding: 'utf-8',
    withFileTypes: true,
  })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const aiAddons = existsSync(aiAddonsDirectory)
    ? readdirSync(aiAddonsDirectory, {
        encoding: 'utf-8',
        withFileTypes: true,
      })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
    : [];

  function dirIsEmpty(path: string): boolean {
    return readdirSync(path).length === 0;
  }

  program
    .addOption(
      new Option('-t, --template <template>', 'Template name').choices(
        templates,
      ),
    )
    .addOption(new Option('-n, --name <package-name>', 'Package name'))
    .addOption(
      new Option('-d, --description <description>', 'Package description'),
    )
    .addOption(new Option('-v, --version <version>', 'Package version'))
    .addOption(
      new Option(
        '--v7, --version-7',
        'Create custom script for MI v7 (not compatible with v6)',
      ),
    );

  if (aiAddons.length > 0) {
    program.addOption(
      new Option(
        '--ai <tool>',
        'Include AI assistant files from ai-addons (repeatable). With --update-ai, selects which tools to refresh',
      )
        .choices(aiAddons)
        .argParser((value: string, previous: string[] | undefined) => [
          ...(previous ?? []),
          value,
        ]),
    );

    program.addOption(
      new Option(
        '--update-ai',
        'Refresh AI assistant files (ai-addons/<tool>/) in an existing project instead of scaffolding a new one',
      ),
    );
  }

  program
    .addArgument(
      new Argument('[destination]', 'Custom script folder destination').default(
        '.',
        'Current directory',
      ),
    )
    .showHelpAfterError(true)
    .action(async function (this: Command) {
      const [destination] = this.args;
      const opts = this.opts() as {
        template?: string;
        name?: string;
        description?: string;
        version?: string;
        v7?: boolean;
        ai?: string[];
        updateAi?: boolean;
      };

      const destinationFolder = path.resolve(process.cwd(), destination);

      const copyAiAddonFiles = (
        addonName: string,
        replaceMap: Record<string, string>,
      ) => {
        const addonDir = path.resolve(aiAddonsDirectory, addonName);

        if (!existsSync(addonDir)) {
          return;
        }

        copyFilesRecursive(addonDir, destinationFolder, (filepath) => {
          if (isBinaryFileSync(filepath)) {
            return true;
          }

          let fileContent = readFileSync(filepath, {
            encoding: 'utf-8',
            flag: 'r',
          });

          for (const [name, value] of Object.entries(replaceMap)) {
            fileContent = replaceTemplateVar(fileContent, { name, value });
          }

          return fileContent;
        });
      };

      if (opts.updateAi) {
        const destPackageJsonPath = path.resolve(
          destinationFolder,
          'package.json',
        );

        if (!existsSync(destPackageJsonPath)) {
          throw new Error(
            `--update-ai must be run inside an existing project. No package.json found at "${destPackageJsonPath}"`,
          );
        }

        const destPackageJson = JSON.parse(
          readFileSync(destPackageJsonPath, { encoding: 'utf-8', flag: 'r' }),
        );

        const buildScript: string = destPackageJson.scripts?.build ?? '';

        const replaceMap = {
          '%PACKAGE_NAME%':
            destPackageJson.name ?? path.basename(destinationFolder),
          '%PACKAGE_VERSION%': destPackageJson.version ?? '1.0.0',
          '%PACKAGE_DESCRIPTION%': destPackageJson.description ?? '',
          '%V7%': buildScript.includes('--v7') ? ' --v7' : '',
          '%PLUGIN_VERSION%': pluginPackageJson.version,
        };

        let updateAddons: string[];

        if (opts.ai !== undefined) {
          updateAddons = [...new Set(opts.ai)].filter((name) =>
            aiAddons.includes(name),
          );
        } else {
          updateAddons = aiAddons.filter((name) =>
            aiAddonsUtil.isAiAddonPresent(destinationFolder, name),
          );

          if (updateAddons.length === 0 && process.stdin.isTTY) {
            updateAddons =
              (
                (await prompts(
                  {
                    name: 'value',
                    type: 'multiselect',
                    message: 'Select AI assistant files to update:',
                    choices: aiAddons.map((name) => ({
                      title: name,
                      value: name,
                    })),
                    hint: '- Space to select. Enter to confirm',
                  },
                  { onCancel },
                )) as { value?: string[] }
              ).value ?? [];
          }
        }

        if (updateAddons.length === 0) {
          throw new Error(
            'No AI assistant files found to update. Pass --ai <tool> to specify which to refresh.',
          );
        }

        for (const addonName of updateAddons) {
          copyAiAddonFiles(addonName, replaceMap);
        }

        console.log(`AI assistant files updated: ${updateAddons.join(', ')}`);

        return;
      }

      if (existsSync(destinationFolder) && !dirIsEmpty(destinationFolder)) {
        throw new Error(
          `Destination directory must be empty. "${destinationFolder}" is not empty`,
        );
      }

      const template =
        opts.template ||
        (
          await prompts(
            {
              name: 'value',
              type: 'select',
              message: `template:`,
              choices: templates.map((value) => {
                return { value, title: value };
              }),
            },
            { onCancel },
          )
        ).value;

      const packageName =
        opts.name ||
        ((
          await prompts(
            {
              name: 'value',
              type: 'text',
              message: `package-name:`,
              initial: path.basename(destinationFolder),
            },
            { onCancel },
          )
        ).value as string);

      const description =
        opts.description ||
        ((
          await prompts(
            {
              name: 'value',
              type: 'text',
              message: `description:`,
              initial: '',
            },
            { onCancel },
          )
        ).value as string);

      const version =
        opts.version ||
        ((
          await prompts(
            {
              name: 'value',
              type: 'text',
              message: `version:`,
              initial: '1.0.0',
            },
            { onCancel },
          )
        ).value as string);

      const v7 =
        opts.v7 ||
        ((
          await prompts(
            {
              name: 'value',
              type: 'confirm',
              message: `Do you want to create a custom script for MI v7 (not compatible with v6)?`,
              initial: false,
            },
            { onCancel },
          )
        ).value as boolean);

      let selectedAiAddons: string[];

      if (aiAddons.length === 0) {
        selectedAiAddons = [];
      } else if (opts.ai !== undefined) {
        selectedAiAddons = [...new Set(opts.ai)];
      } else if (process.stdin.isTTY) {
        selectedAiAddons =
          (
            (await prompts(
              {
                name: 'value',
                type: 'multiselect',
                message: 'Include AI assistant files:',
                choices: aiAddons.map((name) => ({
                  title: name,
                  value: name,
                })),
                hint: '- Space to select. Enter to confirm',
              },
              { onCancel },
            )) as { value?: string[] }
          ).value ?? [];
      } else {
        selectedAiAddons = [];
      }

      selectedAiAddons = selectedAiAddons.filter((name) =>
        aiAddons.includes(name),
      );

      const replaceMap = {
        '%PACKAGE_NAME%': packageName,
        '%PACKAGE_VERSION%': version,
        '%PACKAGE_DESCRIPTION%': description,
        '%V7%': v7 ? ' --v7' : '',
        '%PLUGIN_VERSION%': pluginPackageJson.version,
      };

      const templateDir = path.resolve(templatesDirectory, template);

      copyFilesRecursive(
        templateDir,
        destinationFolder,
        (filepath) => {
          if (isBinaryFileSync(filepath)) {
            return true;
          }

          let fileContent = readFileSync(filepath, {
            encoding: 'utf-8',
            flag: 'r',
          });

          for (const [name, value] of Object.entries(replaceMap)) {
            fileContent = replaceTemplateVar(fileContent, { name, value });
          }

          return fileContent;
        },
        (filename, destination) => {
          const testRegExp = new RegExp(/index.([jt]s)$/, 'i');

          if (testRegExp.test(filename)) {
            return filename.replace(testRegExp, `${packageName}.$1`);
          }

          return filename;
        },
      );

      for (const addonName of selectedAiAddons) {
        copyAiAddonFiles(addonName, replaceMap);
      }

      console.log('Done!');

      console.log(
        `\nTo start working on your custom script, run the following commands:\n`,
      );
      console.log(`cd ${destinationFolder}`);
      console.log(`npm install`);
      console.log(`npm run build`);
    });

  program.parse();
})();
