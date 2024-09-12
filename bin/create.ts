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

(async function () {
  const { program, Option, Argument } = await import('commander');
  const prompts = (
    (await import('prompts')) as never as { default: typeof import('prompts') }
  ).default;
  const {
    readdirSync,
    existsSync,
    mkdirSync,
    writeFileSync,
    copyFileSync,
    readFileSync,
  } = await import('fs');
  const path = await import('path');
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
        );
      } else if (t.isFile()) {
        const destinationPath = path.resolve(
          destination,
          typeof filenameMiddleware === 'function'
            ? filenameMiddleware(t.name)
            : t.name,
        );

        if (typeof middleware === 'function') {
          const result = middleware(targetFile, destination);

          if (typeof result === 'string' || Buffer.isBuffer(result)) {
            writeFileSync(destinationPath, result);
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

  const templates = readdirSync(templatesDirectory, {
    encoding: 'utf-8',
    withFileTypes: true,
  })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  function dirIsEmpty(path: string): boolean {
    return readdirSync(path).length === 0;
  }

  const cli = program
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
    )
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
      };

      const destinationFolder = path.resolve(process.cwd(), destination);

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

      const replaceMap = {
        '%PACKAGE_NAME%': packageName,
        '%PACKAGE_VERSION%': version,
        '%PACKAGE_DESCRIPTION%': description,
        '%V&%': v7 ? ' --v7' : '',
      };

      const templateDir = path.resolve(templatesDirectory, template);

      copyFilesRecursive(
        templateDir,
        destination,
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

          if (destination.endsWith('src') && testRegExp.test(filename)) {
            return filename.replace(testRegExp, `${packageName}.$1`);
          }

          return filename;
        },
      );

      console.log('Done!');
    });

  cli.parse();
})();
