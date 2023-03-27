# cs-helper

Metric Insights Custom Script helper

## Install

```shell
npm i --save-dev cs-helper
```

## Usage

### CLI usage

Add `cs-helper` as package.json script to build you code into bundle

```json
{
  "name": "package-name",
  "version": "1.0.0",
  "description": "Package description",
  "scripts": {
    "build": "cs-helper <path-to-index.js>"
  }
}
```

Run command to build your code `npm run build`

### Basic usage

```javascript
import { cs, parseParams } from 'cs-helper';

const parsedParams = parseParams({ defaultValue: 1 }); // { defaultValue: 1 } & cs.params

setTimeout(() => {
  cs.close();
}, 1000);
```

### Utils usage

#### Data convertor

Contains methods to apply metadata for MI datasets

```javascript
import { cs } from 'cs-helper';
import {
  buildMetadataTransformer,
  applyMetadata,
  transformDataset,
} from 'cs-helper/dist/utils';

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
