import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '..', '_locales');
const destinationDir = path.join(__dirname, '..', '.output', 'chrome-mv3', '_locales');

function copyDirSync(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  fs.readdirSync(source, { withFileTypes: true }).forEach(entry => {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    entry.isDirectory()
      ? copyDirSync(sourcePath, destinationPath)
      : fs.copyFileSync(sourcePath, destinationPath);
  });
}

try {
  copyDirSync(sourceDir, destinationDir);
} catch (error) {
  process.exit(1);
}