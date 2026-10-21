'use strict';
// Canonical source: server/net-protocol.js. The identical docs copy serves Pages.
((root,factory)=>{
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GalaxyNetProtocol=api;
})(typeof window!=='undefined'?window:globalThis,()=>{
  const VERSION=2;
  const HOST_EVENTS=new Set(['victory','restarted','sound','brutal','pickup','shock-perfect','shock-cancel','intercept','shield-break','hunter','pointblank','flare-kill','hunt','cpu-learning']);
  const INPUT_ACTIONS=new Set(['rocket','flare','shock']);
  const validId=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
  const counter=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
  function context(source){
    return {protocolVersion:VERSION,seriesId:String(source.seriesId||''),hostEpoch:Number(source.hostEpoch),rankRound:Number(source.rankRound??source.round??0)};
  }
  function stamp(source,payload){return {...payload,...context(source)};}
  function matches(packet,current,{futureRound=false,ignoreRound=false}={}){
    if(!packet||packet.protocolVersion!==VERSION||!validId(packet.seriesId)||packet.seriesId!==current.seriesId)return false;
    if(!counter(packet.hostEpoch,1)||packet.hostEpoch!==Number(current.hostEpoch)||!counter(packet.rankRound))return false;
    if(ignoreRound)return true;
    const round=Number(current.rankRound??current.round??0);
    return packet.rankRound===round||(futureRound&&packet.rankRound===round+1);
  }
  function phase(room){
    if(!room.started)return 'lobby';
    if(room.seriesComplete)return 'series-finished';
    return Number(room.seriesLastScoredRound)===Number(room.rankRound)?'round-finished':'playing';
  }
  class ReplayWindow{
    constructor(size=512){this.size=size;this.reset();}
    reset(){this.highest=0;this.seen=new Set();}
    accept(id){
      if(!counter(id,1)||id<=this.highest-this.size||this.seen.has(id))return false;
      this.highest=Math.max(this.highest,id);this.seen.add(id);
      for(const previous of this.seen)if(previous<=this.highest-this.size)this.seen.delete(previous);
      return true;
    }
  }
  return Object.freeze({VERSION,ACTION_TTL_MS:2000,ACTION_RETRY_MS:250,CRITICAL_RETRY_MS:750,validId,counter,context,stamp,matches,phase,ReplayWindow,isHostEvent:type=>HOST_EVENTS.has(type),isInputAction:kind=>INPUT_ACTIONS.has(kind)});
});
