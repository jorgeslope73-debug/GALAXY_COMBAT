'use strict';
(() => {
  // V21.80: una sola fuente de verdad para la campaña CPU.
  // Añadir un nivel nuevo debe requerir, como norma, añadir una entrada aqui
  // y sus traducciones. La logica, IA y fisicas consumen estos datos sin
  // codificar numeros de nivel concretos.
  const levels=[
    {
      id:1,nameKey:'campaignWorld1',
      background:{file:'assets/sprites/fondo.jpg',mobileKey:'bg',stars:true},
      ufos:0,
      hazards:{
        asteroidMin:1,
        asteroidInitialMin:18,asteroidInitialMax:24,
        asteroidRespawnMin:4,asteroidRespawnMax:12,
        asteroidPopulationMin:22,asteroidPopulationMax:48,
        firstShowerMin:120,firstShowerMax:160,
        showerRepeatMin:120,showerRepeatMax:160,
        showerDuration:7,
        meteorIntervalMin:.28,meteorIntervalMax:.42,
        giantFirstMin:70,giantFirstMax:100,
        giantRepeatMin:150,giantRepeatMax:200
      }
    },
    {
      id:2,nameKey:'campaignWorld2',
      background:{file:'assets/sprites/fondo02.jpg',mobileKey:'bg02',stars:false},
      ufos:1,
      hazards:{
        asteroidMin:2,
        asteroidInitialMin:16,asteroidInitialMax:21,
        asteroidRespawnMin:4,asteroidRespawnMax:10,
        asteroidPopulationMin:20,asteroidPopulationMax:42,
        firstShowerMin:90,firstShowerMax:125,
        showerRepeatMin:90,showerRepeatMax:130,
        showerDuration:7.5,
        meteorIntervalMin:.26,meteorIntervalMax:.36,
        giantFirstMin:60,giantFirstMax:85,
        giantRepeatMin:125,giantRepeatMax:165
      }
    },
    {
      id:3,nameKey:'campaignWorld3',
      background:{file:'assets/sprites/fondo03.jpg',mobileKey:'bg03',stars:false},
      ufos:2,
      hazards:{
        asteroidMin:3,
        asteroidInitialMin:13,asteroidInitialMax:18,
        asteroidRespawnMin:3.5,asteroidRespawnMax:8.5,
        asteroidPopulationMin:18,asteroidPopulationMax:34,
        firstShowerMin:65,firstShowerMax:95,
        showerRepeatMin:65,showerRepeatMax:100,
        showerDuration:8,
        meteorIntervalMin:.22,meteorIntervalMax:.32,
        giantFirstMin:50,giantFirstMax:70,
        giantRepeatMin:100,giantRepeatMax:135
      }
    },
    {
      id:4,nameKey:'campaignWorld4',
      background:{file:'assets/sprites/fondo04.jpg',mobileKey:'bg04',stars:false},
      ufos:3,
      hazards:{
        asteroidMin:4,
        asteroidInitialMin:10,asteroidInitialMax:15,
        asteroidRespawnMin:3,asteroidRespawnMax:7,
        asteroidPopulationMin:15,asteroidPopulationMax:28,
        firstShowerMin:45,firstShowerMax:70,
        showerRepeatMin:45,showerRepeatMax:75,
        showerDuration:9,
        meteorIntervalMin:.18,meteorIntervalMax:.28,
        giantFirstMin:40,giantFirstMax:55,
        giantRepeatMin:75,giantRepeatMax:105
      }
    },
    {
      id:5,nameKey:'campaignWorld5',
      background:{file:'assets/sprites/fondo05.jpg',mobileKey:'bg05',stars:false},
      ufos:3,
      hazards:{
        asteroidMin:5,
        asteroidInitialMin:8,asteroidInitialMax:12,
        asteroidRespawnMin:3,asteroidRespawnMax:6,
        asteroidPopulationMin:12,asteroidPopulationMax:24,
        firstShowerMin:35,firstShowerMax:55,
        showerRepeatMin:35,showerRepeatMax:60,
        showerDuration:10,
        meteorIntervalMin:.18,meteorIntervalMax:.26,
        giantFirstMin:30,giantFirstMax:45,
        giantRepeatMin:60,giantRepeatMax:90
      }
    }
  ];

  function getLevel(level){
    const n=Math.max(1,Math.min(levels.length,Math.round(Number(level)||1)));
    return levels[n-1];
  }

  window.GalaxyCampaign=Object.freeze({
    levels:Object.freeze(levels.map(level=>Object.freeze({
      ...level,
      background:Object.freeze({...level.background}),
      hazards:Object.freeze({...level.hazards})
    }))),
    getLevel,
    count:levels.length
  });
})();