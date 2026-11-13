// Recorta cada arte das folhas de flash (prints dos stories). Uso: node tools/flash-crops.cjs
const sharp=require('C:/Users/Matheus/Desktop/zion/thehubvr-site/tools/node_modules/sharp');
const S='referencias/fornecidas/flash-e-autorais/',O='public/assets/flash/';
const sheets={
 'flash-01-mistico-leque-flores-diaba-olho-sol.png':{leque:[12,80,285,215],'flor-ornamental':[290,80,188,268],diaba:[5,285,165,285],'flor-olho':[180,310,140,262],'sol-oval':[335,335,150,250]},
 'flash-02-personagens-coringa.png':{'coringa-cidade':[95,70,330,240],'duas-faces':[25,325,215,320],'cinco-faces':[245,325,210,315]},
 'flash-03-lirio-floresca-sempre-22cm.png':{'lirio-floresca-sempre':[35,50,450,329]},
 'flash-04-lotus-coluna-35cm.png':{'lotus-coluna':[0,70,495,742]},
 'flash-05-autoral-pantera-pato-caveira.png':{pantera:[30,180,190,265],'pato-punk':[205,136,215,204],'caveira-bobo':[215,325,220,228]},
 'flash-06-autoral-flores-fineline.png':{'flor-papoula':[30,138,165,252],'flor-coracao':[178,105,122,330],'margarida':[290,178,150,252],'flor-ornamento':[45,440,380,75]},
 'flash-07-autoral-adaga-flor-gato-caveira.png':{adaga:[85,150,185,300],'flor-olho-gota':[245,85,170,292],'gato-coffee':[35,492,190,222],'caveira-chapeu':[225,360,240,330]},
};
(async()=>{for(const [f,crops] of Object.entries(sheets)){
  const base=f.replace('.png','');
  await sharp(S+f).webp({quality:92}).toFile(O+'folha-'+base.slice(0,8)+'.webp');
  for(const [n,[l,t,w,h]] of Object.entries(crops)){const m=await sharp(S+f).metadata();
    const W=Math.min(w,m.width-l),H=Math.min(h,m.height-t);
    await sharp(S+f).extract({left:l,top:t,width:W,height:H}).flatten({background:'#ffffff'}).webp({quality:92}).toFile(O+n+'.webp');console.log(n,W+'x'+H)}}})();
