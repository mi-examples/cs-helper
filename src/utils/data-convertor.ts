export type TransformerFunc = (v: any) => string | number | Date;
export type Metadata = { name: string; type: 'datetime' | 'numeric' | 'text' };

export function buildMetadataTransformer(metadata: Array<Metadata>) {
  const transformer: { [p: string]: TransformerFunc } = {};

  for (const { name, type } of metadata) {
    switch (type) {
      case 'datetime':
        transformer[name] = (v: any) => {
          const d =
            typeof v === 'string' || typeof v === 'number' ? new Date(v) : null;

          return d && !Number.isNaN(d.valueOf()) ? d : '';
        };

        break;

      case 'numeric':
        transformer[name] = (v: any) => +v;

        break;

      case 'text':
      default:
        transformer[name] = (v: any) => String(v);
    }
  }

  return transformer;
}

export function applyMetadata(
  metadataTransformer: {
    [p: string]: TransformerFunc;
  },
  data: Array<{ [p: string]: string }>,
) {
  return (data as Array<any>).map((item) => {
    for (const key in item) {
      if (
        Object.hasOwn(item, key) &&
        typeof metadataTransformer[key] === 'function'
      ) {
        item[key] = metadataTransformer[key](item[key]);
      }
    }

    return item;
  });
}

export function transformDataset(datasetData: {
  data: Array<{ [p: string]: string }>;
  metadata: Array<Metadata>;
}) {
  const { data, metadata } = datasetData;

  const transformer = buildMetadataTransformer(metadata);
  const preparedData = applyMetadata(transformer, data);

  return { data: preparedData, metadata };
}
