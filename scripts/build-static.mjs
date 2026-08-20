import {cp, mkdir, readdir, readFile, rm, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(scriptsDir,'..');
const out=path.join(root,'dist');
const publishable=/\.(?:html|css|js)$/i;
const required=['index.html','app.js','styles.css','character-creation.css','data.js','engine.js','career.js'];

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

const entries=await readdir(root,{withFileTypes:true});
const copied=[];
for(const entry of entries){
  if(!entry.isFile()||!publishable.test(entry.name))continue;
  await cp(path.join(root,entry.name),path.join(out,entry.name));
  copied.push(entry.name);
}

for(const name of required){
  const info=await stat(path.join(out,name)).catch(()=>null);
  if(!info?.isFile())throw new Error(`Static build missing required asset: ${name}`);
}

const index=await readFile(path.join(out,'index.html'),'utf8');
if(!index.includes("import './app.js'"))throw new Error('index.html must load the local app.js entrypoint');
if(index.includes('raw.githubusercontent.com'))throw new Error('Production index must not fetch executable modules from GitHub at runtime');

console.log(`Static build ready: ${copied.length} files in dist/`);
