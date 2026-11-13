const sharp=require('C:/Users/Matheus/Desktop/zion/thehubvr-site/tools/node_modules/sharp');const fs=require('fs'),path=require('path');
const [out,...files]=process.argv.slice(2);const W=300,H=380,cols=5;
(async()=>{const tiles=await Promise.all(files.map(async(f,i)=>({input:await sharp(f).resize(W,H,{fit:'contain',background:'#222'}).composite([{input:Buffer.from(`<svg width="${W}" height="24"><rect width="${W}" height="24" fill="#000a"/><text x="4" y="17" font-size="15" fill="#fff" font-family="Arial">${i}: ${path.basename(f).slice(0,34)}</text></svg>`),gravity:'north'}]).toBuffer(),left:(i%cols)*W,top:Math.floor(i/cols)*H})));
await sharp({create:{width:W*cols,height:H*Math.ceil(files.length/cols),channels:3,background:'#111'}}).composite(tiles).jpeg({quality:70}).toFile(out)})();
