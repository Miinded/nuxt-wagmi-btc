import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Dependency policy for a publishable Nuxt module: the framework (nuxt, vue, vue-router) and
// pinia must never be bundled as dependencies — the consuming app provides a single instance.

const packageJsonPath = resolve(process.cwd(), 'package.json');

if (!existsSync(packageJsonPath)) {
  console.error('[deps:check] no package.json found');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const peerOnly = ['nuxt', 'vue', 'vue-router', 'pinia'];
let hasError = false;

for (const name of Object.keys(pkg.dependencies ?? {})) {
  if (peerOnly.includes(name)) {
    console.error(
      `[deps:check] ${pkg.name}: move ${name} from dependencies to peerDependencies for a publishable module`,
    );
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
}

console.log('[deps:check] dependency policy passed');
