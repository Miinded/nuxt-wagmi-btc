import { promises as fs } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

(async () => {
  try {
    const srcDir = resolve(__dirname, '../src/assets');
    const destDir = resolve(__dirname, '../dist/assets');

    // Crée le dossier cible si nécessaire
    await fs.mkdir(destDir, { recursive: true });

    // Copie tous les fichiers et dossiers du dossier source
    const files = await fs.readdir(srcDir);
    for (const file of files) {
      const srcFile = join(srcDir, file);
      const destFile = join(destDir, file);
      await fs.copyFile(srcFile, destFile);
      console.log(`Copied: ${srcFile} -> ${destFile}`);
    }

    console.log('Assets copied successfully!');
  } catch (error) {
    console.error('Error copying assets:', error);
    process.exit(1);
  }
})();
