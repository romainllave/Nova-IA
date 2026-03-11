const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let flaskProcess;
const PORT = 5000;
const MAX_RETRIES = 120; // Allow up to 60 seconds (120 * 500ms)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#070710',
    title: "NovaMind — IA Personnelle",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false // Don't show until Flask is ready
  });

  // Load the loading screen initially (optional, but good for UX)
  mainWindow.loadURL(`data:text/html;charset=utf-8,
    <html style="background-color:%23070710;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
      <div style="text-align:center;">
        <h2 style="color:%23a78bfa">NovaMind</h2>
        <p>Démarrage du moteur IA...</p>
      </div>
    </html>
  `);
  mainWindow.show();

  waitForFlask(0);
}

function startFlaskServer() {
  // Use the included main.py file.
  // In production, you might want to package the python app with pyinstaller first
  // and spawn the resulting .exe instead of relying on a local python installation.
  // For this hybrid project, we execute python.
  console.log("Starting Flask server...");
  let pythonExecutable = "python";
  
  flaskProcess = spawn(pythonExecutable, ['-u', path.join(__dirname, 'main.py')], {
    cwd: __dirname,
    env: { ...process.env, PYTHONIOENCODING: 'utf8' }
  });

  flaskProcess.stdout.on('data', (data) => console.log(`Flask: ${data}`));
  flaskProcess.stderr.on('data', (data) => console.error(`Flask Error: ${data}`));
  
  flaskProcess.on('close', (code) => {
    console.log(`Flask stopped with code ${code}`);
  });
}

function waitForFlask(retries) {
  if (retries > MAX_RETRIES) {
    console.error("Flask server did not start in time.");
    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <html style="background-color:%23070710;color:red;font-family:sans-serif;padding:20px">
        <h2>Erreur fatale</h2>
        <p>Le serveur IA n'a pas pu démarrer.</p>
        <p>Assurez-vous que Python est installé et que main.py s'exécute correctement.</p>
      </html>
    `);
    return;
  }

  http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
    if (res.statusCode === 200) {
      console.log("Flask is ready! Loading app...");
      mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    } else {
      setTimeout(() => waitForFlask(retries + 1), 500);
    }
  }).on('error', (err) => {
    setTimeout(() => waitForFlask(retries + 1), 500);
  });
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startFlaskServer();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('quit', () => {
    // Kill flask completely
    if (flaskProcess) {
      const { spawnSync } = require('child_process');
      if (process.platform === 'win32') {
        spawnSync("taskkill", ["/pid", flaskProcess.pid, '/f', '/t']);
      } else {
        flaskProcess.kill('SIGKILL');
      }
    }
  });
}
