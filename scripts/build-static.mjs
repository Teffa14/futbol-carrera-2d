import {createHash} from 'node:crypto';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const scriptsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(scriptsDir,'..');
const out=path.join(root,'dist');
const sourceIndex=await readFile(path.join(root,'index.html'),'utf8');
const moduleMatch=sourceIndex.match(/<script\s+type=["']module["']\s*>([\s\S]*?)<\/script>/i);
if(!moduleMatch)throw new Error('index.html is missing its module entrypoint');
if(sourceIndex.includes('raw.githubusercontent.com'))throw new Error('Source index must not use a GitHub runtime loader');

const result=await build({
  stdin:{
    contents:moduleMatch[1],
    resolveDir:root,
    sourcefile:'production-entry.js',
    loader:'js'
  },
  bundle:true,
  format:'iife',
  platform:'browser',
  target:['es2022'],
  minify:true,
  write:false,
  legalComments:'none'
});

const bundle=result.outputFiles?.[0]?.text;
if(!bundle)throw new Error('esbuild did not produce a browser bundle');
const baseCss=await readFile(path.join(root,'styles.css'),'utf8');
const creationCss=await readFile(path.join(root,'character-creation.css'),'utf8');
const landingCss=await readFile(path.join(root,'public-landing.css'),'utf8');
const mobileCss=await readFile(path.join(root,'mobile-responsive-v2.css'),'utf8');
const buildId=createHash('sha256').update(sourceIndex).update(bundle).update(baseCss).update(creationCss).update(landingCss).update(mobileCss).digest('hex').slice(0,12);
const safeCss=`${baseCss}\n${creationCss}\n${landingCss}\n${mobileCss}`.replace(/<\/style/gi,'<\\/style');
const safeJs=bundle.replace(/<\/script/gi,'<\\/script');

let html=sourceIndex
  .replace(/\s*<link[^>]+href=["']\.\/styles\.css["'][^>]*>/i,'')
  .replace(/\s*<link[^>]+href=["']\.\/character-creation\.css["'][^>]*>/i,'')
  .replace(/\s*<link[^>]+href=["']\.\/public-landing\.css["'][^>]*>/i,'')
  .replace(/\s*<link[^>]+href=["']\.\/mobile-responsive-v2\.css["'][^>]*>/i,'')
  .replace(moduleMatch[0],()=>`<script>${safeJs}</script>`)
  .replace('</head>',`<meta name="career-build" content="self-contained"><meta name="career-build-id" content="${buildId}"><style>${safeCss}</style></head>`);

if(/type=["']module["']/i.test(html))throw new Error('Production page still contains an unbundled module entrypoint');
if(/(?:src|href)=["']\.\/(?:app|styles|character-creation|public-landing|mobile-responsive-v2)\./i.test(html))throw new Error('Production page still depends on separate core assets');
if(html.includes('raw.githubusercontent.com'))throw new Error('Production page must not fetch executable modules from GitHub');
if(!html.includes('<meta name="career-build" content="self-contained">'))throw new Error('Production page lost the stable loader compatibility marker');

const forbiddenPublicSourceMarkers=[
  'Teffa14/futbol-carrera-2d',
  'github.com/Teffa14',
  'raw.githubusercontent.com/Teffa14',
  'api.github.com/repos/Teffa14'
];
for(const marker of forbiddenPublicSourceMarkers){
  if(html.toLowerCase().includes(marker.toLowerCase())){
    throw new Error(`Production page leaks private repository identifier: ${marker}`);
  }
}

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await writeFile(path.join(out,'index.html'),html,'utf8');
console.log(`Self-contained production build ${buildId} ready: ${Buffer.byteLength(html)} bytes`);
