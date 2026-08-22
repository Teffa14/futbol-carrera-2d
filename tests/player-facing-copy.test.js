import test from 'node:test';
import assert from 'node:assert/strict';
import {__playerFacingCopyV1} from '../player-facing-copy-v1.js';

const {replacementFor}=__playerFacingCopyV1;

test('removes implementation language from legacy visible copy',()=>{
  assert.equal(replacementFor('2D · 11v11 AUTOPLAY'),'CARRERA DE FUTBOLISTA');
  assert.equal(replacementFor('4 sesiones disponibles. Lo que subís acá cambia directamente el motor 11v11.'),'4 sesiones disponibles.');
  assert.equal(replacementFor('Versión local: perfiles ghost entran realmente al XI rival. La capa de cuentas/backend viene después.'),'Enfrentá planteles armados alrededor de otros futbolistas.');
  assert.equal(replacementFor('11 contra 11 autoplay. Los visores pesan más lo que hacés acá que los ejercicios aislados: decisiones, pérdidas, pases, duelos, goles, robos y puntaje.'),'Los visores te evalúan dentro de un equipo: decisiones, pérdidas, pases, duelos, goles, recuperaciones y rendimiento general.');
});

test('turns internal evaluation labels into football-facing copy',()=>{
  assert.equal(replacementFor('Prioridad 92 · disciplina 74'),'Objetivo del DT');
  assert.equal(replacementFor('Familiaridad 61 · 14 reps'),'Práctica 61 · 14 repeticiones');
  assert.equal(replacementFor('Entrenamiento A · st-profile-finish'),'Entrenamiento · Nota A');
  assert.equal(replacementFor('CM · Estado físico 91 · Confianza DT 67. El partido arranca siempre en x1.'),'CM · Estado físico 91 · Confianza DT 67.');
});

test('replaces generic or system-framed legacy labels',()=>{
  assert.equal(replacementFor('Tu jugador.'),'ELEGÍ TU PUESTO.');
  assert.equal(replacementFor('Tu carrera.'),'DESPUÉS GANÁTELO.');
  assert.equal(replacementFor('Tendencias de tu IA'),'Con pelota');
  assert.equal(replacementFor('IA que estás formando'),'Cómo estás jugando');
  assert.equal(replacementFor('PREVIEW DEL JUVENIL'),'TU JUVENIL');
});
