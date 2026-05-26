import { parseParams } from '../src/index';

export interface ScriptParams {
  pageId: string;
  scriptTimeout?: number;
  excludedReportNamesDatasetId?: number;
  minItemsCount?: number;
  minPairDice?: number;
  requiredNum: number;
}

parseParams<ScriptParams>({
  pageId: '',
  requiredNum: 1,
  scriptTimeout: 600000,
  minItemsCount: 8,
  minPairDice: 0.15,
});
