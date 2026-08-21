import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyDefensiveLines,evaluateLineBreak,lineBreakValue} from '../football-space-v1.js';

const d=(x,y,id)=>({x,y,id});

test('groups defenders into reusable depth lines and ignores isolated players',()=>{
  const defenders=[d(80,-55,'a'),d(84,0,'b'),d(79,52,'c'),d(150,-45,'d'),d(153,45,'e'),d(225,0,'keeper')];
  const lines=identifyDefensiveLines(defenders,{maxDepthGap:20,minLineSize:2});
  assert.equal(lines.length,2);
  assert.deepEqual(lines.map(l=>l.memberCount),[3,2]);
  assert.ok(lines[0].depth<lines[1].depth);
});

test('short forward progression through a compact line is recognized as a line break',()=>{
  const defenders=[d(100,-48),d(102,-16),d(99,18),d(101,50)];
  const result=evaluateLineBreak({x:94,y:0},{x:108,y:4},defenders,{maxDepthGap:10});
  assert.equal(result.isLineBreak,true);
  assert.equal(result.crossedLines.length,1);
  assert.ok(result.progress<20);
  assert.ok(lineBreakValue({x:94,y:0},{x:108,y:4},defenders,{maxDepthGap:10})>0);
});

test('going around the outside of a defensive line is progression but not a line break',()=>{
  const defenders=[d(100,-42),d(101,-12),d(99,18),d(102,46)];
  const result=evaluateLineBreak({x:82,y:110},{x:128,y:112},defenders,{maxDepthGap:10,lateralPadding:12});
  assert.equal(result.isLineBreak,false);
  assert.ok(result.progress>0);
});

test('backward movement never scores a line break',()=>{
  const defenders=[d(100,-35),d(101,0),d(99,35)];
  const result=evaluateLineBreak({x:125,y:0},{x:75,y:0},defenders,{maxDepthGap:10});
  assert.equal(result.isLineBreak,false);
  assert.equal(result.crossedLines.length,0);
  assert.ok(result.progress<0);
});

test('attack direction works symmetrically toward the opposite goal',()=>{
  const defenders=[d(-100,-40),d(-102,0),d(-99,40)];
  const result=evaluateLineBreak({x:-82,y:0},{x:-125,y:0},defenders,{attackDirection:-1,maxDepthGap:10});
  assert.equal(result.isLineBreak,true);
  assert.ok(result.progress>0);
});

test('one action can cross multiple organized lines',()=>{
  const defenders=[d(80,-42),d(82,0),d(79,42),d(142,-45),d(144,0),d(141,45)];
  const result=evaluateLineBreak({x:60,y:0},{x:165,y:0},defenders,{maxDepthGap:12});
  assert.equal(result.crossedLines.length,2);
  assert.ok(lineBreakValue({x:60,y:0},{x:165,y:0},defenders,{maxDepthGap:12})>2);
});
