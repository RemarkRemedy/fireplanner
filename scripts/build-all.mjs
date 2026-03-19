/**
 * Build script that builds both the React SPA and the Astro blog,
 * then merges the blog output into the SPA's dist directory.
 *
 * Usage: node scripts/build-all.mjs
 *
 * Build order:
 * 1. Build React SPA (frontend/) → frontend/dist/
 * 2. Build Astro blog (blog/) → frontend/dist/blog/
 *
 * The Astro config already has outDir set to '../frontend/dist/blog',
 * so Astro writes directly into the right place.
 */

import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function run(cmd, cwd) {
  console.log(`\n> ${cmd} (in ${cwd})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

try {
  // Step 1: Build the React SPA
  console.log('\n=== Building React SPA ===');
  run('npm run build', join(root, 'frontend'));

  // Step 2: Build the Astro blog (outputs to frontend/dist/blog/)
  console.log('\n=== Building Astro Blog ===');
  run('npm run build', join(root, 'blog'));

  console.log('\n=== Build complete ===');
  console.log('Output: frontend/dist/ (SPA + blog)');
  console.log('Deploy: wrangler pages deploy frontend/dist --project-name=fireplanner');
} catch (error) {
  console.error('\nBuild failed:', error.message);
  process.exit(1);
}
