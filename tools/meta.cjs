const sharp=require('C:/Users/Matheus/Desktop/zion/thehubvr-site/tools/node_modules/sharp');const fs=require('fs'),path=require('path');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
(async()=>{for(const f of walk('referencias').filter(f=>/\.(jpg|png|webp)$/.test(f))){const m=await sharp(f).metadata();console.log(path.relative('referencias',f),m.width+'x'+m.height,Math.round(fs.statSync(f).size/1024)+'k')}})();
