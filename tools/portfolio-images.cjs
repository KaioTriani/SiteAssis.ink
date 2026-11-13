// Gera variantes responsivas das fotos reais (sem filtros: só redimensiona e comprime).
const sharp=require('C:/Users/Matheus/Desktop/zion/thehubvr-site/tools/node_modules/sharp');
const P='referencias/instagram/posts/',F='referencias/fornecidas/tatuagens/',O='public/assets/portfolio/';
const src={
 'floral-lirios-borboletas-1':P+'2026-10-04_floral-costela-lirio-borboleta_1.jpg',
 'floral-lirios-borboletas-2':P+'2026-10-04_floral-costela-lirio-borboleta_2.jpg',
 'oriental-ondas-sakura-1':P+'2026-09-18_oriental-ondas-sakura_foto.jpg',
 'old-school-never-more-1':P+'2026-09-05_old-school-never-more_foto.jpg',
 'escrita-chinesa-pescoco-1':P+'2026-08-24_escrita-chinesa_1.jpg',
 'escrita-chinesa-pescoco-2':P+'2026-08-24_escrita-chinesa_2.jpg',
 'samurai-1':F+'samurai.jpg',
 'samurai-2':P+'2026-08-19_samurai_2.webp',
 'anime-itachi-anbu-1':P+'2026-07-30_anime-itachi-anbu.webp',
 'anime-nuvem-akatsuki-1':F+'anime-nuvem-akatsuki.jpg',
 'fineline-peixe-quebrada-1':P+'2026-07-22_fineline-peixe-andando-de-quebrada_2.webp',
 'fineline-peixe-quebrada-2':P+'2026-07-22_fineline-peixe-andando-de-quebrada_1.webp',
 'fineline-1967-oceano-1':P+'2026-07-19_fineline-1967-e-eu-oceano_3.webp',
 'fineline-1967-oceano-2':P+'2026-07-19_fineline-1967-e-eu-oceano_1.webp',
 'fineline-1967-oceano-3':P+'2026-07-19_fineline-1967-e-eu-oceano_2.webp',
 'old-school-lucky-1':F+'old-school-lucky.jpg',
 'old-school-lucky-2':P+'2026-07-15_old-school-lucky_foto2.webp',
 'escrita-el-arte-de-sentir-1':F+'escrita-el-arte-de-sentir.jpg',
};
(async()=>{const dims={};for(const [k,f] of Object.entries(src)){
  const img=sharp(f).rotate();const m=await img.metadata();
  const big=await sharp(f).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toFile(O+k+'-full.webp');
  await sharp(f).rotate().resize({width:760,height:1000,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toFile(O+k+'-760.webp');
  dims[k]=[big.width,big.height];console.log(k,big.width+'x'+big.height,Math.round(big.size/1024)+'k')}
 require('fs').writeFileSync('tools/portfolio-dims.json',JSON.stringify(dims,null,1));
 // imagem do hero e de compartilhamento
 await sharp(src['oriental-ondas-sakura-1']).resize({width:1600}).webp({quality:80}).toFile('public/assets/img/hero-oriental-1600.webp');
 await sharp(src['oriental-ondas-sakura-1']).resize({width:900}).webp({quality:76}).toFile('public/assets/img/hero-oriental-900.webp');
 await sharp(src['oriental-ondas-sakura-1']).extract({left:0,top:900,width:3024,height:1588}).resize(1200,630).modulate({brightness:0.55}).jpeg({quality:82}).toFile('public/assets/img/og-base.jpg');
})();
