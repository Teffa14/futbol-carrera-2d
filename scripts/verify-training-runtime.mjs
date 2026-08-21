import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(scriptsDir,'..');
const files=await readdir(root);

function fail(message){throw new Error(`[training-runtime] ${message}`);}
function latestVersion(prefix){
  const versions=files.map(name=>new RegExp(`^${prefix}-v(\\d+)\\.js$`).exec(name)).filter(Boolean).map(m=>Number(m[1]));
  if(!versions.length)fail(`No versioned module found for ${prefix}`);
  return Math.max(...versions);
}
function exactImport(source,modulePath){return source.includes(`'./${modulePath}'`)||source.includes(`"./${modulePath}"`);}

const engineVersion=latestVersion('training-match-engine');
const families=[
  ['intelligence','training-intelligence'],
  ['smallSided','training-small-sided'],
  ['transfer','training-transfer'],
  ['competitive','training-competitive'],
];
const liveUiVersion=latestVersion('training-live-ui');
const engineAlias=await readFile(path.join(root,'training-match-engine-latest.js'),'utf8');
const runtime=await readFile(path.join(root,'training-runtime-latest.js'),'utf8');
const index=await readFile(path.join(root,'index.html'),'utf8');

if(!exactImport(engineAlias,`training-match-engine-v${engineVersion}.js`))fail(`training-match-engine-latest.js must point to v${engineVersion}`);
if(!new RegExp(`TRAINING_MATCH_ENGINE_VERSION\\s*=\\s*${engineVersion}\\b`).test(engineAlias))fail(`engine alias version constant must be ${engineVersion}`);
if(!exactImport(runtime,'training-match-engine-latest.js'))fail('canonical runtime must use training-match-engine-latest.js');
if(/training-engine-v\d+\.js/.test(runtime))fail('canonical runtime must never load the legacy standalone TrainingEngine');

for(const [key,prefix] of families){
  const version=latestVersion(prefix),moduleName=`${prefix}-v${version}.js`;
  if(!exactImport(runtime,moduleName))fail(`canonical runtime must load latest ${prefix} v${version}`);
  if(!new RegExp(`${key}\\s*:\\s*${version}\\b`).test(runtime))fail(`runtime manifest ${key} must report v${version}`);
  const source=await readFile(path.join(root,moduleName),'utf8');
  const stable=exactImport(source,'training-match-engine-latest.js');
  const exact=exactImport(source,`training-match-engine-v${engineVersion}.js`);
  if(!stable&&!exact)fail(`${moduleName} is not attached to latest match engine v${engineVersion}`);
}

if(!new RegExp(`liveUi\\s*:\\s*${liveUiVersion}\\b`).test(runtime))fail(`runtime manifest liveUi must report v${liveUiVersion}`);
if(!exactImport(index,'training-runtime-latest.js'))fail('index.html must load the canonical training runtime');
if(!exactImport(index,`training-live-ui-v${liveUiVersion}.js`))fail(`index.html must load latest training live UI v${liveUiVersion}`);
if(/import\s+['"]\.\/training-(?:match-engine|intelligence|small-sided|transfer|competitive)-v\d+\.js['"]/.test(index))fail('index.html must not bypass the canonical training runtime with direct versioned engine imports');
if(/import\s+['"]\.\/training-(?:engine|physics-fix|drills|drill-calibration)-v\d+\.js['"]/.test(index))fail('production must not load the legacy standalone training engine stack');

const liveUi=await readFile(path.join(root,`training-live-ui-v${liveUiVersion}.js`),'utf8');
const liveUsesStable=exactImport(liveUi,'training-runtime-latest.js')||exactImport(liveUi,'training-match-engine-latest.js');
const liveUsesExact=exactImport(liveUi,`training-match-engine-v${engineVersion}.js`);
if(!liveUsesStable&&!liveUsesExact)fail(`latest live UI v${liveUiVersion} is not connected to latest match engine v${engineVersion}`);

console.log(`Training runtime verified: match-engine v${engineVersion}, ${families.map(([_,prefix])=>`${prefix} v${latestVersion(prefix)}`).join(', ')}, live-ui v${liveUiVersion}`);
