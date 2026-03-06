#!/usr/bin/env node
/**
 * Builds a portable zip of the Tauri overlay.
 * Output: dist-installer/PoE.Leveling.Overlay-tauri-win-x64-<version>.zip
 *   overlay-tauri.exe
 *
 * Game data (routes, skill trees, JSON) is fetched from GitHub at runtime,
 * so nothing extra needs to be bundled with the exe.
 */

import { execSync }                                           from 'child_process';
import { mkdirSync, copyFileSync, rmSync,
         existsSync, readFileSync }                          from 'fs';
import { join, dirname, resolve }                            from 'path';
import { fileURLToPath }                                     from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const root       = resolve(__dirname, '..');
const srcTauri   = join(root, 'src-tauri');

// Ensure cargo is on PATH (execSync uses cmd.exe which may not have ~/.cargo/bin)
const cargoBin = join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.cargo', 'bin');
const cargoEnv = { ...process.env, PATH: `${cargoBin};${process.env.PATH ?? ''}` };

// Read product name + version from tauri.conf.json
const conf        = JSON.parse(readFileSync(join(srcTauri, 'tauri.conf.json'), 'utf8'));
const version     = conf.version;
const productName = conf.productName.replace(/\s+/g, '.');

// 1. Build frontend + Rust binary via `tauri build`
console.log('1/3  Running tauri build (frontend + Rust)...');
execSync('npm run build', { cwd: root, stdio: 'inherit', env: cargoEnv });

// 2. Locate the compiled exe via cargo metadata
console.log('\n2/3  Assembling package...');
const meta    = JSON.parse(execSync('cargo metadata --format-version 1 --no-deps', { cwd: srcTauri, env: cargoEnv }).toString());
const exePath = join(meta.target_directory, 'release', 'overlay-tauri.exe');

if (!existsSync(exePath)) {
  console.error(`ERROR: binary not found at ${exePath}`);
  process.exit(1);
}

// 3. Stage the exe and zip it
const distDir = join(root, 'dist-installer');
const staging = join(distDir, '_staging');

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

copyFileSync(exePath, join(staging, 'overlay-tauri.exe'));

const zipName = `${productName}-tauri-win-x64-${version}.zip`;
const zipPath = join(distDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);

const psCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${staging}', '${zipPath}')`;
execSync(`powershell.exe -NoProfile -Command "${psCmd}"`, { stdio: 'inherit' });

rmSync(staging, { recursive: true });

console.log(`\n3/3  Done -> dist-installer/${zipName}`);
