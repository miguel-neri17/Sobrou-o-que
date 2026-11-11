// Acha um navegador baseado em Chromium já instalado (Edge, Chrome ou Chromium), sem baixar nada.
// Para forçar um específico: BROWSER_PATH="C:/caminho/para/chrome.exe" npm run test:ui
const fs = require('fs');

const CANDIDATOS = {
  win32: [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
};

function acharNavegador() {
  const env = process.env.BROWSER_PATH;
  if (env) {
    if (!fs.existsSync(env)) throw new Error('BROWSER_PATH aponta para um arquivo que não existe: ' + env);
    return env;
  }
  const achado = (CANDIDATOS[process.platform] || []).find((p) => fs.existsSync(p));
  if (!achado) {
    throw new Error('Nenhum Edge, Chrome ou Chromium encontrado. Instale um deles ou defina BROWSER_PATH com o caminho do executável.');
  }
  return achado;
}

module.exports = { acharNavegador };
