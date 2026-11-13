const sharp=require('C:/Users/Matheus/Desktop/zion/thehubvr-site/tools/node_modules/sharp');
(async()=>{
const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#000" fill-opacity=".35"/><text x="70" y="250" font-family="Impact, Arial Narrow, sans-serif" font-size="118" fill="#f2f0ec">SUA IDEIA.</text><text x="70" y="370" font-family="Impact, Arial Narrow, sans-serif" font-size="118" fill="#f2f0ec">MINHA <tspan fill="#d71935">ARTE.</tspan></text><text x="72" y="450" font-family="Arial, sans-serif" font-size="30" fill="#cfcac2">Assis.ink · Tatuador em João Pessoa, PB</text><rect x="72" y="490" width="160" height="4" fill="#d71935"/></svg>`);
await sharp('public/assets/img/og-base.jpg').composite([{input:svg}]).jpeg({quality:84}).toFile('public/assets/img/og-image.jpg');
const icon=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512"><rect width="64" height="64" fill="#080808"/><text x="32" y="44" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="38" fill="#f2f0ec">a</text><circle cx="47" cy="44" r="4" fill="#d71935"/></svg>`);
await sharp(icon).png().toFile('public/assets/img/icon-512.png');
await sharp(icon).resize(180).png().toFile('public/apple-touch-icon.png');
console.log('ok')})();
