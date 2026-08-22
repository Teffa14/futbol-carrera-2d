import test from 'node:test';
import assert from 'node:assert/strict';
import {pitchPointFromClient,createEditorAction,editorMarkup} from '../tactical-lab-ui-v1.js';

test('pointer coordinates normalize and clamp to the tactical board',()=>{
  const rect={left:100,top:50,width:800,height:400};
  assert.deepEqual(pitchPointFromClient({clientX:500,clientY:250,rect}),{x:.5,y:.5});
  assert.deepEqual(pitchPointFromClient({clientX:0,clientY:900,rect}),{x:0,y:1});
});

test('visible editor creates compiler-compatible free-ball actions',()=>{
  const action=createEditorAction({id:'r1',type:'pass',actorId:'P6',start:{x:.4,y:.5},end:{x:.7,y:.3}});
  assert.equal(action.type,'pass');
  assert.equal(action.actorId,'P6');
  assert.equal('ownerId' in action,false);
  assert.equal('targetPlayerId' in action,false);
  assert.equal('velocity' in action,false);
});

test('editor markup exposes five tools and eleven players',()=>{
  const html=editorMarkup();
  for(const tool of ['run','pass','cross','shot','position'])assert.match(html,new RegExp(`data-tlab-tool="${tool}"`));
  for(let i=1;i<=11;i++)assert.match(html,new RegExp(`data-tlab-player="P${i}"`));
  assert.match(html,/id="tlab-board"/);
  assert.match(html,/Guardar jugada/);
  assert.doesNotMatch(html,/\b(?:motor|backend|IA|autoplay)\b/i);
});