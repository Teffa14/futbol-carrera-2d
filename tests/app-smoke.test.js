import test from 'node:test';
import assert from 'node:assert/strict';

test('browser app module renders setup without throwing',async()=>{
  const app={innerHTML:''};
  globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.document={
    querySelector(sel){return sel==='#app'?app:null;},
    querySelectorAll(){return[];},
    body:{appendChild(){}},
    createElement(){return{className:'',textContent:'',remove(){}};}
  };
  globalThis.confirm=()=>true;globalThis.prompt=()=>null;globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  await import('../app.js');
  assert.match(app.innerHTML,/CARRERA INTERACTIVA/);
  assert.match(app.innerHTML,/MOTOR 2D AUTOPLAY/);
});
