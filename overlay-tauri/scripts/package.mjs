#!/usr/bin/env node
/**
 * Builds a portable zip of the Tauri overlay — equivalent to
 * the Electron version's `npm run package`.
 *
 * Run from the overlay-tauri/ directory:
 *   npm run package
 *
 * Output: dist-installer/PoE.Leveling.Overlay-tauri-win-x64-<version>.zip
 *   overlay-tauri.exe
 *   common-data/routes/act-1.txt … act-10.txt
 *
 * Requirements: cargo in PATH, Node.js 18+, Windows 10+ (uses built-in tar.exe)
 */

import { execSync }                                           from 'child_process';
import { mkdirSync, copyFileSync, readdirSync, rmSync,
         existsSync, readFileSync }                          from 'fs';
import { join, dirname, resolve }                            from 'path';
import { fileURLToPath }                                     from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const root       = resolve(__dirname, '..');          // overlay-tauri/
const srcTauri   = join(root, 'src-tauri');
const repoRoot   = resolve(root, '..');               // poeleveling-Github/

// Read product name + version from tauri.conf.json
const conf        = JSON.parse(readFileSync(join(srcTauri, 'tauri.conf.json'), 'utf8'));
const version     = conf.version;
const productName = conf.productName.replace(/\s+/g, '.');

// ── 1. Build the Vite frontend ────────────────────────────────────────────────
console.log('1/4  Building frontend…');
execSync('npm run vite-build', { cwd: root, stdio: 'inherit' });

// ── 2. Build the Rust binary (release) ───────────────────────────────────────
console.log('\n2/4  Building Rust binary…');
execSync('cargo build --release', { cwd: srcTauri, stdio: 'inherit' });

// ── 3. Locate the compiled exe via cargo metadata ────────────────────────────
console.log('\n3/4  Assembling package…');
const meta    = JSON.parse(execSync('cargo metadata --format-version 1 --no-deps', { cwd: srcTauri }).toString());
const exePath = join(meta.target_directory, 'release', 'overlay-tauri.exe');

if (!existsSync(exePath)) {
  console.error(`ERROR: binary not found at ${exePath}`);
  process.exit(1);
}

// ── 4. Stage files and zip ────────────────────────────────────────────────────
const distDir = join(root, 'dist-installer');
const staging = join(distDir, '_staging');

rmSync(staging, { recursive: true, force: true });
mkdirSync(join(staging, 'common-data', 'routes'), { recursive: true });

// Copy the exe
copyFileSync(exePath, join(staging, 'overlay-tauri.exe'));

// Copy route files (bundled as resources in release builds)
const routesSrc = join(repoRoot, 'common', 'data', 'routes');
for (const f of readdirSync(routesSrc)) {
  if (f.endsWith('.txt')) {
    copyFileSync(join(routesSrc, f), join(staging, 'common-data', 'routes', f));
  }
}

// Create the zip using Windows' built-in tar.exe (-a = auto-format from extension)
const zipName = `${productName}-tauri-win-x64-${version}.zip`;
const zipPath = join(distDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);
execSync(`tar -a -c -f "${zipPath}" -C "${staging}" .`, { stdio: 'inherit' });

rmSync(staging, { recursive: true });

console.log(`\n4/4  Done → dist-installer/${zipName}`);
