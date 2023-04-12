#!/usr/bin/env node

const path = require('path');
const { rmSync, readFileSync, readdirSync } = require('fs');

type Webpack = typeof import('webpack');
type Stats = import('webpack').Stats;

async function main() {
  const { default: webpack } = (await import('webpack')) as unknown as {
    default: Webpack;
  };
  const { default: chalk } = await import('chalk');

  if (!process.argv[2]) {
    throw new Error(chalk.red("Main filename can't be undefined"));
  }

  const DIST_DIR = path.resolve(process.cwd(), 'dist');

  const filename = path.resolve('.', process.argv[2]);

  try {
    rmSync(DIST_DIR, { recursive: true, force: true });
  } catch {
    //
  }

  const helperPackage = require(path.resolve(
    __dirname,
    '..',
    '..',
    'package.json',
  ));

  const packageFile: {
    [p: string]: any;
  } = require(path.resolve(process.cwd(), 'package.json'));
  const packageDir = readdirSync(process.cwd(), {
    encoding: 'utf-8',
    flag: 'r',
  });

  const compiler = webpack({
    plugins: [
      new webpack.BannerPlugin({
        banner: function () {
          const { repository, name, version } = packageFile;

          let readme!: string;

          if (packageDir.length) {
            const regExp = /^readme\.md$/i;

            for (const object of packageDir) {
              if (regExp.test(object)) {
                readme = readFileSync(object, { encoding: 'utf-8', flag: 'r' });

                break;
              }
            }
          }

          if (!repository) {
            console.warn(
              chalk.yellow(
                'Please define "repository" field in you package.json file',
              ),
            );
          }

          let helperRepository = '';

          if (typeof helperPackage.repository === 'string') {
            helperRepository = helperPackage.repository;
          } else if (typeof helperPackage.repository === 'object') {
            helperRepository = helperPackage.repository.url?.slice(
              helperPackage.repository.url?.indexOf('http'),
            );
          }

          return `***** DO NOT EDIT! THIS CODE IS GENERATED BY THE PACKAGE ${
            helperPackage.name
          } (${helperRepository}) *****

Please, go to code sources and add your changes!

Code sources:
  Package name: ${name}
  Package version: ${version}
  Package repository: ${repository ? repository : 'Not defined'}
  Build command: npm run ${process.env.npm_lifecycle_event}
  
***** ----- ----- ----- ----- ----- ----- *****
${readme ? `\n***** README.md *****\n\n${readme}\n***** --------- *****` : ''}`;
        },
      }),
    ],
    optimization: { minimize: false },
    target: ['web', 'es5'],
    entry: filename,
    output: { path: DIST_DIR },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
  });

  await new Promise<{ err?: Error | null; stats?: Stats }>((resolve) => {
    compiler.run((err, stats) => resolve({ err, stats }));
  }).then(({ err, stats }) => {
    if (err || stats?.hasErrors()) {
      console.error(err || stats);

      console.log(chalk.red('Code compiled with error'));
    }
  });

  console.log(chalk.green('Done'));
}

main();
