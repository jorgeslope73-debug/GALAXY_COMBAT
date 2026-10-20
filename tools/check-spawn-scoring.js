'use strict';
const assert=require('node:assert/strict');
global.window=global;
require('../docs/physics-core.js');
require('../docs/host-physics.js');
require('../docs/local-cpu.js');
let seed=42;
Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(const Engine of [GalaxyHostPhysics,GalaxyLocalCpu]){
  const engine=Object.create(Engine.prototype);
  Object.assign(engine,{finished:false,activeShockwaves:[],players:[],asteroids:[],meteors:[],giant:null,fxClock:0});
  for(const method of ['noteCpuLoopDeath','emitShipImpact','dropDefeatedLoadout','emit','flushLearning','reportRankedVictory'])engine[method]=()=>{};
  const player=(index,kills)=>({index,kills,deaths:0,dead:false,protection:0,shield:0,cpu:false});
  let victim=player(0,3),attacker=player(1,1);
  engine.destroyShip(victim,attacker);
  assert.equal(victim.kills,2);assert.equal(attacker.kills,2);assert.equal(victim.deaths,1);
  engine.destroyShip(victim,attacker);
  assert.equal(victim.kills,2);assert.equal(attacker.kills,2);
  victim=player(0,0);engine.destroyShip(victim,attacker);assert.equal(victim.kills,0);
  victim=player(0,2);engine.destroyShip(victim);assert.equal(victim.kills,1);
  victim=player(0,2);engine.destroyShip(victim,victim);assert.equal(victim.kills,1);
  victim=player(0,2);victim.protection=3;engine.destroyShip(victim,attacker);
  assert.equal(victim.dead,false);assert.equal(victim.kills,2);
  const sectors=new Set(),choices=new Set();
  const cpu={index:0,cpu:true};
  for(let i=0;i<80;i++){
    engine.placeAtSpawn(cpu);
    sectors.add((cpu.x<960?'L':'R')+(cpu.y<540?'T':'B'));
    choices.add(cpu.openingFleeUntil>0);
    assert.ok(cpu.x>=0&&cpu.x<=1920&&cpu.y>=0&&cpu.y<=1080);
  }
  assert.equal(sectors.size,4);assert.equal(choices.size,2);
  Object.assign(cpu,{x:500,y:500,rot:90,dead:false,openingFleeUntil:0});
  const immune={index:1,x:600,y:500,protection:3,spawnFx:0,dead:false};
  engine.players=[cpu,immune];
  let c=engine.chooseCpuControls(cpu);
  assert.equal(c.fire,false);assert.equal(c.thrust,true);assert.equal(c.turn,0);
  immune.protection=0;immune.spawnFx=1;
  assert.equal(engine.chooseCpuControls(cpu).fire,false);
  // A traves del borde tambien se considera cercano.
  cpu.x=10;cpu.rot=270;immune.x=1910;
  c=engine.chooseCpuControls(cpu);assert.equal(c.turn,0);assert.equal(c.thrust,true);
  immune.spawnFx=0;
  assert.equal(GalaxyPhysicsCore.cpuSpawnEscapeControl(cpu,engine.players,10,1920,1080),null);
  victim=player(0,2);attacker=player(1,4);engine.destroyShip(victim,attacker);
  assert.equal(attacker.kills,5);assert.equal(engine.finished,true);
}
console.log('Bajas y apariciones OK en CPU local y host online.');
