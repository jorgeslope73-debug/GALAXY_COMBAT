'use strict';
(() => {
  const DATA = {
    es: {
      button:'MANUAL', title:'MANUAL DE JUEGO', subtitle:'Guía rápida para aprender a jugar y conocer las mejoras.', close:'CERRAR', contents:'CONTENIDO',
      sections:[
        {id:'objective',title:'1. Objetivo y partida',body:[
          'Galaxy Combat es un juego de combate espacial para 1 a 4 jugadores. Puedes jugar online con otras personas o contra la CPU.',
          'Gana el primer jugador que consiga 5 bajas. El marcador te indica cuántas llevas.',
          'Si te destruyen, reapareces al poco tiempo. Pierdes tus mejoras y tienes unos segundos de protección al volver.'
        ],tips:['Muévete siempre: una nave parada es un objetivo fácil.','Las mejoras flotantes pueden cambiar una partida; vigila el centro del escenario además de a tus rivales.']},
        {id:'controls',title:'2. Controles',body:[
          'PC: A / D o flechas izquierda / derecha para girar; W o flecha arriba para acelerar; CTRL o ESPACIO para disparar. ESC sale de la partida.',
          'Móvil: juega en horizontal. La inclinación del teléfono controla el giro y se calibra automáticamente al empezar. Un toque rápido en la pantalla dispara; mantén pulsado un poco más para acelerar mientras sigas tocando.',
          'Voz: actívala desde el menú. En PC mantén V para hablar. En móvil aparece un control de voz durante la partida; mantenlo pulsado para transmitir.'
        ],tips:['En móvil, coloca el teléfono como te resulte cómodo antes de empezar.','Si se corta la conexión, el juego intenta evitar que la nave se quede girando o acelerando sola.']},
        {id:'hud',title:'3. HUD, bajas y líder',body:[
          'Cada jugador tiene un panel del mismo color que su nave. Ahí ves tus balas, velocidad y bajas.',
          'Cuando consigues una baja, el marcador aumenta. Si mueres por un peligro del escenario puedes recibir una PENALIZACIÓN -1.',
          'Si hay un líder claro, su nombre aparece destacado.'
        ]},
        {id:'weapons',title:'4. Munición, disparos y BRUTAL',body:[
          'Empiezas la partida con 5 balas. Cada disparo consume una unidad de munición; recoge cápsulas para seguir atacando.',
          'La mejora de CADENCIA te permite disparar más rápido.',
          'Si aciertas un disparo desde muy lejos, aparece el aviso BRUTAL con la distancia del impacto.'
        ],tips:['No malgastes la última bala: sin munición pierdes capacidad ofensiva hasta encontrar otra cápsula.','Las balas desaparecen al salir del escenario y también pueden destruir meteoritos pequeños o eliminar mejoras flotantes.']},
        {id:'pickups',title:'5. Mejoras flotantes',body:[
          'Las mejoras aparecen por el escenario durante la partida. Recógelas antes de que desaparezcan.',
          'Los asteroides y meteoritos también pueden hacer desaparecer una mejora.'
        ],pickups:[
          ['ammo1','MUNICIÓN +1','Añade 1 bala a tu reserva.'],['ammo3','MUNICIÓN +6','Añade 6 balas a tu reserva.'],['cadence','CADENCIA','Dispara con mayor frecuencia; los niveles altos también aceleran el proyectil.'],['speed','VELOCIDAD','Aumenta la velocidad de la nave en pasos de +0,5 hasta un máximo de x2.'],['shield','ESCUDO','Protección durante 10 s contra disparos y muchos choques. Una nave protegida puede ser peligrosa en una embestida.'],['camo','INVISIBILIDAD','Solo online. Activa el modo fantasma durante 10 s. Se representa con un ojo tachado.']
        ]},
        {id:'ghost',title:'6. Modo fantasma',body:[
          'El modo fantasma dura 10 segundos y solo aparece en partidas online.',
          'Mientras estás en fantasma, los rivales apenas ven tu nave. Cada pocos segundos reaparece brevemente para que puedan localizarte.',
          'Tú seguirás viendo ligeramente tu propia nave para poder controlarla.'
        ],tips:['Cambia de dirección después de cada revelación para que los rivales no puedan anticipar tu trayectoria.']},
        {id:'hazards',title:'7. Asteroides y meteoritos',body:[
          'Los asteroides son peligrosos: si chocas sin protección pueden destruirte. Con escudo puedes rebotar.',
          'De vez en cuando aparece una lluvia de meteoritos. Muévete y busca huecos para esquivarla.',
          'Los meteoritos pequeños rebotan por el escenario y puedes destruirlos disparando.',
          'También puede cruzar un meteorito gigante que mueve asteroides y arrasa las mejoras que encuentra.'
        ]},
        {id:'death',title:'8. Muertes, penalizaciones y reaparición',body:[
          'Si otro jugador te destruye, consigue una baja. Si mueres por un peligro del escenario puedes perder 1 baja, pero nunca bajarás de 0.',
          'Al morir pierdes las balas y las mejoras que habías conseguido.',
          'Al reaparecer tienes unos segundos de protección para volver al combate.'
        ]},
        {id:'cpu',title:'9. Jugar contra la CPU',body:[
          'Puedes jugar contra la CPU en nivel FÁCIL, MEDIO o DIFÍCIL.',
          'La CPU busca munición cuando se queda sin balas y trata de evitar peligros.',
          'Con escudo puede intentar embestirte; con munición volverá a atacarte normalmente.'
        ]},
        {id:'online',title:'10. Online, salas, chat y voz',body:[
          'No necesitas registrarte para jugar. Puedes entrar como invitado y empezar una partida con el nombre que quieras, siempre que no esté reservado por otra cuenta.',
          'Si te registras, tu nombre queda reservado solo para ti y tus partidas válidas cuentan para el ranking.',
          'Para jugar online, escribe tu nombre y espera a que aparezca SERVIDOR CONECTADO. Pulsa CREAR PARTIDA y elige PÚBLICA o PRIVADA.',
          'Para entrar en una partida, pulsa UNIRSE. Elige una sala pública o escribe el código de una sala privada.',
          'Si una partida ya está en marcha con CPUs de relleno y queda alguna plaza CPU, también puedes entrar: sustituyes una CPU sin reiniciar la partida y comienzas con 0 bajas, 5 balas y mejoras a cero.',
          'En la sala podrás ver a los jugadores, usar el chat y activar la voz. El anfitrión pulsa EMPEZAR cuando todos estén listos.',
          'La voz funciona directamente dentro de la partida. Actívala desde el menú y mantén pulsado el control para hablar.',
          'Si pierdes la conexión durante unos segundos, el juego intenta devolverte a la misma partida automáticamente.'
        ],stepsTitle:'CREAR O UNIRSE PASO A PASO',steps:[
          ['1. Escribe tu nombre','Pon tu nombre y espera a que el servidor esté conectado.'],
          ['2. Crear una partida','Pulsa CREAR PARTIDA y elige PÚBLICA o PRIVADA.'],
          ['3. Sala privada','Comparte con tus amigos el código de 4 caracteres.'],
          ['4. Unirse a una pública','Pulsa UNIRSE y elige una partida de la lista.'],
          ['5. Unirse con código','Escribe el código de 4 caracteres para entrar en una sala privada.'],
          ['6. Esperar en la sala','Comprueba que están todos. Puedes usar chat y voz.'],
          ['7. Empezar','Cuando estén todos listos, el anfitrión pulsa EMPEZAR.']
        ],media:[
          ['assets/manual/portada.webp','Portada principal de Galaxy Combat.','Desde aquí puedes jugar contra la CPU, crear una partida online o unirte a una sala.'],
          ['assets/manual/crear-partida.webp','Botón Crear partida.','CREAR PARTIDA abre la elección entre sala pública y privada.'],
          ['assets/manual/unirse-sala.webp','Botón Unirse.','UNIRSE abre la lista de partidas públicas y la entrada por código para salas privadas.'],
          ['assets/manual/partida.webp','Ejemplo de una partida.','Una vez iniciada la sala, cada jugador conserva su HUD, color de nave y controles.']
        ],tips:['Si cambias de Wi-Fi a datos móviles, espera unos segundos antes de abandonar: la reconexión automática puede recuperar la partida.','En PC, V funciona como pulsar para hablar; en móvil usa el control de voz de pantalla.']},
        {id:'end',title:'11. Final de partida y revancha',body:[
          'Cuando alguien llega a 5 bajas termina la partida. Puedes repetir con los mismos jugadores o volver al menú.',
          'Al repetir, todos empiezan de nuevo desde cero.'
        ]},
        {id:'pwa',title:'12. Instalar como app',body:[
          'Puedes instalar Galaxy Combat como una app. En iPhone/iPad usa Safari > Compartir > Añadir a pantalla de inicio. En Android/Chrome usa Instalar aplicación.',
          'Desde el icono se abre con una pantalla más limpia. Juega siempre en horizontal.',
          'El juego guarda algunos archivos para abrir más rápido y comprueba las actualizaciones cuando vuelves a entrar.'
        ]},
        {id:'tips',title:'13. Consejos de combate',body:[
          'No persigas siempre en línea recta: usa los asteroides y cambia de dirección.',
          'Mira tus balas antes de perseguir a un rival.',
          'El escudo también puede servir para embestir a una nave sin protección.',
          'Si llevas buenas mejoras, a veces conviene esquivar y conservarlas.'
        ]}
      ]
    },
    en: {
      button:'MANUAL', title:'GAME MANUAL', subtitle:'Everything you need to pilot, survive and win in Galaxy Combat.', close:'CLOSE', contents:'CONTENTS',
      sections:[
        {id:'objective',title:'1. Objective and match',body:['Galaxy Combat is an arcade space combat game for 1 to 4 players. Online matches support 2 to 4 people, and you can also fight the CPU at three difficulty levels.','The first player to reach 5 kills wins. Each ship HUD shows its kills against the match target. If several players are tied for first place, there is no unique leader until someone moves ahead.','After being destroyed you respawn quickly, but you lose ammunition and collected upgrades. After respawning you receive a short protection window to re-enter the fight.'],tips:['Keep moving: a stationary ship is an easy target.','Floating upgrades can swing a match; watch the arena as well as your opponents.']},
        {id:'controls',title:'2. Controls',body:['PC: A / D or Left / Right arrows to turn; W or Up arrow to thrust; CTRL or SPACE to fire. ESC leaves the match.','Mobile: play in landscape. Phone tilt controls turning and is calibrated automatically when the match begins. A quick tap anywhere on the play area fires; hold a little longer to thrust while your finger stays down.','Voice: enable it from the main menu. On PC hold V to talk. On mobile a voice control appears during the match; hold it while speaking.'],tips:['On mobile, hold the phone in your comfortable playing position before the match starts: that position becomes the reference.','Server controls expire if updates stop arriving, preventing stuck thrust or turning after a connection issue.']},
        {id:'hud',title:'3. HUD, kills and leader',body:['Each player has a HUD matching their ship color. It shows ammunition, speed and kills. Left-side players use the left HUD; right-side players use the right HUD.','When you score a kill, the new value appears in sync with a large scale animation. If an environmental death costs you a kill, PENALTY -1 appears first and the HUD updates afterward with its effect.','When there is one clear leader, a leader announcement appears. The leader name also pulses gently in the HUD.']},
        {id:'weapons',title:'4. Ammunition, shots and BRUTAL',body:['You start a match with 5 bullets. Every shot consumes one ammo unit; collect capsules to keep attacking.','The fire-rate upgrade reduces the delay between shots. At advanced levels it also increases projectile speed, making an upgraded player much more dangerous.','A very long-range kill triggers BRUTAL. The game measures the distance travelled by the bullet and displays it in metres, using an 8 m ship as the reference. The current threshold is roughly 142 m.'],tips:['Do not waste your last bullet: with no ammo you lose your ranged threat until you find another capsule.','Bullets vanish outside the arena and can also destroy small meteors or remove floating pickups.']},
        {id:'pickups',title:'5. Floating upgrades',body:['Upgrades appear around the arena periodically. Up to 5 can exist at once. When the oldest one is about to be replaced, it blinks during its final 2 seconds between 50% and 100% opacity.','Asteroids and meteors can remove pickups by crossing them, so an opportunity may disappear before you reach it.'],pickups:[['ammo1','AMMO +1','Adds 1 bullet to your reserve.'],['ammo3','AMMO +6','Adds 6 bullets to your reserve.'],['cadence','FIRE RATE','Lets you fire more often; higher levels also speed up projectiles.'],['speed','SPEED','Raises ship speed in +0.5 steps up to x2.'],['shield','SHIELD','Protects for 10 s against shots and many collisions. A shielded ship can be dangerous in a ram.'],['camo','INVISIBILITY','Online only. Activates ghost mode for 10 s. Shown as a crossed-out eye.']]},
        {id:'ghost',title:'6. Ghost mode',body:['Invisibility lasts 10 seconds and is only available in online matches. Opponents cannot see your ship continuously.','While a player is in ghost mode, a semi-transparent pill matching that player color appears beside their HUD with the word GHOST. The invisible ship briefly reveals itself periodically, about every 4 seconds, so opponents can relocate it.','Your own ship remains partially visible to you so you can steer accurately.'],tips:['Change direction after each reveal so opponents cannot predict your path.']},
        {id:'hazards',title:'7. Asteroids and meteors',body:['Large asteroids are permanent arena hazards. Hitting one without protection can destroy your ship; with a shield you bounce away and get an impact effect.','The first meteor shower begins 2 to 3 minutes after the match starts and lasts about 7 seconds. Every later shower waits another random 2 to 3 minute interval.','Small meteors cross the arena, bounce off asteroids and the giant meteor, can destroy floating pickups, and can be destroyed by bullets.','A giant meteor also crosses the arena periodically, pushes asteroids and removes pickups in its path.']},
        {id:'death',title:'8. Deaths, penalties and respawn',body:['If another player destroys you, the attacker gains one kill. If you die to an arena hazard, an uncredited collision or an equivalent event, you lose 1 kill if you had one; the score never drops below 0.','When destroyed you lose ammo, speed upgrades, fire-rate upgrades, shield and invisibility. You respawn with upgrades reset and no ammunition, so rebuilding your resources matters.','After respawning you have about 3 seconds of protection, preventing an unlucky spawn from immediately killing you again.']},
        {id:'cpu',title:'9. Playing against the CPU',body:['Choose EASY, MEDIUM or HARD. The CPU avoids hazards and changes priorities based on its resources.','With no bullets and no shield, the CPU should not chase you: it searches for ammunition. If no ammo pickup exists, it flees and tries to keep its distance until one appears.','With a shield but no bullets, it may try to ram you only when you have no shield or spawn protection. If you are protected it keeps searching or avoiding combat. With bullets it returns to normal offensive behavior.']},
        {id:'online',title:'10. Online, rooms, chat and voice',body:[
          'To create an online game, first enter your name and wait until the server status says it is ready. Then press CREATE GAME. Choose PUBLIC so the room appears in the public list, or PRIVATE so it can only be opened with its 4-character code.',
          'To join a game, press JOIN. You will see available public rooms with the flag of the language in which each room was created. Press JOIN on the room you want, or enter a 4-character code below for a private room.',
          'A match already in progress can remain joinable when it uses CPU fill. If a CPU slot is free, you replace that CPU without restarting the match and enter with 0 kills, 5 bullets and no upgrades.',
          'After joining a room you enter the lobby. There you can see connected players, use text chat and enable voice. The host presses START when enough players are ready.',
          'Voice uses WebRTC. STUN handles many direct connections and TURN can provide a fallback route when configured. With up to four players, voice uses a P2P mesh.',
          'If the WebSocket drops during a match, the server keeps your slot for about 30 seconds and automatically tries to restore the same ship, score, ammo and upgrades.'
        ],stepsTitle:'CREATE OR JOIN - STEP BY STEP',steps:[
          ['1. Enter your name','On the main screen type the name you want to use and wait until the server status shows that it is ready.'],
          ['2. Create a game','Press CREATE GAME. Choose PUBLIC so anyone can find it in the list, or PRIVATE if you only want to share the room code.'],
          ['3. Share a private room','A private room does not appear in the public list. Share the 4-character room code shown in the lobby with your friends.'],
          ['4. Join a public room','Press JOIN. The public game browser opens. Choose an available room and press its JOIN button. The flag shows the language in which the room was created.'],
          ['5. Join with a code','In the same JOIN window, enter the 4-character code in the code field and confirm. This takes you directly into a private room.'],
          ['6. Wait in the lobby','Check that all players are present. You can use text chat and enable voice. Only the host gets the control used to start the match.'],
          ['7. Start','When everyone is ready, the host presses START. On mobile, keep the phone in landscape; motion steering calibrates automatically as the match begins.']
        ],media:[
          ['assets/manual/portada.webp','Galaxy Combat main screen.','From here you can play the CPU, create an online game or join a room.'],
          ['assets/manual/crear-partida.webp','Create Game button.','CREATE GAME opens the choice between a public and a private room.'],
          ['assets/manual/unirse-sala.webp','Join button.','JOIN opens the public room browser and the code entry for private rooms.'],
          ['assets/manual/partida.webp','Example match.','Once the room starts, every player keeps their HUD, ship colour and controls.']
        ],tips:['If you switch from Wi-Fi to mobile data, wait a few seconds before leaving: automatic reconnection may restore the match.','On PC, V is push-to-talk; on mobile use the on-screen voice control.']},
        {id:'end',title:'11. Match end and rematch',body:['When someone reaches 5 kills, the victory screen appears. Choose PLAY AGAIN to reset the same room with the same players, or MAIN MENU to leave.','A rematch resets scores, ammo, upgrades, meteors, asteroids and spawn positions so the new round starts cleanly.']},
        {id:'pwa',title:'12. Install as an app',body:['Galaxy Combat is a PWA. On iPhone/iPad open it in Safari, tap Share and choose Add to Home Screen. On Android/Chrome use Install app or Add to Home screen.','Launching from the icon feels more like an app with less browser chrome. The game is designed for landscape orientation.','Core code uses network-first loading to avoid stale versions, while images, sounds and fonts are cached for faster startup.']},
        {id:'tips',title:'13. Combat tips',body:['Do not always chase in a straight line: use asteroids as cover and vary your path to make shots miss.','Check your ammunition before starting a chase. An unarmed rival is vulnerable, but attacking without resources can expose you to collisions and meteors.','A shield is not only defensive: it can create a ramming opportunity against an unprotected ship.','Speed and fire-rate upgrades are powerful, but dying resets them. Sometimes avoiding a fight is the best way to preserve an advantage.']}
      ]
    },
    it: {
      button:'MANUALE', title:'MANUALE DI GIOCO', subtitle:'Tutto quello che serve per pilotare, sopravvivere e vincere in Galaxy Combat.', close:'CHIUDI', contents:'CONTENUTI',
      sections:[
        {id:'objective',title:'1. Obiettivo e partita',body:['Galaxy Combat è un combattimento spaziale arcade da 1 a 4 giocatori. Online possono giocare da 2 a 4 persone; puoi anche affrontare la CPU con tre livelli di difficoltà.','Vince il primo giocatore che raggiunge 5 eliminazioni. L HUD di ogni nave mostra le eliminazioni rispetto all obiettivo. In caso di parità in testa non esiste un leader unico finché qualcuno non passa avanti.','Dopo la distruzione riappari rapidamente, ma perdi munizioni e potenziamenti. Al respawn hai un breve periodo di protezione per rientrare in combattimento.'],tips:['Resta in movimento: una nave ferma è un bersaglio facile.','I potenziamenti fluttuanti possono cambiare la partita: controlla l arena oltre ai rivali.']},
        {id:'controls',title:'2. Comandi',body:['PC: A / D o frecce sinistra / destra per girare; W o freccia su per accelerare; CTRL o SPAZIO per sparare. ESC esce dalla partita.','Mobile: gioca in orizzontale. L inclinazione del telefono controlla la rotazione e viene calibrata automaticamente all inizio. Un tocco rapido sullo schermo spara; tieni premuto un po più a lungo per accelerare finché il dito resta appoggiato.','Voce: attivala dal menu. Su PC tieni premuto V per parlare. Su mobile compare un controllo vocale durante la partita; tienilo premuto mentre parli.'],tips:['Su mobile, tieni il telefono nella posizione comoda prima dell inizio: quella posizione diventa il riferimento.','I comandi sul server scadono se smettono di arrivare aggiornamenti, evitando accelerazione o rotazione bloccate.']},
        {id:'hud',title:'3. HUD, eliminazioni e leader',body:['Ogni giocatore ha un HUD dello stesso colore della nave. Mostra munizioni, velocità ed eliminazioni. I giocatori a sinistra usano l HUD sinistro e quelli a destra l HUD destro.','Quando ottieni un eliminazione, il nuovo valore appare insieme a una forte animazione di scala. Se una morte ambientale ti costa un punto, appare prima PENALITÀ -1 e poi si aggiorna l HUD.','Quando esiste un leader unico compare un avviso e il suo nome pulsa leggermente nell HUD.']},
        {id:'weapons',title:'4. Munizioni, colpi e BRUTAL',body:['Inizi con 5 proiettili. Ogni sparo consuma una munizione; raccogli capsule per continuare ad attaccare.','Il potenziamento cadenza riduce il tempo tra i colpi. Ai livelli avanzati aumenta anche la velocità del proiettile.','Un eliminazione da distanza molto lunga attiva BRUTAL. Il gioco misura il percorso del proiettile e lo mostra in metri usando una nave da 8 m come riferimento. La soglia attuale è circa 142 m.'],tips:['Non sprecare l ultima munizione: senza colpi perdi la minaccia a distanza finché non trovi una capsula.','I proiettili spariscono fuori dall arena e possono distruggere meteore piccole o eliminare potenziamenti.']},
        {id:'pickups',title:'5. Potenziamenti fluttuanti',body:['I potenziamenti compaiono periodicamente. Possono essercene fino a 5 contemporaneamente. Quando il più vecchio sta per essere sostituito, lampeggia negli ultimi 2 secondi tra il 50% e il 100% di opacità.','Asteroidi e meteore possono eliminare i potenziamenti attraversandoli.'],pickups:[['ammo1','MUNIZIONI +1','Aggiunge 1 proiettile alla riserva.'],['ammo3','MUNIZIONI +6','Aggiunge 6 proiettili alla riserva.'],['cadence','CADENZA','Permette di sparare più spesso; i livelli alti accelerano anche i proiettili.'],['speed','VELOCITÀ','Aumenta la velocità in passi di +0,5 fino a x2.'],['shield','SCUDO','Protegge per 10 s da colpi e molte collisioni. Una nave protetta può essere pericolosa in una speronata.'],['camo','INVISIBILITÀ','Solo online. Attiva la modalità fantasma per 10 s. È indicata da un occhio barrato.']]},
        {id:'ghost',title:'6. Modalità fantasma',body:['L invisibilità dura 10 secondi ed è disponibile solo online. Gli avversari non vedono la tua nave in modo continuo.','Durante la modalità fantasma compare accanto all HUD una pillola semitrasparente del colore del giocatore con la scritta FANTASMA. La nave invisibile si rivela brevemente circa ogni 4 secondi.','La tua nave resta parzialmente visibile a te per permettere un controllo preciso.'],tips:['Cambia direzione dopo ogni rivelazione per rendere imprevedibile la traiettoria.']},
        {id:'hazards',title:'7. Asteroidi e meteore',body:['Gli asteroidi grandi sono pericoli permanenti. Una collisione senza protezione può distruggerti; con lo scudo rimbalzi e compare un effetto d impatto.','La prima pioggia di meteore inizia tra 2 e 3 minuti e dura circa 7 secondi. Le successive aspettano ogni volta un altro intervallo casuale di 2-3 minuti.','Le meteore piccole attraversano l arena, rimbalzano contro asteroidi e meteorite gigante, possono distruggere potenziamenti e possono essere abbattute dai proiettili.','Un meteorite gigante attraversa periodicamente lo scenario, sposta gli asteroidi ed elimina i potenziamenti sul suo percorso.']},
        {id:'death',title:'8. Morti, penalità e respawn',body:['Se un altro giocatore ti distrugge, l attaccante guadagna un eliminazione. Se muori per un pericolo dello scenario o per una collisione senza attaccante, perdi 1 eliminazione se ne avevi; il punteggio non scende mai sotto 0.','Alla morte perdi munizioni, velocità, cadenza, scudo e invisibilità. Riappari con i potenziamenti azzerati e senza munizioni.','Dopo il respawn hai circa 3 secondi di protezione.']},
        {id:'cpu',title:'9. Giocare contro la CPU',body:['Scegli FACILE, MEDIO o DIFFICILE. La CPU evita gli ostacoli e cambia priorità in base alle risorse.','Senza munizioni e senza scudo non ti insegue: cerca munizioni. Se non ce ne sono, fugge e prova a mantenere le distanze.','Con scudo ma senza munizioni può tentare una speronata solo se tu non hai scudo né protezione. Con munizioni torna al comportamento offensivo.']},
        {id:'online',title:'10. Online, stanze, chat e voce',body:[
          'Per creare una partita online, inserisci prima il tuo nome e aspetta che lo stato del server indichi che è pronto. Poi premi CREA PARTITA. Scegli PUBBLICA per farla comparire nell elenco oppure PRIVATA per permettere l accesso solo tramite il codice di 4 caratteri.',
          'Per entrare in una partita, premi ENTRA. Vedrai le stanze pubbliche disponibili con la bandiera della lingua in cui sono state create. Premi ENTRA sulla stanza desiderata oppure inserisci in basso il codice di 4 caratteri di una stanza privata.',
          'Una partita già iniziata può restare accessibile se usa CPU di riempimento. Se c è un posto CPU libero, sostituisci quella CPU senza riavviare la partita ed entri con 0 eliminazioni, 5 proiettili e nessun potenziamento.',
          'Dopo l ingresso passerai alla lobby. Qui vedrai i giocatori connessi, potrai usare la chat e attivare la voce. L host preme INIZIA quando ci sono abbastanza giocatori.',
          'La voce usa WebRTC: STUN gestisce molte connessioni dirette e TURN può fornire una via di riserva quando configurato. Con massimo quattro giocatori si usa una mesh P2P.',
          'Se il WebSocket cade durante la partita, il server conserva il posto per circa 30 secondi e tenta di recuperare automaticamente la stessa nave, punteggio, munizioni e potenziamenti.'
        ],stepsTitle:'CREARE O ENTRARE - PASSO PER PASSO',steps:[
          ['1. Inserisci il nome','Nella schermata principale scrivi il nome con cui vuoi apparire e aspetta che il server risulti pronto.'],
          ['2. Crea una partita','Premi CREA PARTITA. Scegli PUBBLICA per renderla visibile nell elenco oppure PRIVATA se vuoi condividere solo il codice della stanza.'],
          ['3. Condividi una stanza privata','Una stanza privata non compare nell elenco pubblico. Condividi con gli amici il codice di 4 caratteri mostrato nella lobby.'],
          ['4. Entra in una pubblica','Premi ENTRA. Si apre il browser delle partite pubbliche. Scegli una stanza e premi ENTRA. La bandiera indica la lingua in cui è stata creata.'],
          ['5. Entra con codice','Nella stessa finestra, inserisci il codice di 4 caratteri nell apposito campo e conferma per entrare direttamente in una stanza privata.'],
          ['6. Attendi nella lobby','Controlla che tutti i giocatori siano presenti. Puoi usare la chat e attivare la voce. Solo l host dispone del comando per iniziare.'],
          ['7. Inizia','Quando tutti sono pronti, l host preme INIZIA. Su mobile usa lo schermo in orizzontale; il movimento si calibra automaticamente all avvio.']
        ],media:[
          ['assets/manual/portada.webp','Schermata principale di Galaxy Combat.','Da qui puoi giocare contro la CPU, creare una partita online o entrare in una stanza.'],
          ['assets/manual/crear-partida.webp','Pulsante Crea partita.','CREA PARTITA permette di scegliere tra stanza pubblica e privata.'],
          ['assets/manual/unirse-sala.webp','Pulsante Entra.','ENTRA apre l elenco delle stanze pubbliche e l ingresso tramite codice.'],
          ['assets/manual/partida.webp','Esempio di partita.','Dopo l avvio ogni giocatore mantiene il proprio HUD, colore della nave e controlli.']
        ],tips:['Se passi da Wi-Fi a rete mobile, aspetta qualche secondo prima di uscire: la riconnessione automatica può recuperare la partita.','Su PC V è push-to-talk; su mobile usa il controllo vocale sullo schermo.']},
        {id:'end',title:'11. Fine partita e rivincita',body:['Quando qualcuno raggiunge 5 eliminazioni compare la vittoria. Puoi scegliere RIGIOCA per riavviare la stessa stanza o MENU PRINCIPALE per uscire.','La rivincita azzera punteggi, munizioni, potenziamenti, meteore, asteroidi e posizioni.']},
        {id:'pwa',title:'12. Installare come app',body:['Galaxy Combat è una PWA. Su iPhone/iPad apri il gioco in Safari, premi Condividi e scegli Aggiungi alla schermata Home. Su Android/Chrome usa Installa app o Aggiungi a schermata Home.','Dal suo icono si apre con meno interfaccia del browser. Il gioco è pensato per l orientamento orizzontale.','Il codice principale usa priorità alla rete per evitare versioni obsolete, mentre immagini, suoni e font vengono memorizzati in cache.']},
        {id:'tips',title:'13. Consigli di combattimento',body:['Non inseguire sempre in linea retta: usa gli asteroidi come copertura e varia la traiettoria.','Controlla le munizioni prima di iniziare un inseguimento.','Lo scudo non è solo difensivo: può creare un opportunità di speronata contro una nave senza protezione.','Velocità e cadenza sono potenti, ma la morte le azzera: a volte evitare lo scontro è la scelta migliore.']}
      ]
    },
    fr: {
      button:'MANUEL', title:'MANUEL DE JEU', subtitle:'Tout ce qu il faut pour piloter, survivre et gagner dans Galaxy Combat.', close:'FERMER', contents:'SOMMAIRE',
      sections:[
        {id:'objective',title:'1. Objectif et partie',body:['Galaxy Combat est un jeu de combat spatial arcade pour 1 à 4 joueurs. En ligne, 2 à 4 personnes peuvent jouer; tu peux aussi affronter le CPU avec trois niveaux de difficulté.','Le premier joueur à atteindre 5 éliminations gagne. Le HUD de chaque vaisseau affiche ses éliminations par rapport à l objectif. En cas d égalité en tête, il n y a pas de leader unique.','Après destruction tu réapparais rapidement, mais tu perds munitions et améliorations. Après le respawn tu disposes d une courte protection.'],tips:['Reste en mouvement: un vaisseau immobile est une cible facile.','Les améliorations flottantes peuvent retourner une partie; surveille l arène autant que les adversaires.']},
        {id:'controls',title:'2. Commandes',body:['PC: A / D ou flèches gauche / droite pour tourner; W ou flèche haut pour accélérer; CTRL ou ESPACE pour tirer. ESC quitte la partie.','Mobile: joue en paysage. L inclinaison du téléphone contrôle la rotation et se calibre automatiquement au début. Une touche rapide sur l écran tire; maintiens un peu plus longtemps pour accélérer tant que le doigt reste posé.','Voix: active-la depuis le menu. Sur PC maintiens V pour parler. Sur mobile un contrôle vocal apparaît pendant la partie.'],tips:['Sur mobile, tiens le téléphone dans ta position de jeu confortable avant le départ: elle devient la référence.','Les commandes expirent côté serveur si les mises à jour cessent, évitant une accélération ou rotation bloquée.']},
        {id:'hud',title:'3. HUD, éliminations et leader',body:['Chaque joueur possède un HUD de la couleur de son vaisseau. Il indique munitions, vitesse et éliminations.','Quand tu obtiens une élimination, la nouvelle valeur apparaît avec une grande animation d échelle. Si une mort environnementale te retire un point, PÉNALITÉ -1 apparaît avant la mise à jour du HUD.','Lorsqu il existe un leader unique, une annonce apparaît et son nom pulse légèrement dans le HUD.']},
        {id:'weapons',title:'4. Munitions, tirs et BRUTAL',body:['Tu commences avec 5 balles. Chaque tir consomme une munition; récupère des capsules pour continuer à attaquer.','L amélioration de cadence réduit le délai entre les tirs. Aux niveaux avancés elle augmente aussi la vitesse du projectile.','Une élimination à très longue distance déclenche BRUTAL. La distance parcourue par la balle est affichée en mètres en prenant un vaisseau de 8 m comme référence. Le seuil actuel est d environ 142 m.'],tips:['Évite de gaspiller ta dernière balle.','Les tirs disparaissent hors de l arène et peuvent aussi détruire de petites météorites ou supprimer des améliorations flottantes.']},
        {id:'pickups',title:'5. Améliorations flottantes',body:['Les améliorations apparaissent périodiquement. Il peut y en avoir jusqu à 5. Quand la plus ancienne va être remplacée, elle clignote pendant ses 2 dernières secondes entre 50 % et 100 % d opacité.','Astéroïdes et météorites peuvent faire disparaître une amélioration en la traversant.'],pickups:[['ammo1','MUNITIONS +1','Ajoute 1 balle à la réserve.'],['ammo3','MUNITIONS +6','Ajoute 6 balles à la réserve.'],['cadence','CADENCE','Permet de tirer plus souvent; les niveaux élevés accélèrent aussi les projectiles.'],['speed','VITESSE','Augmente la vitesse par pas de +0,5 jusqu à x2.'],['shield','BOUCLIER','Protège pendant 10 s contre les tirs et de nombreuses collisions.'],['camo','INVISIBILITÉ','En ligne uniquement. Active le mode fantôme pendant 10 s. Icône: œil barré.']]},
        {id:'ghost',title:'6. Mode fantôme',body:['L invisibilité dure 10 secondes et n existe qu en ligne. Les adversaires ne voient pas ton vaisseau en continu.','Pendant ce mode, une pastille semi-transparente de la couleur du joueur apparaît près de son HUD avec le texte FANTÔME. Le vaisseau invisible se révèle brièvement environ toutes les 4 secondes.','Ton propre vaisseau reste partiellement visible pour toi.'],tips:['Change de direction après chaque révélation pour rendre ta trajectoire difficile à prévoir.']},
        {id:'hazards',title:'7. Astéroïdes et météorites',body:['Les gros astéroïdes sont des dangers permanents. Sans protection, un choc peut te détruire; avec un bouclier tu rebondis.','La première pluie de météorites commence entre 2 et 3 minutes et dure environ 7 secondes. Les suivantes attendent chacune un nouvel intervalle aléatoire de 2 à 3 minutes.','Les petites météorites traversent l arène, rebondissent sur les astéroïdes et la météorite géante, peuvent supprimer des améliorations et peuvent être détruites par les tirs.','Une météorite géante traverse aussi périodiquement le terrain, pousse les astéroïdes et supprime les améliorations sur son passage.']},
        {id:'death',title:'8. Morts, pénalités et respawn',body:['Si un autre joueur te détruit, il gagne une élimination. Si tu meurs à cause du décor ou d une collision sans attaquant, tu perds 1 élimination si tu en avais; le score ne descend jamais sous 0.','À la mort tu perds munitions, vitesse améliorée, cadence, bouclier et invisibilité. Tu réapparais sans munition et avec les améliorations réinitialisées.','Après le respawn tu disposes d environ 3 secondes de protection.']},
        {id:'cpu',title:'9. Jouer contre le CPU',body:['Choisis FACILE, MOYEN ou DIFFICILE. Le CPU évite les obstacles et change de priorité selon ses ressources.','Sans munitions ni bouclier, il ne te poursuit pas: il cherche des munitions. S il n y en a pas, il fuit et garde ses distances.','Avec un bouclier mais sans munitions, il peut tenter de te percuter seulement si tu n as ni bouclier ni protection. Avec des balles il reprend son comportement offensif.']},
        {id:'online',title:'10. En ligne, salles, chat et voix',body:[
          'Pour créer une partie en ligne, saisis d abord ton nom et attends que le serveur indique qu il est prêt. Appuie ensuite sur CRÉER UNE PARTIE. Choisis PUBLIQUE pour apparaître dans la liste ou PRIVÉE pour autoriser uniquement l accès par code à 4 caractères.',
          'Pour rejoindre une partie, appuie sur REJOINDRE. Tu verras les salles publiques disponibles avec le drapeau de la langue dans laquelle elles ont été créées. Appuie sur REJOINDRE pour la salle souhaitée ou saisis un code à 4 caractères pour une salle privée.',
          'Une partie déjà commencée peut rester accessible si elle utilise des CPU de remplissage. S il reste une place CPU, tu la remplaces sans redémarrer la partie et tu arrives avec 0 élimination, 5 balles et aucune amélioration.',
          'Une fois dans la salle, tu arrives dans le lobby. Tu y vois les joueurs connectés, peux utiliser le chat texte et activer la voix. L hôte appuie sur DÉMARRER quand il y a assez de joueurs.',
          'La voix utilise WebRTC. STUN permet de nombreuses connexions directes et TURN peut servir de route de secours. Jusqu à quatre joueurs utilisent un maillage P2P.',
          'Si le WebSocket tombe pendant une partie, le serveur conserve ta place environ 30 secondes et tente de récupérer automatiquement le même vaisseau, score, munitions et améliorations.'
        ],stepsTitle:'CRÉER OU REJOINDRE - ÉTAPE PAR ÉTAPE',steps:[
          ['1. Saisis ton nom','Sur l écran principal, écris le nom que tu veux utiliser et attends que le serveur soit prêt.'],
          ['2. Crée une partie','Appuie sur CRÉER UNE PARTIE. Choisis PUBLIQUE pour être visible dans la liste ou PRIVÉE pour partager uniquement le code de salle.'],
          ['3. Partage une salle privée','Une salle privée n apparaît pas dans la liste publique. Envoie à tes amis le code à 4 caractères affiché dans le lobby.'],
          ['4. Rejoins une publique','Appuie sur REJOINDRE. Le navigateur de parties publiques s ouvre. Choisis une salle et appuie sur son bouton REJOINDRE. Le drapeau indique sa langue de création.'],
          ['5. Rejoins avec un code','Dans la même fenêtre, saisis le code à 4 caractères dans le champ prévu puis confirme pour entrer directement dans une salle privée.'],
          ['6. Attends dans le lobby','Vérifie que tous les joueurs sont présents. Tu peux écrire dans le chat et activer la voix. Seul l hôte dispose du contrôle de démarrage.'],
          ['7. Démarre','Quand tout le monde est prêt, l hôte appuie sur DÉMARRER. Sur mobile, reste en paysage; le mouvement se calibre automatiquement au lancement.']
        ],media:[
          ['assets/manual/portada.webp','Écran principal de Galaxy Combat.','Depuis cet écran, tu peux jouer contre le CPU, créer une partie en ligne ou rejoindre une salle.'],
          ['assets/manual/crear-partida.webp','Bouton Créer une partie.','CRÉER UNE PARTIE ouvre le choix entre salle publique et privée.'],
          ['assets/manual/unirse-sala.webp','Bouton Rejoindre.','REJOINDRE ouvre la liste des salles publiques et l entrée par code privé.'],
          ['assets/manual/partida.webp','Exemple de partie.','Une fois lancée, chaque joueur conserve son HUD, la couleur de son vaisseau et ses commandes.']
        ],tips:['Si tu passes du Wi-Fi aux données mobiles, attends quelques secondes avant de quitter.','Sur PC, V est le push-to-talk; sur mobile utilise le contrôle vocal à l écran.']},
        {id:'end',title:'11. Fin de partie et revanche',body:['Quand quelqu un atteint 5 éliminations, l écran de victoire apparaît. Choisis REJOUER pour relancer la même salle ou MENU PRINCIPAL pour quitter.','La revanche réinitialise scores, munitions, améliorations, météorites, astéroïdes et positions.']},
        {id:'pwa',title:'12. Installer comme application',body:['Galaxy Combat est une PWA. Sur iPhone/iPad ouvre le jeu dans Safari, touche Partager puis Sur l écran d accueil. Sur Android/Chrome utilise Installer l application ou Ajouter à l écran d accueil.','Depuis l icône le jeu ressemble davantage à une app et utilise moins d interface navigateur. Le mode paysage est recommandé.','Le code principal privilégie le réseau pour éviter les anciennes versions; images, sons et polices restent en cache pour accélérer le démarrage.']},
        {id:'tips',title:'13. Conseils de combat',body:['Ne poursuis pas toujours en ligne droite: utilise les astéroïdes comme couverture et varie ta trajectoire.','Vérifie tes munitions avant de poursuivre un rival.','Le bouclier peut aussi servir offensivement pour une collision contre un vaisseau non protégé.','Vitesse et cadence sont puissantes, mais la mort les réinitialise: préserver un avantage peut valoir mieux qu un duel risqué.']}
      ]
    },
    de: {
      button:'ANLEITUNG', title:'SPIELANLEITUNG', subtitle:'Alles, was du zum Fliegen, Überleben und Gewinnen in Galaxy Combat brauchst.', close:'SCHLIESSEN', contents:'INHALT',
      sections:[
        {id:'objective',title:'1. Ziel und Spiel',body:['Galaxy Combat ist ein Arcade-Weltraumkampf für 1 bis 4 Spieler. Online spielen 2 bis 4 Personen; außerdem kannst du gegen die CPU in drei Schwierigkeitsstufen antreten.','Wer zuerst 5 Abschüsse erreicht, gewinnt. Das HUD jedes Schiffs zeigt die Abschüsse im Verhältnis zum Spielziel. Bei Gleichstand gibt es keinen eindeutigen Anführer.','Nach der Zerstörung spawnst du schnell neu, verlierst aber Munition und gesammelte Verbesserungen. Nach dem Respawn erhältst du kurzzeitig Schutz.'],tips:['Bleib in Bewegung: ein stehendes Schiff ist ein leichtes Ziel.','Schwebende Verbesserungen können ein Spiel drehen; beobachte die Arena ebenso wie deine Gegner.']},
        {id:'controls',title:'2. Steuerung',body:['PC: A / D oder Pfeil links / rechts zum Drehen; W oder Pfeil hoch zum Beschleunigen; CTRL oder LEERTASTE zum Feuern. ESC verlässt das Spiel.','Mobil: spiele im Querformat. Die Neigung des Telefons steuert die Drehung und wird beim Spielstart automatisch kalibriert. Kurz auf den Spielbereich tippen feuert; etwas länger gedrückt halten beschleunigt, solange der Finger aufliegt.','Sprache: im Hauptmenü aktivieren. Auf PC V gedrückt halten zum Sprechen. Mobil erscheint während des Spiels eine Sprechtaste.'],tips:['Halte das Telefon vor dem Start in deiner bequemen Spielposition; diese wird als Referenz genommen.','Serverseitige Steuerbefehle laufen aus, wenn keine Updates mehr eintreffen, damit Schub oder Drehung nicht hängen bleiben.']},
        {id:'hud',title:'3. HUD, Abschüsse und Führung',body:['Jeder Spieler hat ein HUD in der Farbe seines Schiffs. Es zeigt Munition, Geschwindigkeit und Abschüsse.','Bei einem Abschuss erscheint der neue Wert synchron mit einer großen Skalierungsanimation. Kostet dich ein Umwelttod einen Punkt, erscheint zuerst STRAFE -1 und danach aktualisiert sich das HUD.','Gibt es einen eindeutigen Anführer, erscheint eine Meldung und sein Name pulsiert leicht im HUD.']},
        {id:'weapons',title:'4. Munition, Schüsse und BRUTAL',body:['Du startest mit 5 Schüssen. Jeder Schuss verbraucht eine Munition; sammle Kapseln, um weiter angreifen zu können.','Die Feuerraten-Verbesserung verkürzt die Zeit zwischen Schüssen. Höhere Stufen erhöhen zusätzlich die Projektilgeschwindigkeit.','Ein Abschuss aus sehr großer Entfernung löst BRUTAL aus. Die Flugstrecke der Kugel wird in Metern angezeigt, wobei ein 8-m-Schiff als Referenz dient. Die aktuelle Schwelle liegt bei etwa 142 m.'],tips:['Verschwende nicht deine letzte Kugel.','Kugeln verschwinden außerhalb der Arena und können kleine Meteore zerstören oder schwebende Verbesserungen entfernen.']},
        {id:'pickups',title:'5. Schwebende Verbesserungen',body:['Verbesserungen erscheinen regelmäßig. Maximal 5 können gleichzeitig vorhanden sein. Wenn die älteste gleich ersetzt wird, blinkt sie in den letzten 2 Sekunden zwischen 50 % und 100 % Deckkraft.','Asteroiden und Meteore können Verbesserungen beim Durchqueren zerstören.'],pickups:[['ammo1','MUNITION +1','Fügt 1 Schuss hinzu.'],['ammo3','MUNITION +6','Fügt 6 Schüsse hinzu.'],['cadence','FEUERRATE','Erlaubt häufigeres Feuern; hohe Stufen machen Projektile zusätzlich schneller.'],['speed','GESCHWINDIGKEIT','Erhöht die Schiffsgeschwindigkeit in +0,5-Schritten bis x2.'],['shield','SCHILD','Schützt 10 s lang vor Schüssen und vielen Kollisionen.'],['camo','UNSICHTBARKEIT','Nur online. Aktiviert 10 s lang den Geistmodus. Symbol: durchgestrichenes Auge.']]},
        {id:'ghost',title:'6. Geistmodus',body:['Unsichtbarkeit dauert 10 Sekunden und gibt es nur online. Gegner sehen dein Schiff nicht dauerhaft.','Im Geistmodus erscheint neben dem HUD eine halbtransparente Kapsel in Spielerfarbe mit dem Text GEIST. Das unsichtbare Schiff wird ungefähr alle 4 Sekunden kurz sichtbar.','Das eigene Schiff bleibt für den Spieler teilweise sichtbar, damit es präzise steuerbar bleibt.'],tips:['Ändere nach jeder Sichtbarkeit deine Richtung, damit Gegner die Flugbahn schlechter vorhersagen können.']},
        {id:'hazards',title:'7. Asteroiden und Meteore',body:['Große Asteroiden sind permanente Gefahren. Ohne Schutz kann eine Kollision das Schiff zerstören; mit Schild prallst du ab.','Der erste Meteorschauer beginnt nach 2 bis 3 Minuten und dauert etwa 7 Sekunden. Danach wartet jeder neue Schauer erneut zufällig 2 bis 3 Minuten.','Kleine Meteore fliegen durch die Arena, prallen an Asteroiden und dem Riesenmeteor ab, können Verbesserungen zerstören und können abgeschossen werden.','Zusätzlich zieht regelmäßig ein Riesenmeteor durch die Arena, verschiebt Asteroiden und entfernt Verbesserungen auf seinem Weg.']},
        {id:'death',title:'8. Tode, Strafen und Respawn',body:['Zerstört dich ein anderer Spieler, erhält der Angreifer einen Abschuss. Stirbst du durch eine Arenagefahr oder eine Kollision ohne Angreifer, verlierst du 1 Abschuss, falls du einen hattest; der Wert fällt nie unter 0.','Beim Tod verlierst du Munition, Geschwindigkeits- und Feuerratenverbesserungen, Schild und Unsichtbarkeit. Du spawnst ohne Munition und mit zurückgesetzten Verbesserungen.','Nach dem Respawn bist du ungefähr 3 Sekunden geschützt.']},
        {id:'cpu',title:'9. Gegen die CPU',body:['Wähle EINFACH, MITTEL oder SCHWER. Die CPU vermeidet Hindernisse und ändert ihre Prioritäten abhängig von ihren Ressourcen.','Ohne Munition und Schild verfolgt sie dich nicht: sie sucht Munition. Gibt es keine, flieht sie und versucht Abstand zu halten.','Mit Schild aber ohne Munition kann sie dich rammen, wenn du weder Schild noch Spawn-Schutz hast. Mit Munition kehrt sie zu ihrem offensiven Verhalten zurück.']},
        {id:'online',title:'10. Online, Räume, Chat und Sprache',body:[
          'Um ein Online-Spiel zu erstellen, gib zuerst deinen Namen ein und warte, bis der Server als bereit angezeigt wird. Drücke dann SPIEL ERSTELLEN. Wähle ÖFFENTLICH, damit der Raum in der Liste erscheint, oder PRIVAT, damit er nur mit dem 4-stelligen Code geöffnet werden kann.',
          'Um einem Spiel beizutreten, drücke BEITRETEN. Du siehst verfügbare öffentliche Räume mit der Flagge der Sprache, in der sie erstellt wurden. Drücke BEITRETEN beim gewünschten Raum oder gib unten den 4-stelligen Code eines privaten Raums ein.',
          'Ein bereits laufendes Spiel kann weiterhin beitretbar sein, wenn CPU-Auffüllung aktiv ist. Ist ein CPU-Platz frei, ersetzt du diese CPU ohne Neustart und steigst mit 0 Abschüssen, 5 Schüssen und ohne Verbesserungen ein.',
          'Nach dem Beitritt gelangst du in die Lobby. Dort siehst du verbundene Spieler, kannst den Textchat nutzen und Sprache aktivieren. Der Host drückt STARTEN, sobald genug Spieler bereit sind.',
          'Sprache nutzt WebRTC. STUN ermöglicht viele Direktverbindungen und TURN kann als Ausweichroute dienen. Bis zu vier Spieler nutzen ein P2P-Mesh.',
          'Fällt der WebSocket während einer Partie aus, hält der Server deinen Platz etwa 30 Sekunden frei und versucht automatisch dasselbe Schiff, Punktestand, Munition und Verbesserungen wiederherzustellen.'
        ],stepsTitle:'ERSTELLEN ODER BEITRETEN - SCHRITT FÜR SCHRITT',steps:[
          ['1. Namen eingeben','Trage auf dem Hauptbildschirm deinen Spielernamen ein und warte, bis der Server als bereit angezeigt wird.'],
          ['2. Spiel erstellen','Drücke SPIEL ERSTELLEN. Wähle ÖFFENTLICH für die sichtbare Liste oder PRIVAT, wenn du nur den Raumcode teilen möchtest.'],
          ['3. Privaten Raum teilen','Ein privater Raum erscheint nicht in der öffentlichen Liste. Teile den in der Lobby angezeigten 4-stelligen Code mit deinen Freunden.'],
          ['4. Öffentlichem Raum beitreten','Drücke BEITRETEN. Wähle im Browser einen verfügbaren Raum und drücke dessen BEITRETEN-Taste. Die Flagge zeigt die Sprache, in der der Raum erstellt wurde.'],
          ['5. Mit Code beitreten','Gib im selben Fenster den 4-stelligen Code in das Codefeld ein und bestätige, um direkt einem privaten Raum beizutreten.'],
          ['6. In der Lobby warten','Prüfe, ob alle Spieler da sind. Du kannst chatten und Sprache aktivieren. Nur der Host besitzt die Startsteuerung.'],
          ['7. Starten','Wenn alle bereit sind, drückt der Host STARTEN. Auf Mobilgeräten im Querformat spielen; die Bewegungssteuerung kalibriert sich beim Start automatisch.']
        ],media:[
          ['assets/manual/portada.webp','Galaxy-Combat-Hauptbildschirm.','Von hier aus kannst du gegen die CPU spielen, ein Online-Spiel erstellen oder einem Raum beitreten.'],
          ['assets/manual/crear-partida.webp','Schaltfläche Spiel erstellen.','SPIEL ERSTELLEN öffnet die Wahl zwischen öffentlichem und privatem Raum.'],
          ['assets/manual/unirse-sala.webp','Schaltfläche Beitreten.','BEITRETEN öffnet die öffentlichen Räume und die Code-Eingabe für private Räume.'],
          ['assets/manual/partida.webp','Beispiel einer Partie.','Nach dem Start behält jeder Spieler sein HUD, seine Schiffsfarbe und seine Steuerung.']
        ],tips:['Beim Wechsel von WLAN zu mobilen Daten einige Sekunden warten, bevor du das Spiel verlässt.','Auf PC ist V Push-to-talk; mobil nutzt du die Sprechtaste auf dem Bildschirm.']},
        {id:'end',title:'11. Spielende und Revanche',body:['Erreicht jemand 5 Abschüsse, erscheint der Sieg-Bildschirm. Wähle NOCHMAL SPIELEN für dieselbe Runde mit denselben Spielern oder HAUPTMENÜ zum Verlassen.','Die Revanche setzt Punkte, Munition, Verbesserungen, Meteore, Asteroiden und Spawnpositionen zurück.']},
        {id:'pwa',title:'12. Als App installieren',body:['Galaxy Combat ist eine PWA. Auf iPhone/iPad in Safari öffnen, Teilen tippen und Zum Home-Bildschirm wählen. Auf Android/Chrome App installieren oder Zum Startbildschirm hinzufügen verwenden.','Vom Icon gestartet wirkt das Spiel stärker wie eine App und zeigt weniger Browser-Oberfläche. Querformat ist vorgesehen.','Der Hauptcode wird bevorzugt aus dem Netz geladen, um veraltete Versionen zu vermeiden; Bilder, Sounds und Schriften werden für schnelleren Start gecacht.']},
        {id:'tips',title:'13. Kampftipps',body:['Verfolge Gegner nicht immer geradlinig: nutze Asteroiden als Deckung und variiere deine Flugbahn.','Prüfe deine Munition, bevor du eine Verfolgung startest.','Ein Schild ist nicht nur defensiv: gegen ein ungeschütztes Schiff kann er eine Rammchance eröffnen.','Geschwindigkeit und Feuerrate sind stark, werden beim Tod aber zurückgesetzt. Manchmal ist Ausweichen besser als ein riskanter Kampf.']}
      ]
    }
  };


  const ENHANCEMENTS = {
    es: {
      noticeLabel: 'IMPORTANTE',
      controlsNotice: 'IMPORTANTE: si no aceleras, la nave no avanza. El movimiento tiene inercia y deslizamiento, asi que debes ir corrigiendo la trayectoria girando la nave mientras te desplazas.',
      hudDiagramTitle: 'LECTURA RAPIDA DEL HUD',
      hudDiagramAlt: 'Detalle del HUD con municion, cadencia, velocidad y bajas.',
      hudDiagramCaption: 'Ejemplo de HUD del jugador con sus indicadores principales.',
      hudLegend: [
        ['BALAS', 'Numero de disparos disponibles. Cada tiro gasta 1 bala. Si llegas a 0, no podras atacar hasta recoger mas municion.'],
        ['CADENCIA', 'El tubo azul indica tu ritmo de disparo. Cuanto mas lleno o mejorado este, menos tiempo pasa entre bala y bala.'],
        ['VELOCIDAD', 'El cohete muestra tu nivel de velocidad. Al recoger esta mejora la nave acelera mas y alcanza mayor punta.'],
        ['MUERTES / BAJAS', 'La calavera indica tus bajas respecto al objetivo de la partida. Ejemplo: 0/5 significa que llevas 0 y necesitas 5 para ganar.']
      ],
      weaponStateTitle: 'ESTADO DEL ARMA EN LA NAVE',
      weaponStates: [
        ['assets/sprites/coete1.png','ARMA NO CARGADA','La cupula esta apagada. El arma todavia no esta cargada y no puede disparar.'],
        ['assets/sprites/coete1f.png','ARMA LISTA','La cupula se enciende en verde: el arma esta cargada y lista para disparar.']
      ]
    },
    en: {
      noticeLabel: 'IMPORTANT',
      controlsNotice: 'IMPORTANT: if you do not accelerate, the ship does not move forward. Movement has inertia and sliding, so you must keep correcting your path by turning the ship while drifting.',
      hudDiagramTitle: 'QUICK HUD GUIDE',
      hudDiagramAlt: 'HUD detail showing ammo, fire rate, speed and kills.',
      hudDiagramCaption: 'Example of the player HUD and its main indicators.',
      hudLegend: [
        ['AMMO', 'Number of shots available. Every shot spends 1 round. If you reach 0, you cannot attack until you collect more ammo.'],
        ['FIRE RATE', 'The blue bar shows your firing rhythm. The higher it is improved, the less time passes between shots.'],
        ['SPEED', 'The rocket shows your speed level. Collecting this upgrade makes the ship accelerate harder and reach a higher top speed.'],
        ['KILLS', 'The skull shows your kills toward the match objective. Example: 0/5 means you have 0 kills and need 5 to win.']
      ],
      weaponStateTitle: 'SHIP WEAPON STATUS',
      weaponStates: [
        ['assets/sprites/coete1.png','WEAPON NOT CHARGED','The canopy is off. The weapon is not charged yet and cannot fire.'],
        ['assets/sprites/coete1f.png','WEAPON READY','The canopy lights up green: the weapon is charged and ready to fire.']
      ]
    },
    it: {
      noticeLabel: 'IMPORTANTE',
      controlsNotice: 'IMPORTANTE: se non acceleri, la nave non avanza. Il movimento ha inerzia e scivolamento, quindi devi correggere la traiettoria ruotando la nave mentre ti muovi.',
      hudDiagramTitle: 'GUIDA RAPIDA HUD',
      hudDiagramAlt: 'Dettaglio HUD con munizioni, cadenza, velocita e uccisioni.',
      hudDiagramCaption: 'Esempio di HUD del giocatore con i suoi indicatori principali.',
      hudLegend: [
        ['MUNIZIONI', 'Numero di colpi disponibili. Ogni sparo consuma 1 munizione. Se arrivi a 0, non puoi attaccare finche non raccogli altra munizione.'],
        ['CADENZA', 'La barra blu indica il ritmo di fuoco. Più e migliorata, meno tempo passa tra uno sparo e l altro.'],
        ['VELOCITA', 'Il razzo mostra il tuo livello di velocita. Questa miglioria fa accelerare di piu la nave e aumenta la velocita massima.'],
        ['UCCISIONI', 'Il teschio indica le tue uccisioni rispetto all obiettivo della partita. Esempio: 0/5 significa 0 uccisioni e 5 necessarie per vincere.']
      ],
      weaponStateTitle: 'STATO DELL ARMA SULLA NAVE',
      weaponStates: [
        ['assets/sprites/coete1.png','ARMA NON CARICA','La cupola e spenta. L arma non e ancora carica e non puo sparare.'],
        ['assets/sprites/coete1f.png','ARMA PRONTA','La cupola si accende in verde: l arma e carica e pronta a sparare.']
      ]
    },
    fr: {
      noticeLabel: 'IMPORTANT',
      controlsNotice: 'IMPORTANT : si tu n acceleres pas, le vaisseau n avance pas. Le mouvement a de l inertie et du glissement, donc il faut corriger la trajectoire en faisant tourner le vaisseau pendant le deplacement.',
      hudDiagramTitle: 'LECTURE RAPIDE DU HUD',
      hudDiagramAlt: 'Detail du HUD avec munitions, cadence, vitesse et eliminations.',
      hudDiagramCaption: 'Exemple du HUD du joueur avec ses indicateurs principaux.',
      hudLegend: [
        ['MUNITIONS', 'Nombre de tirs disponibles. Chaque tir depense 1 munition. Si tu arrives a 0, tu ne peux plus attaquer tant que tu ne recuperes pas d autres munitions.'],
        ['CADENCE', 'La barre bleue indique ton rythme de tir. Plus elle est amelioree, moins il y a de temps entre deux tirs.'],
        ['VITESSE', 'La fusee indique ton niveau de vitesse. Cette amelioration permet au vaisseau d accelerer davantage et d atteindre une vitesse maximale plus elevee.'],
        ['ELIMINATIONS', 'La tete de mort indique tes eliminations par rapport a l objectif. Exemple : 0/5 signifie 0 elimination et 5 necessaires pour gagner.']
      ],
      weaponStateTitle: 'ETAT DE L ARME DU VAISSEAU',
      weaponStates: [
        ['assets/sprites/coete1.png','ARME NON CHARGEE','La coupole est eteinte. L arme n est pas encore chargee et ne peut pas tirer.'],
        ['assets/sprites/coete1f.png','ARME PRETE','La coupole s allume en vert : l arme est chargee et prete a tirer.']
      ]
    },
    de: {
      noticeLabel: 'WICHTIG',
      controlsNotice: 'WICHTIG: Wenn du nicht beschleunigst, bewegt sich das Schiff nicht vorwaerts. Die Bewegung hat Traegheit und Gleitverhalten, deshalb musst du die Flugbahn waehrend der Bewegung durch Drehen des Schiffs korrigieren.',
      hudDiagramTitle: 'HUD SCHNELLERKLARUNG',
      hudDiagramAlt: 'HUD-Detail mit Munition, Feuerrate, Geschwindigkeit und Abschuessen.',
      hudDiagramCaption: 'Beispiel fuer das Spieler-HUD mit den wichtigsten Anzeigen.',
      hudLegend: [
        ['MUNITION', 'Anzahl der verfuegbaren Schuesse. Jeder Schuss verbraucht 1 Munition. Bei 0 kannst du erst wieder angreifen, wenn du neue Munition aufsammelst.'],
        ['FEUERRATE', 'Der blaue Balken zeigt dein Schusstempo. Je staerker er verbessert ist, desto weniger Zeit liegt zwischen zwei Schuessen.'],
        ['GESCHWINDIGKEIT', 'Die Rakete zeigt dein Geschwindigkeitslevel. Dieses Upgrade laesst das Schiff staerker beschleunigen und erhoeht die Spitzengeschwindigkeit.'],
        ['ABSCHUESSE', 'Der Totenkopf zeigt deine Abschuesse im Verhaeltnis zum Spielziel. Beispiel: 0/5 bedeutet 0 Abschuesse und 5 zum Sieg.']
      ],
      weaponStateTitle: 'WAFFENSTATUS DES SCHIFFS',
      weaponStates: [
        ['assets/sprites/coete1.png','WAFFE NICHT GELADEN','Die Kuppel ist aus. Die Waffe ist noch nicht geladen und kann nicht feuern.'],
        ['assets/sprites/coete1f.png','WAFFE BEREIT','Die Kuppel leuchtet gruen: Die Waffe ist geladen und schussbereit.']
      ]
    }
  };

  function applyEnhancements(){
    Object.entries(ENHANCEMENTS).forEach(([lang, patch])=>{
      const pack = DATA[lang];
      if(!pack || !Array.isArray(pack.sections)) return;
      const controls = pack.sections.find(section => section.id === 'controls');
      if(controls){ controls.noticeLabel = patch.noticeLabel || 'IMPORTANT'; controls.notice = patch.controlsNotice; }
      const hud = pack.sections.find(section => section.id === 'hud');
      if(hud){
        hud.diagram = {
          title: patch.hudDiagramTitle,
          src: 'assets/manual/hud.png',
          alt: patch.hudDiagramAlt,
          caption: patch.hudDiagramCaption,
          items: patch.hudLegend
        };
      }
      const weapons = pack.sections.find(section => section.id === 'weapons');
      if(weapons){
        weapons.weaponStateTitle = patch.weaponStateTitle;
        weapons.weaponStates = patch.weaponStates;
      }
    });
  }
  applyEnhancements();

  function stripFlashbackText(value){
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  const menu=document.getElementById('menu');
  const dialog=document.getElementById('manualDialog');
  const openButton=document.getElementById('manualOpen');
  const closeButton=document.getElementById('manualClose');
  const titleEl=document.getElementById('manualTitle');
  const subtitleEl=document.getElementById('manualSubtitle');
  const navEl=document.getElementById('manualNav');
  const contentEl=document.getElementById('manualContent');
  let currentSection='objective';

  function language(){
    const lang=window.GalaxyI18n&&window.GalaxyI18n.getLanguage?window.GalaxyI18n.getLanguage():'es';
    return DATA[lang]?lang:'es';
  }
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function pickupIcon(kind){
    if(kind==='ammo1')return '<img src="assets/sprites/municion1.png" alt="" loading="lazy">';
    if(kind==='ammo3')return '<img src="assets/sprites/municion3.png" alt="" loading="lazy">';
    if(kind==='cadence')return '<img src="assets/sprites/cadencia.png" alt="" loading="lazy">';
    if(kind==='speed')return '<img src="assets/sprites/velocidad.png" alt="" loading="lazy">';
    if(kind==='shield')return '<span class="manual-vector-icon manual-shield-icon" aria-hidden="true"></span>';
    return '<span class="manual-vector-icon manual-eye-icon" aria-hidden="true"><i></i></span>';
  }
  function renderButton(){
    const copy=DATA[language()];
    if(!copy)return;
    openButton.textContent=copy.button;
    openButton.setAttribute('aria-label',copy.title);
  }
  function renderFull(){
    const copy=DATA[language()];
    if(!copy)return;
    renderButton();
    titleEl.textContent=stripFlashbackText(copy.title);
    navEl.setAttribute('aria-label',copy.contents);
    subtitleEl.textContent=copy.subtitle;
    closeButton.setAttribute('aria-label',copy.close);
    closeButton.title=copy.close;
    const valid=copy.sections.some(s=>s.id===currentSection);
    if(!valid)currentSection=copy.sections[0].id;
    navEl.innerHTML='<div class="manual-nav-label">'+escapeHtml(copy.contents)+'</div>'+copy.sections.map(section=>
      '<button type="button" data-manual-section="'+section.id+'" class="'+(section.id===currentSection?'active':'')+'">'+escapeHtml(section.title)+'</button>'
    ).join('');
    contentEl.innerHTML=copy.sections.map(section=>{
      const body=section.body.map(p=>'<p>'+escapeHtml(p)+'</p>').join('');
      const notice=section.notice?'<div class="manual-alert"><strong>'+escapeHtml(section.noticeLabel||'IMPORTANT')+'</strong><p>'+escapeHtml(section.notice)+'</p></div>':'';
      const tips=section.tips&&section.tips.length?'<div class="manual-tips">'+section.tips.map(t=>'<div><span aria-hidden="true">✦</span><p>'+escapeHtml(t)+'</p></div>').join('')+'</div>':'';
      const pickups=section.pickups?'<div class="manual-pickup-grid">'+section.pickups.map(([kind,name,desc])=>'<article class="manual-pickup"><div class="manual-pickup-icon">'+pickupIcon(kind)+'</div><div><h4>'+escapeHtml(name)+'</h4><p>'+escapeHtml(desc)+'</p></div></article>').join('')+'</div>':'';
      const steps=section.steps&&section.steps.length?'<div class="manual-steps"><h4>'+escapeHtml(section.stepsTitle||'')+'</h4>'+section.steps.map(([name,desc])=>'<article class="manual-step"><h5>'+escapeHtml(name)+'</h5><p>'+escapeHtml(desc)+'</p></article>').join('')+'</div>':'';
      const media=section.media&&section.media.length?'<div class="manual-media-grid">'+section.media.map(([src,alt,caption])=>'<figure class="manual-media"><img src="'+escapeHtml(src)+'" alt="'+escapeHtml(alt)+'" loading="lazy"><figcaption>'+escapeHtml(caption)+'</figcaption></figure>').join('')+'</div>':'';
      const diagram=section.diagram?'<div class="manual-diagram"><h4>'+escapeHtml(section.diagram.title||'')+'</h4><div class="manual-diagram-layout"><figure class="manual-diagram-figure"><img src="'+escapeHtml(section.diagram.src)+'" alt="'+escapeHtml(section.diagram.alt||'')+'" loading="lazy"><figcaption>'+escapeHtml(section.diagram.caption||'')+'</figcaption></figure><div class="manual-diagram-items">'+(section.diagram.items||[]).map(([name,desc])=>'<article class="manual-diagram-item"><h5>'+escapeHtml(name)+'</h5><p>'+escapeHtml(desc)+'</p></article>').join('')+'</div></div></div>':'';
      const weaponStates=section.weaponStates&&section.weaponStates.length?'<div class="manual-weapon-states"><h4>'+escapeHtml(section.weaponStateTitle||'')+'</h4><div class="manual-weapon-state-grid">'+section.weaponStates.map(([src,name,desc],idx)=>'<article class="manual-weapon-state '+(idx===1?'ready':'not-ready')+'"><div class="manual-weapon-state-image"><img src="'+escapeHtml(src)+'" alt="'+escapeHtml(name)+'" loading="lazy"></div><div><h5>'+escapeHtml(name)+'</h5><p>'+escapeHtml(desc)+'</p></div></article>').join('')+'</div></div>':'';
      return '<section id="manual-'+section.id+'" class="manual-section" data-section="'+section.id+'"><h3>'+escapeHtml(stripFlashbackText(section.title))+'</h3>'+body+notice+diagram+weaponStates+steps+media+pickups+tips+'</section>';
    }).join('');
    bindNav();
  }
  function bindNav(){
    navEl.querySelectorAll('[data-manual-section]').forEach(button=>button.addEventListener('click',()=>{
      currentSection=button.dataset.manualSection;
      navEl.querySelectorAll('[data-manual-section]').forEach(b=>b.classList.toggle('active',b===button));
      const target=document.getElementById('manual-'+currentSection);
      if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }
  function open(){
    const languageDropdown=document.getElementById('languageDropdown');
    if(languageDropdown)languageDropdown.open=false;
    renderFull();
    dialog.classList.remove('hidden');
    document.documentElement.classList.add('manual-visible');
    contentEl.scrollTop=0;
    requestAnimationFrame(()=>closeButton.focus());
  }
  function close(){
    dialog.classList.add('hidden');
    document.documentElement.classList.remove('manual-visible');
    navEl.innerHTML='';
    contentEl.innerHTML='';
    if(openButton&&menu&&!menu.classList.contains('hidden'))openButton.focus();
  }

  openButton?.addEventListener('click',open);
  closeButton?.addEventListener('click',close);
  dialog?.addEventListener('pointerdown',e=>{if(e.target===dialog)close();});
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&dialog&&!dialog.classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();close();}
  },true);
  window.addEventListener('galaxy-languagechange',()=>{
    renderButton();
    if(dialog&&!dialog.classList.contains('hidden'))renderFull();
  });
  renderButton();
})();
