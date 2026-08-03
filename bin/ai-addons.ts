const pathLib = require('path');
const fs = require('fs');

const MARKER_REGEX = /cs-helper-addon-version:\s*(\d+\.\d+\.\d+(?:-[\w.]+)?)/;

export type AiAddonStatus = 'ok' | 'stale' | 'unknown';

export type AiAddonCheck = {
  name: string;
  file: string;
  status: AiAddonStatus;
  foundVersion?: string;
};

/**
 * Known ai-addons and the single file used both to detect their presence in a scaffolded project and
 * to read back the `cs-helper-addon-version` marker. `signature` guards against unrelated files that
 * happen to share the same path (e.g. a hand-written root `CLAUDE.md` unconnected to cs-helper).
 */
const ADDON_FILES: Record<string, { file: string; signature?: RegExp }> = {
  claude: {
    file: 'CLAUDE.md',
    signature: /@metricinsights\/cs-helper/,
  },
  cursor: {
    file: pathLib.join('.cursor', 'rules', 'metric-insights-custom-script.mdc'),
  },
};

function readAddonFile(projectRoot: string, addonName: string): string | null {
  const entry = ADDON_FILES[addonName];

  if (!entry) {
    return null;
  }

  const filePath = pathLib.join(projectRoot, entry.file);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' });

  if (entry.signature && !entry.signature.test(content)) {
    return null;
  }

  return content;
}

/**
 * Whether the given addon's file is present (and, where applicable, recognizably ours) in the project
 * at `projectRoot`. Used to auto-detect which addons to refresh when `--update-ai` is run without
 * an explicit `--ai` selection.
 */
export function isAiAddonPresent(projectRoot: string, addonName: string): boolean {
  return readAddonFile(projectRoot, addonName) !== null;
}

/**
 * Checks every known ai-addon's file in `projectRoot` against `installedVersion` (the currently
 * running cs-helper's own version). Only returns an entry for addons whose file is actually present;
 * an addon never scaffolded into this project produces no entry (not a warning).
 */
export function checkAiAddonsFreshness(
  projectRoot: string,
  installedVersion: string,
): AiAddonCheck[] {
  const results: AiAddonCheck[] = [];

  for (const [name, entry] of Object.entries(ADDON_FILES)) {
    const content = readAddonFile(projectRoot, name);

    if (content === null) {
      continue;
    }

    const match = content.match(MARKER_REGEX);

    if (!match) {
      results.push({ name, file: entry.file, status: 'unknown' });

      continue;
    }

    const foundVersion = match[1];

    results.push({
      name,
      file: entry.file,
      status: foundVersion === installedVersion ? 'ok' : 'stale',
      foundVersion,
    });
  }

  return results;
}

module.exports = { checkAiAddonsFreshness, isAiAddonPresent };
