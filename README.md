# cs-helper

Metric Insights Custom Script helper

## Install

```shell
npm i --save-dev @metricinsights/cs-helper
```

## Usage

### CLI usage

Add `cs-helper` as package.json script to build you code into a bundle

```json
{
  "name": "package-name",
  "version": "1.0.0",
  "description": "Package description",
  "scripts": {
    "build": "@metricinsights/cs-helper <path-to-index.js>"
  }
}
```

Run command to build your code `npm run build`

#### Build API options

| Option            | Description                                                  | Default                                 |
| ----------------- | ------------------------------------------------------------ | --------------------------------------- |
| `--clean`         | Clean dist folder before build                               | `false`                                 |
| `--v7`            | CS will be compatible only with v7                           | `false`                                 |
| `--readme <path>` | Path to README.md file to include in the built script banner | Auto-detect `README.md` in project root |

### Create new script

Scaffold a new custom script project from a template using `cs-helper`:

```shell
npx -p @metricinsights/cs-helper cs-helper-create [destination]
```

**How it works:**

1. **Destination** — Target folder for the new project. Defaults to the current directory (`.`). The folder must be empty or not exist.

2. **Interactive prompts** — If options are omitted, the CLI prompts for:
   - **Template** — `custom-script-js` or `custom-script-ts`
   - **Package name** — Defaults to the destination folder name
   - **Description** — Package description
   - **Version** — Defaults to `1.0.0`
   - **MI v7** — Whether to target Metric Insights v7 only (not compatible with v6)
   - **AI assistant files** — Multiselect of available tools (e.g. Cursor rules, Claude project file), when the installed package ships **`ai-addons`**. Skipped when stdin is not a TTY unless you pass **`--ai`** (see below).

3. **Template processing** — Files from the chosen template are copied and placeholders are replaced:
   - `%PACKAGE_NAME%` → package name
   - `%PACKAGE_VERSION%` → version
   - `%PACKAGE_DESCRIPTION%` → description
   - `%V7%` → ` --v7` or empty (for build command)
   - `%PLUGIN_VERSION%` → cs-helper version

4. **AI assistant add-ons (optional)** — If you select one or more tools (interactively or via **`--ai`**), files from **`ai-addons/<tool>/`** in the package are copied into the new project **after** the template, with the **same** placeholder substitution. Add-ons are optional; omit them if you do not need editor- or assistant-specific files.

5. **Entry file** — `index.js` or `index.ts` is renamed to `{packageName}.js` or `{packageName}.ts`.

6. **Next steps** — The CLI prints instructions to `cd`, `npm install`, and `npm run build`.

#### Create command options

| Option                     | Description                                        | Default                 |
| -------------------------- | -------------------------------------------------- | ----------------------- |
| `-t, --template <name>`    | Template: `custom-script-js` or `custom-script-ts` | Prompt                  |
| `-n, --name <name>`        | Package name                                       | Destination folder name |
| `-d, --description <text>` | Package description                                | Prompt                  |
| `-v, --version <version>`  | Package version                                    | `1.0.0`                 |
| `--v7`                     | Target MI v7 only (not compatible with v6)         | `false`                 |
| `--ai <tool>`              | Copy files from `ai-addons/<tool>/` (repeatable)   | —                       |

The **`--ai`** option is registered only when the installed package includes an **`ai-addons`** directory. Valid values are listed in **`cs-helper-create --help`** (for example `cursor`, `claude`). In **interactive** mode with a TTY, you get a multiselect if you do not pass **`--ai`**. In **non-interactive** mode (e.g. CI), omit **`--ai`** to skip AI files, or pass one or more **`--ai <tool>`** flags.

**Example (non-interactive):**

```shell
npx -p @metricinsights/cs-helper cs-helper-create -t custom-script-ts -n my-script -d "My custom script" -v 1.0.0 ./my-script
```

**Example with AI assistant files (repeat `--ai` for multiple tools):**

```shell
npx -p @metricinsights/cs-helper cs-helper-create -t custom-script-ts -n my-script -d "My custom script" -v 1.0.0 --ai cursor --ai claude ./my-script
```

### Basic usage

```javascript
import { cs, parseParams } from '@metricinsights/cs-helper';

const parsedParams = parseParams({ defaultValue: 1 });
// Merged object: defaults plus any keys from cs.parameters (runtime wins on conflicts)

setTimeout(() => {
  cs.close();
}, 1000);
```

### `parseParams`

Use **`parseParams(defaultParams?)`** to combine **default values** you define in code with **runtime parameters** from the host (**`cs.parameters`**). Merge order is: start from `defaultParams`, then apply **`cs.parameters`** so values configured for the script in Metric Insights override defaults for the same keys.

The function returns that merged object and also assigns it to **`cs.parsedParams`** (and to the same property on the global object in browser-like environments) so the resolved map is available everywhere without passing it manually.

