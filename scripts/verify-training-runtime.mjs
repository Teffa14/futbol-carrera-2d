import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(scriptsDir,'..');
const files=await readdir(root);
function fail(message){throw new Error(`[training-runtime] ${message}`);}
function latestVersion(prefix){const versions=files.map(name=>new RegExp(`^${prefix}-v(\\d+)\\.js$`).exec(name)).filter(Boolean).map(m=>Number(m[1]));if(!versions.length)fail(`No versioned module found for ${prefix}`);return Math.max(...versions);}
function exactImport(source,modulePath){return source.includes(`'./${modulePath}'`)||source.includes(`"./${modulePath}"`);}

const engineVersion=latestVersion('training-match-engine');
const liveUiVersion=latestVersion('training-live-ui');
const engineAlias=await readFile(path.join(root,'training-match-engine-latest.js'),'utf8');
const engineSource=await readFile(path.join(root,`training-match-engine-v${engineVersion}.js`),'utf8');
const runtime=await readFile(path.join(root,'training-runtime-latest.js'),'utf8');
const index=await readFile(path.join(root,'index.html'),'utf8');

if(!exactImport(engineAlias,`training-match-engine-v${engineVersion}.js`))fail(`training-match-engine-latest.js must point to v${engineVersion}`);
if(!new RegExp(`TRAINING_MATCH_ENGINE_VERSION\\s*=\\s*${engineVersion}\\b`).test(engineAlias))fail(`engine alias version constant must be ${engineVersion}`);
if(!exactImport(runtime,'training-match-engine-latest.js'))fail('canonical runtime must use training-match-engine-latest.js');
if(!exactImport(runtime,'training-framework-v2.js'))fail('canonical runtime must load training framework v2');
if(!new RegExp(`matchEngine\\s*:\\s*TRAINING_MATCH_ENGINE_VERSION`).test(runtime))fail('runtime manifest must expose canonical match engine version');
if(!new RegExp(`authoritativeScenarios\\s*:\\s*${engineVersion}\\b`).test(runtime))fail(`runtime must expose authoritative scenarios v${engineVersion}`);
if(/training-(?:intelligence|small-sided|transfer|competitive|role-scenarios)-v\d+\.js/.test(runtime))fail('production runtime must not load legacy scenario patch layers');
if(/training-engine-v\d+\.js/.test(runtime))fail('canonical runtime must never load the standalone legacy TrainingEngine');
if(!/extends\s+(?:LegacyTrainingMatchEngine|TrainingMatchEngineV\d+)/.test(engineSource))fail(`training engine v${engineVersion} must extend the isolated training engine chain`);
if(!/resetRep\s*\(/.test(engineSource)||!/scenario\s*\(/.test(engineSource))fail(`training engine v${engineVersion} must own resetRep and scenario execution`);

const v2Source=await readFile(path.join(root,'training-match-engine-v2.js'),'utf8');
if(!/extends\s+LegacyTrainingMatchEngine/.test(v2Source))fail('training engine v2 must establish the isolated subclass boundary from legacy');
if(!/resetRep\s*\(/.test(v2Source)||!/scenario\s*\(/.test(v2Source))fail('training engine v2 must own the base authoritative reset/scenario execution');

if(!new RegExp(`liveUi\\s*:\\s*${liveUiVersion}\\b`).test(runtime))fail(`runtime manifest liveUi must report v${liveUiVersion}`);
if(!exactImport(index,'training-runtime-latest.js'))fail('index.html must load the canonical training runtime');
if(!exactImport(index,`training-live-ui-v${liveUiVersion}.js`))fail(`index.html must load latest training live UI v${liveUiVersion}`);
if(/import\s+['"]\.\/training-(?:match-engine|intelligence|small-sided|transfer|competitive|role-scenarios)-v\d+\.js['"]/.test(index))fail('index.html must not bypass the canonical training runtime');
if(/import\s+['"]\.\/training-(?:engine|physics-fix|drills|drill-calibration)-v\d+\.js['"]/.test(index))fail('production must not load the legacy standalone training engine stack');

const liveUi=await readFile(path.join(root,`training-live-ui-v${liveUiVersion}.js`),'utf8');
if(!exactImport(liveUi,'training-runtime-latest.js'))fail(`latest live UI v${liveUiVersion} must use canonical runtime`);
console.log(`Training runtime verified: isolated match-engine v${engineVersion}, framework v2, authoritative scenarios v${engineVersion}, live-ui v${liveUiVersion}`);
