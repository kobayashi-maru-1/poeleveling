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
 * Uses `tauri build` (not plain `cargo build --release`) so that Tauri's CLI
 * sets TAURI_DIST_DIR and other env vars that tauri-codegen needs to properly
 * embed the Vite frontend into the binary. tauri.conf.json has bundle.active:false
 * so no installer is created — we just grab the raw exe and zip it ourselves.
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

// Ensure cargo is on PATH (execSync uses cmd.exe which may not have ~/.cargo/bin)
const cargoBin = join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.cargo', 'bin');
const cargoEnv = { ...process.env, PATH: `${cargoBin};${process.env.PATH ?? ''}` };

// Read product name + version from tauri.conf.json
const conf        = JSON.parse(readFileSync(join(srcTauri, 'tauri.conf.json'), 'utf8'));
const version     = conf.version;
const productName = conf.productName.replace(/\s+/g, '.');

// ── 1+2. Build frontend + Rust binary via `tauri build` ───────────────────────
// tauri build sets TAURI_DIST_DIR so the Vite assets are properly embedded.
// bundle.active:false in tauri.conf.json means no NSIS installer is created.
console.log('1/3  Running tauri build (frontend + Rust)…');
execSync('npm run build', { cwd: root, stdio: 'inherit', env: cargoEnv });

// ── 3. Locate the compiled exe via cargo metadata ────────────────────────────
console.log('\n2/3  Assembling package…');
const meta    = JSON.parse(execSync('cargo metadata --format-version 1 --no-deps', { cwd: srcTauri, env: cargoEnv }).toString());
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

copyFileSync(exePath, join(staging, 'overlay-tauri.exe'));

const routesSrc = join(repoRoot, 'common', 'data', 'routes');
for (const f of readdirSync(routesSrc)) {
  if (f.endsWith('.txt')) {
    copyFileSync(join(routesSrc, f), join(staging, 'common-data', 'routes', f));
  }
}

// Create zip using .NET ZipFile::CreateFromDirectory so paths inside the zip
// are relative to the staging dir (no _staging\ prefix).
const zipName = `${productName}-tauri-win-x64-${version}.zip`;
const zipPath = join(distDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);

const psCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${staging}', '${zipPath}')`;
execSync(`powershell.exe -NoProfile -Command "${psCmd}"`, { stdio: 'inherit' });

rmSync(staging, { recursive: true });

console.log(`\n3/3  Done -> dist-installer/${zipName}`);
