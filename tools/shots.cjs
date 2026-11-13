// Capturas de tela por seção + erros de console. Uso: node tools/shots.cjs <url> <largura> <altura> <saida-prefixo> [mobile] [seletores...]
const puppeteer = require('C:/Users/Matheus/Desktop/zion/thehubvr-site/tools/node_modules/puppeteer-core');
const [, , url, w, h, out, mobile, ...sels] = process.argv;
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  const errs = [];
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 1, isMobile: mobile === 'mobile', hasTouch: mobile === 'mobile' });
  await p.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2500));
  const list = sels.length ? sels : ['#inicio'];
  for (const [i, s] of list.entries()) {
    if (s.startsWith('+')) await p.evaluate((d) => window.scrollBy(0, d), Number(s.slice(1)));
    else await p.evaluate((s) => document.querySelector(s).scrollIntoView(), s);
    await new Promise((r) => setTimeout(r, 2200));
    await p.screenshot({ path: `${out}-${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 72 });
  }
  console.log(errs.length ? errs.join('\n') : 'sem erros no console');
  await b.close();
})();
