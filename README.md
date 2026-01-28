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

#### API options

| Option           | Description                                                      | Default |
|------------------|------------------------------------------------------------------|---------|
| `--clean`        | Clean dist folder before build                                  | `false` |
| `--v7`           | CS will be compatible only with v7                              | `false` |
| `--readme <path>` | Path to README.md file to include in the built script banner    | Auto-detect `README.md` in project root |

### Basic usage

```javascript
import { cs, parseParams } from '@metricinsights/cs-helper';

const parsedParams = parseParams({ defaultValue: 1 }); // { defaultValue: 1 } & cs.params

setTimeout(() => {
  cs.close();
}, 1000);
```

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
log('Info message', LOG_LEVEL_INFO);        // Level 1 - VISIBLE ✓
log('Warning message', LOG_LEVEL_WARN);     // Level 2 - VISIBLE ✓
log('Error occurred', LOG_LEVEL_ERROR);     // Level 3 - VISIBLE ✓

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
      `/api/dataset_data?dataset=${1}`,
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

Both hashes are included automatically in the banner when building your custom script.
```
