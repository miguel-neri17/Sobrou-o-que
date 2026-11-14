/* Gera os ícones do PWA a partir de img/logo-2.png: img/icon-192.png, img/icon-512.png e img/apple-touch-icon.png.
   Fundo igual ao --bg claro e o desenho em ~62% do quadro: a margem protege o recorte circular do Android ("maskable").
   Só precisa rodar de novo se o logotipo mudar.  Uso: node scripts/icones.js */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { acharNavegador } = require('./browser');

const raiz = path.resolve(__dirname, '..');
const BG = '#F2F4F3'; // --bg claro (o test:design confere que o manifesto usa o mesmo valor)
const SAIDAS = [['icon-192.png', 192, 0.62], ['icon-512.png', 512, 0.62], ['apple-touch-icon.png', 180, 0.7]];

(async () => {
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(raiz, 'img', 'logo-2.png')).toString('base64');
  const browser = await puppeteer.launch({ executablePath: acharNavegador(), headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const png = await page.evaluate(async (src, bg, saidas) => {
    const img = new Image(); img.src = src; await img.decode();
    return saidas.map(([nome, t, fator]) => {
      const c = document.createElement('canvas'); c.width = c.height = t;
      const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, t, t);
      g.imageSmoothingQuality = 'high';
      const h = t * fator, w = h * img.width / img.height;
      g.drawImage(img, (t - w) / 2, (t - h) / 2, w, h);
      return [nome, c.toDataURL('image/png').split(',')[1]];
    });
  }, logo, BG, SAIDAS);
  png.forEach(([nome, b64]) => { fs.writeFileSync(path.join(raiz, 'img', nome), Buffer.from(b64, 'base64')); console.log('img/' + nome); });
  await browser.close();
})();
