import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {claimTrainingUiOwnership,TRAINING_UI_OWNER_VERSION} from '../training-ui-ownership-v2.js';

test('training v2 installs the sentinel that disables the legacy training observer',()=>{
  const nodes=[];
  const doc={
    body:{appendChild(node){nodes.push(node);}},
    querySelector(selector){return selector==='#training-sim-shell'?nodes.find(n=>n.id==='training-sim-shell')||null:null;},
    createElement(){return {id:'',hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;}};}
  };
  const first=claimTrainingUiOwnership(doc);
  const second=claimTrainingUiOwnership(doc);
  assert.equal(TRAINING_UI_OWNER_VERSION,2);
  assert.equal(first.id,'training-sim-shell');
  assert.equal(first.hidden,true);
  assert.equal(first.attrs['data-training-owner'],'v2');
  assert.equal(second,first);
  assert.equal(nodes.length,1,'ownership sentinel must be stable instead of triggering mutation ping-pong');
});

test('ownership loads before legacy career experience and matches its guard',async()=>{
  const [index,legacy]=await Promise.all([
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../career-experience-ui-v1.js',import.meta.url),'utf8')
  ]);
  const owner=index.indexOf("import './training-ui-ownership-v2.js'");
  const old=index.indexOf("import './career-experience-ui-v1.js'");
  assert.ok(owner>=0&&old>=0&&owner<old,'Training V2 ownership must exist before legacy observer initializes');
  assert.match(legacy,/document\.querySelector\('#training-sim-shell'\)/,'legacy training enhancer must honor the ownership sentinel');
});
