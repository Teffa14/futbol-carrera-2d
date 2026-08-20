import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('setup renders Career Eleven without a personal default name',async()=>{
  const root={innerHTML:''};
  globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.document={querySelector(sel){return sel==='#app'?root:null;},querySelectorAll(){return[];},addEventListener(){},body:{appendChild(){}},createElement(){return{className:'',textContent:'',remove(){}};}};
  globalThis.confirm=()=>true;globalThis.performance={now:()=>0};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  await import(`../app.js?smoke=${Date.now()}`);
  assert.match(root.innerHTML,/CAREER ELEVEN|MODO CARRERA/);
  assert.doesNotMatch(root.innerHTML,/Stefano/);
  assert.match(root.innerHTML,/11 CONTRA 11/);
  assert.match(root.innerHTML,/Asignar atributos/);
});

test('setup source wires correlated allocation before club selection',()=>{
  const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.match(source,/data-family-up/);
  assert.match(source,/PREVIEW DEL JUVENIL/);
  assert.match(source,/creationReadiness/);
  assert.match(source,/createCareerFromCharacter/);
  assert.ok(source.indexOf('setup.step===2')<source.indexOf("setup.step===3"));
});
