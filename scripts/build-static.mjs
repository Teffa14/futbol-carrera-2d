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
const buildId=createHash('sha256').update(sourceIndex).update(bundle).update(baseCss).update(creationCss).digest('hex').slice(0,12);
const safeCss=`${baseCss}\n${creationCss}`.replace(/<\/style/gi,'<\\/style');
const safeJs=bundle.replace(/<\/script/gi,'<\\/script');

let html=sourceIndex
  .replace(/\s*<link[^>]+href=["']\.\/styles\.css["'][^>]*>/i,'')
  .replace(/\s*<link[^>]+href=["']\.\/character-creation\.css["'][^>]*>/i,'')
  .replace(moduleMatch[0],()=>`<script>${safeJs}</script>`)
  .replace('</head>',`<meta name="career-build" content="self-contained"><meta name="career-build-id" content="${buildId}"><style>${safeCss}</style></head>`);

if(/type=["']module["']/i.test(html))throw new Error('Production page still contains an unbundled module entrypoint');
if(/(?:src|href)=["']\.\/(?:app|styles|character-creation)\./i.test(html))throw new Error('Production page still depends on separate core assets');
if(html.includes('raw.githubusercontent.com'))throw new Error('Production page must not fetch executable modules from GitHub');
if(!html.includes('<meta name="career-build" content="self-contained">'))throw new Error('Production page lost the stable loader compatibility marker');

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await writeFile(path.join(out,'index.html'),html,'utf8');
console.log(`Self-contained production build ${buildId} ready: ${Buffer.byteLength(html)} bytes`);