In **TypeScript**, pass an explicit generic so the build can document your parameters accurately:

```typescript
const params = parseParams<{
  region: string;
  limit: number;
  enabled: boolean;
}>({
  region: 'us',
  limit: 100,
  enabled: true,
});
```

Only **`string`**, **`number`**, and **`boolean`** values are supported for parameter types (MI passes scalar values). At build time, the cs-helper CLI scans `parseParams` usage to generate the **Params Base64** banner block and the parameter tables in the [Build Output](#build-output) section—see **Params Base64** there for what is embedded.

### Backend HTTP requests (`runApiRequest`)

Use **`cs.runApiRequest(url, settings?)`** for Metric Insights backend APIs. The host injects API authentication and provides the transport layer. Build URLs from **`cs.homeSite`** (or **`customScript.homeSite`**) plus the API path—see the **Data convertor** example below.

### Utils usage

#### Log utility

Provides logging utilities with log level support for custom scripts. Logs are only visible if their level is greater than or equal to the current log level.

```javascript
import {
  log,
  setLogLevel,
  getLogLevel,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_WARN,
  LOG_LEVEL_ERROR,
} from '@metricinsights/cs-helper/utils';

// Set the current log level (defaults to INFO/1)
// Only logs with level >= current level will be visible
setLogLevel(LOG_LEVEL_INFO); // or setLogLevel(1) or setLogLevel('info')

// Get current log level
const currentLevel = getLogLevel(); // Returns: 1

// Log messages with different levels
log('Debug information', LOG_LEVEL_DEBUG); // Level 0 - NOT visible (current level is 1)
log('Info message', LOG_LEVEL_INFO); // Level 1 - VISIBLE ✓
log('Warning message', LOG_LEVEL_WARN); // Level 2 - VISIBLE ✓
log('Error occurred', LOG_LEVEL_ERROR); // Level 3 - VISIBLE ✓

// Change log level to show debug messages too
setLogLevel(LOG_LEVEL_DEBUG); // Now level 0
log('Debug information', LOG_LEVEL_DEBUG); // Level 0 - VISIBLE ✓

// Log levels (lower number = more verbose):
// debug (0), info (1), warn (2), error (3), emergency (4), silent (10)
```

#### Data convertor

Contains methods to apply metadata for MI datasets

```javascript
import { cs } from '@metricinsights/cs-helper';
import {
  buildMetadataTransformer,
  applyMetadata,
  transformDataset,
} from '@metricinsights/cs-helper/utils';

async function main() {
  const dataset = await new Promise((resolve, reject) => {
    cs.runApiRequest(
      `${cs.homeSite.replace(/\/?$/, '/')}api/dataset_data?dataset=${1}`,
      Object.assign({}, params, {
        success: resolve,
        error: reject,
      }),
    );
  }); // { data: [{ key1: value1, key2: value2 }], metadata: [{ name: key1, type: 'numeric' }, { name: key2, type: 'text' }] }

  const metadataTransformer = buildMetadataTransformer(dataset.metadata); // { [key1]: (v) => Number(v), [key2]: (v) => String(v) }
  const transformedData = applyMetadata(metadataTransformer, dataset.data); // [{ key1: Number(value1), key2: String(value2) }]

  const transformedResponse = transformedData(dataset); // { data: [{ key1: Number(value1), key2: String(value2) }], metadata: [{ name: key1, type: 'numeric' }, { name: key2, type: 'text' }] }

  cs.log(JSON.stringify(metadataTransformer));
  cs.log(JSON.stringify(transformedData));
  cs.log(JSON.stringify(transformedResponse));

  cs.close();
}

main();
```

## Build Output

The built script includes a banner with metadata:

- **Script source hash**: SHA-256 hash (first 16 hex chars) of the main file and all imported files (relative imports only). This helps verify the source code hasn't changed.
- **Checksum**: SHA-256 hash (first 16 hex chars) of the built output file. To verify the built file hasn't been modified, replace the checksum value with `0000000000000000` in the banner, then hash the file; the result should match the stored checksum.
- **Params Base64**: Base64-encoded JSON containing structured parameter metadata extracted from all `parseParams` calls in your code. This includes parameter names, types, default values, required flags, available values (for enum-like parameters), and descriptions. The encoded data can be decoded to access parameter information programmatically.

All metadata is included automatically in the banner when building your custom script.

### Verifying the Checksum

The checksum ensures the built file hasn't been modified after build. To verify the checksum:

1. **Replace the checksum value** in the banner with `0000000000000000`
2. **Normalize the file content**:
   - Convert tabs to spaces (2 spaces per tab)
   - Normalize line endings to LF (`\n`)
3. **Calculate SHA-256 hash** of the normalized content
4. **Take the first 16 hex characters** of the hash
5. **Compare** with the stored checksum value

#### Verification Methods

**Windows PowerShell:**

```powershell
# Read file and normalize content
$content = Get-Content -Path "dist/script.js" -Raw -Encoding UTF8
# Replace tabs with spaces
$content = $content -replace "`t", "  "
# Normalize line endings to LF
$content = $content -replace "`r`n", "`n" -replace "`r", "`n"
# Replace checksum placeholder
$content = $content -replace "Checksum: [0-9a-f]{16}", "Checksum: 0000000000000000"
# Calculate hash
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
$hashHex = [System.BitConverter]::ToString($hash) -replace "-", ""
$checksum = $hashHex.Substring(0, 16).ToLower()
Write-Host "Calculated checksum: $checksum"
```

**Linux/Mac (bash):**

```bash
# Calculate checksum with normalization pipeline (preserves trailing newlines)
# Detect available SHA-256 command
if command -v sha256sum &> /dev/null; then
  HASH_CMD="sha256sum"
elif command -v shasum &> /dev/null; then
  HASH_CMD="shasum -a 256"
else
  echo "Error: No SHA-256 command found" >&2
  exit 1
fi

checksum=$(
  sed $'s/\t/  /g' dist/script.js \
  | tr -d '\r' \
  | sed 's/Checksum: [0-9a-f]\{16\}/Checksum: 0000000000000000/' \
  | $HASH_CMD \
  | cut -d' ' -f1 \
  | cut -c1-16
)
echo "Calculated checksum: $checksum"
```

**Node.js:**

```javascript
const fs = require('fs');
const crypto = require('crypto');

// Read file
let content = fs.readFileSync('dist/script.js', 'utf-8');

// Normalize: tabs to spaces
content = content.replace(/\t/g, '  ');

// Normalize: line endings to LF
content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// Replace checksum placeholder
content = content.replace(
  /Checksum: [0-9a-f]{16}/,
  'Checksum: 0000000000000000',
);

// Calculate hash
const hash = crypto.createHash('sha256');
hash.update(Buffer.from(content, 'utf-8'));
const checksum = hash.digest('hex').slice(0, 16);

console.log('Calculated checksum:', checksum);
```

**Note:** The checksum calculation normalizes content (tabs to spaces, line endings to LF) to ensure consistent results across different platforms and editors.

### Banner Example

Here's an example of what the banner looks like in the built script:

```
***** DO NOT EDIT! THIS CODE IS GENERATED BY THE PACKAGE @metricinsights/cs-helper (https://github.com/mi-examples/cs-helper) *****

Please, go to code sources and add your changes!

Code sources:
  Package name: my-custom-script
  Package version: 1.0.0
  Package repository: https://github.com/user/my-custom-script
  Build command: npm run build
  Built at: 2026-02-02T12:00:00.000Z
  Script source hash: a1b2c3d4e5f6g7h8
  Checksum: 1a2b3c4d5e6f7g8h

  ***** ----- * PARAMS BASE64 * ----- *****
  eyJpc1BhcmFtZXRlcnNSZXF1aXJlZCI6ZmFsc2UsInBhcmFtZXRlcnMiOlt7Im5hbWUiOiJkZWZhdWx0VmFsdWUiLCJ0eXBlIjoibnVtYmVyIiwicmVxdWlyZWQiOmZhbHNlfV19
  ***** ----- * END PARAMS BASE64 * ----- *****

***** ----- ----- ----- ----- ----- ----- *****
***** PARAMETERS DESCRIPTION *****

parseParams call #1 (src/index.ts:43):

## Params

| Name        | Type   | Required | Default |
|:------------|:------:|:--------:|:-------:|
| defaultValue | number |          |    1    |

### Params description

- **defaultValue**: Example: `1`.

***** ------------------------- *****

***** README.md *****

# My Custom Script

This is my custom script description...

***** --------- *****
```

## Maintainers: publishing to npm

Production releases publish from [`.github/workflows/release.yml`](.github/workflows/release.yml) when a `v*` tag is pushed. Authentication uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC from GitHub Actions), not a long-lived `NPM_TOKEN`.

### One-time setup on npmjs.com

1. Open **@metricinsights/cs-helper** → **Settings** → **Trusted Publisher**.
2. Choose **GitHub Actions** and configure:
   - **Organization or user**: `mi-examples`
   - **Repository**: `cs-helper`
   - **Workflow filename**: `release.yml` (exact name, including `.yml`)
3. After the first successful OIDC publish, consider **Publishing access** → **Require two-factor authentication and disallow tokens**, then revoke the old automation token from npm account settings.

### Requirements

- GitHub-hosted runners (self-hosted runners are not supported for trusted publishing).
- Node.js **24** in the release workflow (npm ≥ 11.5.1 for OIDC).
- `repository.url` in `package.json` must match `https://github.com/mi-examples/cs-helper`.
