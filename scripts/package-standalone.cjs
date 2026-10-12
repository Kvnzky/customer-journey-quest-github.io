// Standalone Desktop Packager for Customer Journey Quest
// Bundles self-contained offline Windows application folders for Game and Admin Portal.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ELECTRON_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist');
const RELEASE_DIR = path.join(ROOT, 'release');

if (!fs.existsSync(ELECTRON_DIST)) {
  console.error('Error: Electron binaries not found at', ELECTRON_DIST);
  console.error('Run: node node_modules/electron/install.js');
  process.exit(1);
}

// Ensure release directory exists
fs.mkdirSync(RELEASE_DIR, { recursive: true });

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function buildStandalonePackage({ appName, exeName, mainScript, isGame }) {
  console.log(`\n======================================================`);
  console.log(` Packaging Standalone: ${appName}`);
  console.log(`======================================================`);

  const appOutputDir = path.join(RELEASE_DIR, appName);
  const targetExe = path.join(appOutputDir, `${exeName}.exe`);

  if (!fs.existsSync(targetExe)) {
    if (fs.existsSync(appOutputDir)) {
      try {
        fs.rmSync(appOutputDir, { recursive: true, force: true });
      } catch (e) {
        console.warn('Warning: Could not remove directory completely:', e.message);
      }
    }
    fs.mkdirSync(appOutputDir, { recursive: true });

    // 1. Copy Electron Runtime
    console.log('Copying standalone Electron runtime...');
    copyRecursiveSync(ELECTRON_DIST, appOutputDir);

    // Remove default_app.asar so Electron loads resources/app
    const defaultAsar = path.join(appOutputDir, 'resources', 'default_app.asar');
    if (fs.existsSync(defaultAsar)) {
      fs.unlinkSync(defaultAsar);
    }

    // 2. Rename electron.exe to branded executable
    const origExe = path.join(appOutputDir, 'electron.exe');
    if (fs.existsSync(origExe)) {
      fs.renameSync(origExe, targetExe);
    }
  } else {
    console.log('Electron runtime already initialized, updating application bundles...');
  }

  // 3. Create / update resources/app
  const appDir = path.join(appOutputDir, 'resources', 'app');
  fs.mkdirSync(appDir, { recursive: true });

  const appDist = path.join(appDir, 'dist');
  if (fs.existsSync(appDist)) {
    try {
      fs.rmSync(appDist, { recursive: true, force: true });
    } catch (e) {
      console.warn('Warning: Could not clear dist, overwriting in place...');
    }
  }

  // 4. Copy built web assets (dist)
  console.log('Copying production bundles (dist)...');
  copyRecursiveSync(path.join(ROOT, 'dist'), appDist);

  // 5. Copy electron scripts
  const electronDest = path.join(appDir, 'electron');
  fs.mkdirSync(electronDest, { recursive: true });
  fs.copyFileSync(path.join(ROOT, mainScript), path.join(electronDest, path.basename(mainScript)));
  fs.copyFileSync(path.join(ROOT, 'electron', 'preload.cjs'), path.join(electronDest, 'preload.cjs'));

  // 6. Create production package.json in appDir
  const pkgData = {
    name: exeName.toLowerCase(),
    version: '2.0.0',
    main: `electron/${path.basename(mainScript)}`,
    description: isGame ? 'Customer Journey Quest - Standalone Game' : 'Customer Journey Quest - Admin Portal'
  };
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(pkgData, null, 2), 'utf8');

  // 7. Create a convenient 1-click launcher within the folder
  const batchContent = `@echo off\nstart "" "%~dp0${exeName}.exe"\n`;
  fs.writeFileSync(path.join(appOutputDir, 'Run.bat'), batchContent, 'utf8');

  console.log(`✓ Standalone Package Ready at:`);
  console.log(`  Folder: ${appOutputDir}`);
  console.log(`  Executable: ${targetExe}`);
}

try {
  // 1. Package Game Standalone
  buildStandalonePackage({
    appName: 'CustomerJourneyQuest-Game-Standalone',
    exeName: 'CustomerJourneyQuest-Game',
    mainScript: 'electron/main-game.cjs',
    isGame: true
  });

  // 2. Package Admin Standalone
  buildStandalonePackage({
    appName: 'CustomerJourneyQuest-Admin-Standalone',
    exeName: 'CustomerJourneyQuest-Admin',
    mainScript: 'electron/main-admin.cjs',
    isGame: false
  });

  console.log(`\n======================================================`);
  console.log(` ALL STANDALONE PACKAGES GENERATED SUCCESSFULLY!      `);
  console.log(` Both applications can now be transferred via USB and  `);
  console.log(` run on any Windows PC without Node.js or a browser.   `);
  console.log(`======================================================\n`);
} catch (err) {
  console.error('Packaging failed:', err);
  process.exit(1);
}
