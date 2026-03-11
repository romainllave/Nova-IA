const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let flaskProcess;
const PORT = 5000;
const FLASK_URL = `http://127.0.0.1:${PORT}`;
const HEALTH_CHECK_URL = `${FLASK_URL}/health`;
const MAX_RETRIES = 60; // 60 seconds total

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
    show: false
  });

  // Loading screen
  mainWindow.loadURL(`data:text/html;charset=utf-8,
    <html style="background-color:%23070710;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
      <div style="text-align:center;">
        <h2 style="color:%23a78bfa;font-size:32px;margin-bottom:10px;">NovaMind</h2>
        <div style="width:40px;height:40px;border:4px solid %23a78bfa;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px;"></div>
        <p style="font-size:18px;color:%239898b8;">Démarrage du moteur IA...</p>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      </div>
    </html>
  `);
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  startFlaskAndMonitor();
}

function showFatalError(details = "") {
  if (mainWindow) {
    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <body style="background:#07070f;color:#ff4444;font-family:sans-serif;padding:40px;text-align:center;display:flex;flex-direction:column;justify-content:center;height:100vh;margin:0;">
          <h1 style="font-size:48px;margin-bottom:10px;">Erreur fatale</h1>
          <p style="font-size:20px;color:#eee;">Le serveur IA n'a pas pu démarrer.</p>
          <div style="background:rgba(255,255,255,0.05);padding:20px;border-radius:8px;margin-top:20px;color:#888;font-family:monospace;text-align:left;white-space:pre-wrap;max-width:800px;margin-left:auto;margin-right:auto;border:1px solid rgba(255,0,0,0.2);">${details}</div>
          <p style="margin-top:20px;color:%239898b8;">Assurez-vous que Python est installé et lancez "pip install -r requirements.txt".</p>
          <button onclick="location.reload()" style="background:#a78bfa;color:white;border:none;padding:12px 24px;border-radius:24px;cursor:pointer;margin-top:20px;font-weight:bold;font-size:16px;">Réessayer</button>
      </body>
    `);
  }
}

function spawnFlask() {
  const commands = ['python', 'python3', 'py'];
  let commandIdx = 0;

  return new Promise((resolve, reject) => {
    function tryNext() {
      const cmd = commands[commandIdx];
      console.log(`Attempting to spawn Python with: ${cmd}`);
      
      const child = spawn(cmd, ['main.py'], {
        cwd: __dirname,
        shell: true,
        env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
      });

      child.on('error', (err) => {
        console.error(`Failed to spawn ${cmd}:`, err.message);
        commandIdx++;
        if (commandIdx < commands.length) {
          tryNext();
        } else {
          reject(new Error("Aucun interpréteur Python trouvé (python, python3, py)."));
        }
      });

      // Handle immediate exit (e.g. crash on import)
      child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`Python process exited with code ${code}`);
          // If it was the first try and it crashed, maybe we shouldn't try next but report error
          // For now, let's just keep reference if it stays alive
        }
      });

      flaskProcess = child;
      resolve(child);
    }

    tryNext();
  });
}

function checkFlask() {
  return new Promise((resolve) => {
    http.get(HEALTH_CHECK_URL, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function waitForFlask() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const alive = await checkFlask();
    if (alive) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function startFlaskAndMonitor() {
  try {
    await spawnFlask();
    
    flaskProcess.stdout.on('data', (data) => console.log(`Flask: ${data}`));
    flaskProcess.stderr.on('data', (data) => console.error(`Flask Error: ${data}`));

    const ready = await waitForFlask();
    if (ready) {
      console.log("Flask is ready! Loading app...");
      mainWindow.loadURL(FLASK_URL);
    } else {
      showFatalError("Le serveur ne répond pas après 60 secondes.");
    }
  } catch (err) {
    showFatalError(err.message);
  }
}

// Single instance lock
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

  app.whenReady().then(createWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('quit', () => {
    if (flaskProcess) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', flaskProcess.pid, '/f', '/t']);
      } else {
        flaskProcess.kill('SIGKILL');
      }
    }
  });
}
