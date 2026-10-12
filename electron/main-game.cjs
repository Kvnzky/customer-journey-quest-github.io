const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Isolate user data directory and disable problematic GPU cache
app.setName('CustomerJourneyQuestGame');
app.setPath('userData', path.join(app.getPath('appData'), 'CustomerJourneyQuestGame'));
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Shared directory for inter-app sync between Game and Admin Portal
const sharedDir = path.join(app.getPath('appData'), 'CustomerJourneyQuestShared');
if (!fs.existsSync(sharedDir)) {
  try { fs.mkdirSync(sharedDir, { recursive: true }); } catch (_) {}
}
const sharedSettingsFile = path.join(sharedDir, 'game-settings.json');
const sharedQuestionsFile = path.join(sharedDir, 'shared-questions.json');

ipcMain.handle('get-shared-settings', () => {
  try {
    if (fs.existsSync(sharedSettingsFile)) {
      const data = fs.readFileSync(sharedSettingsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not read shared settings:', err.message);
  }
  return null;
});

ipcMain.handle('save-shared-settings', (event, settings) => {
  try {
    fs.writeFileSync(sharedSettingsFile, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('Could not save shared settings:', err.message);
    return false;
  }
});

ipcMain.handle('get-shared-questions', () => {
  try {
    if (fs.existsSync(sharedQuestionsFile)) {
      const data = fs.readFileSync(sharedQuestionsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not read shared questions:', err.message);
  }
  return null;
});

ipcMain.handle('save-shared-questions', (event, questions) => {
  try {
    fs.writeFileSync(sharedQuestionsFile, JSON.stringify(questions, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('Could not save shared questions:', err.message);
    return false;
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 840,
      minWidth: 960,
      minHeight: 640,
      title: 'Customer Journey Quest — Standalone Game',
      backgroundColor: '#060e19',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false // allow relative local asset resolution
      }
    });

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      mainWindow.loadURL('http://localhost:5173/').catch(() => {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
      });
    } else {
      mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
