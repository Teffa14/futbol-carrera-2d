import test from 'node:test';
import assert from 'node:assert/strict';

test('setup renders Career Eleven without a personal default name',async()=>{
  const root={innerHTML:''};
  globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.document={querySelector(sel){return sel==='#app'?root:null;},querySelectorAll(){return[];},addEventListener(){},body:{appendChild(){}},createElement(){return{className:'',textContent:'',remove(){}};}};
  globalThis.confirm=()=>true;globalThis.performance={now:()=>0};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  await import(`../app.js?smoke=${Date.now()}`);
  assert.match(root.innerHTML,/CAREER ELEVEN|MODO CARRERA/);
  assert.doesNotMatch(root.innerHTML,/Stefano/);
  assert.match(root.innerHTML,/11 CONTRA 11/);
});
