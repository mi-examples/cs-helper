/**
 * `bin/build.ts` rewrites this import to `./index-v6` or `./index-v7` when bundling.
 * This file exists so `tsc` can typecheck `index.ts` without that replacement.
 */
import './index-v6';
