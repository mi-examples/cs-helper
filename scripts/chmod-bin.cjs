'use strict';

const fs = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  process.exit(0);
}

const binDir = path.join(__dirname, '..', 'dist', 'bin');
const mode = 0o755;

for (const name of ['build.js', 'create.js']) {
  const filePath = path.join(binDir, name);

  if (fs.existsSync(filePath)) {
    fs.chmodSync(filePath, mode);
  }
}
