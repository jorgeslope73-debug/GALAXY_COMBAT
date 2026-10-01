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
          'PC: A / D o flechas para girar, W o flecha arriba para acelerar y CTRL o ESPACIO para disparar.',
          'Móvil: juega en horizontal. Usa las flechas de la izquierda para girar. En la derecha: toque rápido = disparar, doble toque = bengalas y mantener pulsado = acelerar.',
          'Voz: en PC mantén V. En móvil mantén pulsado el botón del micrófono.'
        ],tips:['Las bengalas se lanzan manteniendo disparo en PC y con doble toque en móvil.']},
        {id:'hud',title:'3. HUD, bajas y líder',body:[
          'Cada jugador tiene un panel del mismo color que su nave. Ahí ves tus balas, velocidad y bajas.',
          'Cuando consigues una baja, el marcador aumenta. Si mueres por un peligro del escenario puedes recibir una PENALIZACIÓN -1.',
          'Si hay un líder claro, su nombre aparece destacado.'
        ]},
        {id:'weapons',title:'4. Munición, disparos y BRUTAL',body:[
          'Empiezas la partida con 5 balas. Cada disparo consume una unidad de munición; recoge cápsulas para seguir atacando.',
          'La mejora de CADENCIA te permite disparar más rápido.',
          'La mejora MIRA prepara un MISIL DIRIGIDO: el siguiente disparo corrige su trayectoria hacia un rival. Si no tienes balas al recogerla, recibes 1 bala para poder usar el misil, respetando el tiempo normal de recarga.',
          'Si aciertas un disparo desde muy lejos, aparece el aviso BRUTAL con la distancia del impacto.'
        ],tips:['No malgastes la última bala: sin munición pierdes capacidad ofensiva hasta encontrar otra cápsula.','El misil dirigido se consume con el siguiente disparo; aproxímate al objetivo antes de lanzarlo para darle una buena trayectoria inicial.','Las balas desaparecen al salir del escenario y también pueden destruir meteoritos pequeños o eliminar mejoras flotantes.']},
        {id:'pickups',title:'5. Mejoras flotantes',body:[
          'Las mejoras aparecen por el escenario durante la partida. Recógelas antes de que desaparezcan.',
          'Los asteroides y meteoritos también pueden hacer desaparecer una mejora.'
        ],pickups:[
          ['ammo1','MUNICIÓN +1','Añade 1 bala a tu reserva.'],['ammo3','MUNICIÓN +6','Añade 6 balas a tu reserva.'],['cadence','CADENCIA','Dispara con mayor frecuencia; los niveles altos también aceleran el proyectil.'],['mira','MIRA · MISIL DIRIGIDO','Prepara el siguiente disparo como misil dirigido. Si estás a 0 balas, también te concede 1 bala.'],['speed','VELOCIDAD','Aumenta la velocidad de la nave en pasos de +0,5 hasta un máximo de x2.'],['shield','ESCUDO','Te protege durante 10 s. Si embistes y destruyes una nave sin escudo, le robas su munición y mejoras.'],['camo','INVISIBILIDAD','Solo online. Activa el modo fantasma durante 10 s. Se representa con un ojo tachado.']
        ]},
        {id:'ghost',title:'6. Modo fantasma',body:[
          'El modo fantasma dura 10 segundos y solo aparece en partidas online.',
          'Mientras estás en fantasma, los rivales apenas ven tu nave. Cada pocos segundos reaparece brevemente para que puedan localizarte.',
          'Tú seguirás viendo ligeramente tu propia nave para poder controlarla.',
          'El modo fantasma y su indicador se muestran tanto en PC como en móvil.'
        ],tips:['Cambia de dirección después de cada revelación para que los rivales no puedan anticipar tu trayectoria.']},
        {id:'hazards',title:'7. Asteroides y meteoritos',body:[
          'Esquiva los asteroides y meteoritos: pueden destruir tu nave.',
          'Los meteoritos pequeños de la lluvia se pueden destruir disparando.'
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
        {id:'online',title:'10. Jugar online',body:[
          'Puedes jugar como invitado. Si te registras, reservas tu nombre y puedes puntuar en el ranking cuando haya al menos 2 jugadores humanos.',
          'CREAR PARTIDA permite hacer una sala PÚBLICA o PRIVADA.',
          'Si estás solo en una sala pública, usa RELLENAR CON CPU y empieza a jugar con 3 CPU mientras esperas. Cuando entra alguien, sustituye una CPU sin reiniciar la partida.',
          'COMPARTIR SALA copia un enlace directo. Envíalo por WhatsApp, Telegram, correo o donde quieras: al abrirlo, tu amigo entra directamente en la sala.',
          'UNIRSE permite elegir una sala pública o entrar con el código de una sala privada.',
          'En la sala puedes usar chat y voz. El anfitrión pulsa EMPEZAR.'
        ],stepsTitle:'ONLINE EN 6 PASOS',steps:[
          ['1. Nombre','Escribe tu nombre.'],
          ['2. Crear','Pulsa CREAR PARTIDA y elige PÚBLICA o PRIVADA.'],
          ['3. Jugar ya','Si estás solo, usa RELLENAR CON CPU y empieza con 3 CPU.'],
          ['4. Invitar','Pulsa COMPARTIR SALA y envía el enlace.'],
          ['5. Entrar','Pulsa UNIRSE para elegir una sala o escribir un código.'],
          ['6. Empezar','El anfitrión pulsa EMPEZAR.']
        ],media:[
          ['assets/manual/portada.webp','Portada principal de Galaxy Combat.','Desde aquí puedes jugar contra la CPU, crear una partida online o unirte a una sala.'],
          ['assets/manual/crear-partida.webp','Botón Crear partida.','CREAR PARTIDA abre la elección entre sala pública y privada.'],
          ['assets/manual/unirse-sala.webp','Botón Unirse.','UNIRSE abre la lista de partidas públicas y la entrada por código para salas privadas.'],
          ['assets/manual/partida.webp','Ejemplo de una partida.','Una vez iniciada la sala, cada jugador conserva su HUD, color de nave y controles.']
        ],tips:['En PC mantén V para hablar; en móvil usa el botón de micrófono.']},
        {id:'end',title:'11. Final de partida y revancha',body:[
          'Cuando alguien llega a 5 bajas termina la partida. Puedes repetir con los mismos jugadores o volver al menú.',
          'Al repetir, todos empiezan de nuevo desde cero.'
        ]},
        {id:'pwa',title:'12. Instalar como app',body:[
          'iPhone/iPad: Safari > Compartir > Añadir a pantalla de inicio.',
          'Android/Chrome: usa Instalar aplicación o Añadir a pantalla de inicio.',
          'Abre Galaxy Combat desde su icono y juega en horizontal.'
        ]},
        {id:'tips',title:'13. Consejos de combate',body:[
          'No persigas siempre en línea recta: usa los asteroides y cambia de dirección.',
          'Mira tus balas antes de perseguir a un rival.',
          'Con escudo puedes embestir a una nave sin escudo y robarle munición y mejoras.',
          'Si llevas buenas mejoras, a veces conviene esquivar y conservarlas.'
        ]},
        {id:'thanks',title:'14. Gracias',body:[
          'Gracias por interesarte por Galaxy Combat.',
          'Espero que te diviertas jugando. ¡Nos vemos en combate!'
        ]}
      ]
    },
    en: {
      button:'MANUAL', title:'GAME MANUAL', subtitle:'Everything you need to pilot, survive and win in Galaxy Combat.', close:'CLOSE', contents:'CONTENTS',
      sections:[
        {id:'objective',title:'1. Objective and match',body:['Galaxy Combat is an arcade space combat game for 1 to 4 players. Online matches support 2 to 4 people, and you can also fight the CPU at three difficulty levels.','The first player to reach 5 kills wins. Each ship HUD shows its kills against the match target. If several players are tied for first place, there is no unique leader until someone moves ahead.','After being destroyed you respawn quickly, but you lose ammunition and collected upgrades. After respawning you receive a short protection window to re-enter the fight.'],tips:['Keep moving: a stationary ship is an easy target.','Floating upgrades can swing a match; watch the arena as well as your opponents.']},
        {id:'controls',title:'2. Controls',body:['PC: A / D or Left / Right arrows to turn; W or Up arrow to thrust; CTRL or SPACE to fire. ESC leaves the match.','Mobile: play in landscape. Phone tilt controls turning and is calibrated automatically when the match begins. A quick tap anywhere on the play area fires; hold a little longer to thrust while your finger stays down.','Voice: enable it from the main menu. On PC hold V to talk. On mobile a voice control appears during the match; hold it while speaking.'],tips:['On mobile, hold the phone in your comfortable playing position before the match starts: that position becomes the reference.','Server controls expire if updates stop arriving, preventing stuck thrust or turning after a connection issue.']},
        {id:'hud',title:'3. HUD, kills and leader',body:['Each player has a HUD matching their ship color. It shows ammunition, speed and kills. Left-side players use the left HUD; right-side players use the right HUD.','When you score a kill, the new value appears in sync with a large scale animation. If an environmental death costs you a kill, PENALTY -1 appears first and the HUD updates afterward with its effect.','When there is one clear leader, a leader announcement appears. The leader name also pulses gently in the HUD.']},
        {id:'weapons',title:'4. Ammunition, shots and BRUTAL',body:['You start a match with 5 bullets. Every shot consumes one ammo unit; collect capsules to keep attacking.','The fire-rate upgrade reduces the delay between shots. At advanced levels it also increases projectile speed, making an upgraded player much more dangerous.','The AIM upgrade prepares a GUIDED MISSILE: your next shot steers toward an opponent. If you have no ammo when you collect it, you also receive 1 bullet so the missile can be used, while keeping the normal reload delay.','A very long-range kill triggers BRUTAL. The game measures the distance travelled by the bullet and displays it in metres, using an 8 m ship as the reference. The current threshold is roughly 142 m.'],tips:['Do not waste your last bullet: with no ammo you lose your ranged threat until you find another capsule.','The guided missile is consumed by the next shot; point roughly toward the target before launching it to give it a good initial path.','Bullets vanish outside the arena and can also destroy small meteors or remove floating pickups.']},
        {id:'pickups',title:'5. Floating upgrades',body:['Upgrades appear around the arena periodically. Up to 5 can exist at once. When the oldest one is about to be replaced, it blinks during its final 2 seconds between 50% and 100% opacity.','Asteroids and meteors can remove pickups by crossing them, so an opportunity may disappear before you reach it.'],pickups:[['ammo1','AMMO +1','Adds 1 bullet to your reserve.'],['ammo3','AMMO +6','Adds 6 bullets to your reserve.'],['cadence','FIRE RATE','Lets you fire more often; higher levels also speed up projectiles.'],['mira','AIM · GUIDED MISSILE','Turns your next shot into a guided missile. If you have 0 ammo, it also grants 1 bullet.'],['speed','SPEED','Raises ship speed in +0.5 steps up to x2.'],['shield','SHIELD','Protects you for 10 s. If you ram and destroy an unshielded ship, you steal its ammo and upgrades.'],['camo','INVISIBILITY','Online only. Activates ghost mode for 10 s. Shown as a crossed-out eye.']]},
        {id:'ghost',title:'6. Ghost mode',body:['Invisibility lasts 10 seconds and is only available in online matches. Opponents cannot see your ship continuously.','While a player is in ghost mode, a semi-transparent pill matching that player color appears beside their HUD with the word GHOST. The invisible ship briefly reveals itself periodically, about every 4 seconds, so opponents can relocate it.','Your own ship remains partially visible to you so you can steer accurately.','Ghost mode and its indicator are shown on both PC and mobile.'],tips:['Change direction after each reveal so opponents cannot predict your path.']},
        {id:'hazards',title:'7. Asteroids and meteors',body:['Dodge asteroids and meteors: they can destroy your ship.','Small meteors in the meteor shower can be destroyed by shooting them.']},
        {id:'death',title:'8. Deaths, penalties and respawn',body:['If another player destroys you, the attacker gains one kill. If you die to an arena hazard, an uncredited collision or an equivalent event, you lose 1 kill if you had one; the score never drops below 0.','When destroyed you lose ammo, speed upgrades, fire-rate upgrades, shield and invisibility. You respawn with upgrades reset and 1 bullet.','After respawning you have about 3 seconds of protection, preventing an unlucky spawn from immediately killing you again.']},
        {id:'cpu',title:'9. Playing against the CPU',body:['Choose EASY, MEDIUM or HARD. The CPU avoids hazards and changes priorities based on its resources.','With no bullets and no shield, the CPU should not chase you: it searches for ammunition. If no ammo pickup exists, it flees and tries to keep its distance until one appears.','With a shield but no bullets, it may try to ram you only when you have no shield or spawn protection. If you are protected it keeps searching or avoiding combat. With bullets it returns to normal offensive behavior.']},
        {id:'online',title:'10. Online, rooms, chat and voice',body:[
          'To create an online game, first enter your name and wait until the server status says it is ready. Then press CREATE GAME. Choose PUBLIC so the room appears in the public list, or PRIVATE so it can only be opened with its 4-character code.',
          'If you create a PUBLIC room on your own, press FILL WITH CPU: the 3 empty slots are filled with hard CPU players so you can start immediately while you wait for other people to join.',
          'The public room remains joinable while you play with CPUs. When a human player joins, that player replaces one CPU without restarting the match and enters with 0 kills, 5 bullets and no upgrades.',
          'SHARE ROOM copies a direct link to the room. Paste it into WhatsApp, Telegram, email or any other app. Anyone opening that link launches Galaxy Combat and the game tries to place them directly into that room without searching for it or typing the code.',
          'You can also join normally by pressing JOIN, choosing a public room or entering the 4-character code of a private room.',
          'After joining a room you enter the lobby. There you can see connected players, use text chat and enable voice. The host presses START when enough players are ready.',
          'You can use text chat and voice in the room. Hold the microphone control to talk.'
        ],stepsTitle:'CREATE OR JOIN - STEP BY STEP',steps:[
          ['1. Enter your name','On the main screen type the name you want to use and wait until the server status shows that it is ready.'],
          ['2. Create a game','Press CREATE GAME and choose PUBLIC or PRIVATE.'],
          ['3. Fill with CPU','If you are alone in a public room, press FILL WITH CPU. The 3 empty slots become hard CPUs and you can start immediately.'],
          ['4. Share the room','Press SHARE ROOM to copy the direct link. Send it through WhatsApp, Telegram, email or any app; opening it takes your friend directly to that room.'],
          ['5. Keep playing while people join','Play against the CPUs while you wait. Each human player who joins replaces one CPU without restarting the match.'],
          ['6. Private room','For a private room you can also share the direct link or the 4-character code.'],
          ['7. Join a public room','Press JOIN, choose an available public room and press JOIN.'],
          ['8. Join with a code','Enter the 4-character code to enter a private room.'],
          ['9. Start','The host presses START whenever ready; with CPU fill enabled the match can begin with only one human.']
        ],media:[
          ['assets/manual/portada.webp','Galaxy Combat main screen.','From here you can play the CPU, create an online game or join a room.'],
          ['assets/manual/crear-partida.webp','Create Game button.','CREATE GAME opens the choice between a public and a private room.'],
          ['assets/manual/unirse-sala.webp','Join button.','JOIN opens the public room browser and the code entry for private rooms.'],
          ['assets/manual/partida.webp','Example match.','Once the room starts, every player keeps their HUD, ship colour and controls.']
        ],tips:['If you switch from Wi-Fi to mobile data, wait a few seconds before leaving: automatic reconnection may restore the match.','On PC, V is push-to-talk; on mobile use the on-screen voice control.']},
        {id:'end',title:'11. Match end and rematch',body:['When someone reaches 5 kills, the victory screen appears. Choose PLAY AGAIN to reset the same room with the same players, or MAIN MENU to leave.','A rematch resets scores, ammo, upgrades, meteors, asteroids and spawn positions so the new round starts cleanly.']},
        {id:'pwa',title:'12. Install as an app',body:['Galaxy Combat is a PWA. On iPhone/iPad open it in Safari, tap Share and choose Add to Home Screen. On Android/Chrome use Install app or Add to Home screen.','Launching from the icon feels more like an app with less browser chrome. The game is designed for landscape orientation.','Core code uses network-first loading to avoid stale versions, while images, sounds and fonts are cached for faster startup.']},
        {id:'tips',title:'13. Combat tips',body:['Do not always chase in a straight line: use asteroids as cover and vary your path to make shots miss.','Check your ammunition before starting a chase. An unarmed rival is vulnerable, but attacking without resources can expose you to collisions and meteors.','A shield is not only defensive: it can create a ramming opportunity against an unprotected ship.','Speed and fire-rate upgrades are powerful, but dying resets them. Sometimes avoiding a fight is the best way to preserve an advantage.']},
        {id:'thanks',title:'14. Thanks',body:['Thanks for taking an interest in Galaxy Combat.','I hope you have fun playing. See you in combat!']}
      ]
    },
    it: {
      button:'MANUALE', title:'MANUALE DI GIOCO', subtitle:'Tutto quello che serve per pilotare, sopravvivere e vincere in Galaxy Combat.', close:'CHIUDI', contents:'CONTENUTI',
      sections:[
        {id:'objective',title:'1. Obiettivo e partita',body:['Galaxy Combat è un combattimento spaziale arcade da 1 a 4 giocatori. Online possono giocare da 2 a 4 persone; puoi anche affrontare la CPU con tre livelli di difficoltà.','Vince il primo giocatore che raggiunge 5 eliminazioni. L HUD di ogni nave mostra le eliminazioni rispetto all obiettivo. In caso di parità in testa non esiste un leader unico finché qualcuno non passa avanti.','Dopo la distruzione riappari rapidamente, ma perdi munizioni e potenziamenti. Al respawn hai un breve periodo di protezione per rientrare in combattimento.'],tips:['Resta in movimento: una nave ferma è un bersaglio facile.','I potenziamenti fluttuanti possono cambiare la partita: controlla l arena oltre ai rivali.']},
        {id:'controls',title:'2. Comandi',body:['PC: A / D o frecce sinistra / destra per girare; W o freccia su per accelerare; CTRL o SPAZIO per sparare. ESC esce dalla partita.','Mobile: gioca in orizzontale. L inclinazione del telefono controlla la rotazione e viene calibrata automaticamente all inizio. Un tocco rapido sullo schermo spara; tieni premuto un po più a lungo per accelerare finché il dito resta appoggiato.','Voce: attivala dal menu. Su PC tieni premuto V per parlare. Su mobile compare un controllo vocale durante la partita; tienilo premuto mentre parli.'],tips:['Su mobile, tieni il telefono nella posizione comoda prima dell inizio: quella posizione diventa il riferimento.','I comandi sul server scadono se smettono di arrivare aggiornamenti, evitando accelerazione o rotazione bloccate.']},
        {id:'hud',title:'3. HUD, eliminazioni e leader',body:['Ogni giocatore ha un HUD dello stesso colore della nave. Mostra munizioni, velocità ed eliminazioni. I giocatori a sinistra usano l HUD sinistro e quelli a destra l HUD destro.','Quando ottieni un eliminazione, il nuovo valore appare insieme a una forte animazione di scala. Se una morte ambientale ti costa un punto, appare prima PENALITÀ -1 e poi si aggiorna l HUD.','Quando esiste un leader unico compare un avviso e il suo nome pulsa leggermente nell HUD.']},
        {id:'weapons',title:'4. Munizioni, colpi e BRUTAL',body:['Inizi con 5 proiettili. Ogni sparo consuma una munizione; raccogli capsule per continuare ad attaccare.','Il potenziamento cadenza riduce il tempo tra i colpi. Ai livelli avanzati aumenta anche la velocità del proiettile.','Il potenziamento MIRA prepara un MISSILE GUIDATO: il colpo successivo corregge la traiettoria verso un avversario. Se sei a 0 munizioni quando lo raccogli, ricevi anche 1 proiettile, rispettando il normale tempo di ricarica.','Un eliminazione da distanza molto lunga attiva BRUTAL. Il gioco misura il percorso del proiettile e lo mostra in metri usando una nave da 8 m come riferimento. La soglia attuale è circa 142 m.'],tips:['Non sprecare l ultima munizione: senza colpi perdi la minaccia a distanza finché non trovi una capsula.','Il missile guidato viene consumato con il colpo successivo; orientati approssimativamente verso il bersaglio prima del lancio.','I proiettili spariscono fuori dall arena e possono distruggere meteore piccole o eliminare potenziamenti.']},
        {id:'pickups',title:'5. Potenziamenti fluttuanti',body:['I potenziamenti compaiono periodicamente. Possono essercene fino a 5 contemporaneamente. Quando il più vecchio sta per essere sostituito, lampeggia negli ultimi 2 secondi tra il 50% e il 100% di opacità.','Asteroidi e meteore possono eliminare i potenziamenti attraversandoli.'],pickups:[['ammo1','MUNIZIONI +1','Aggiunge 1 proiettile alla riserva.'],['ammo3','MUNIZIONI +6','Aggiunge 6 proiettili alla riserva.'],['cadence','CADENZA','Permette di sparare più spesso; i livelli alti accelerano anche i proiettili.'],['mira','MIRA · MISSILE GUIDATO','Trasforma il colpo successivo in un missile guidato. Se sei a 0 munizioni, aggiunge anche 1 proiettile.'],['speed','VELOCITÀ','Aumenta la velocità in passi di +0,5 fino a x2.'],['shield','SCUDO','Ti protegge per 10 s. Se speroni e distruggi una nave senza scudo, rubi munizioni e potenziamenti.'],['camo','INVISIBILITÀ','Solo online. Attiva la modalità fantasma per 10 s. È indicata da un occhio barrato.']]},
        {id:'ghost',title:'6. Modalità fantasma',body:['L invisibilità dura 10 secondi ed è disponibile solo online. Gli avversari non vedono la tua nave in modo continuo.','Durante la modalità fantasma compare accanto all HUD una pillola semitrasparente del colore del giocatore con la scritta FANTASMA. La nave invisibile si rivela brevemente circa ogni 4 secondi.','La tua nave resta parzialmente visibile a te per permettere un controllo preciso.','La modalità fantasma e il relativo indicatore sono visibili sia su PC sia su mobile.'],tips:['Cambia direzione dopo ogni rivelazione per rendere imprevedibile la traiettoria.']},
        {id:'hazards',title:'7. Asteroidi e meteore',body:['Schiva asteroidi e meteore: possono distruggere la tua nave.','Le meteore piccole della pioggia possono essere distrutte sparando.']},
        {id:'death',title:'8. Morti, penalità e respawn',body:['Se un altro giocatore ti distrugge, l attaccante guadagna un eliminazione. Se muori per un pericolo dello scenario o per una collisione senza attaccante, perdi 1 eliminazione se ne avevi; il punteggio non scende mai sotto 0.','Alla morte perdi munizioni, velocità, cadenza, scudo e invisibilità. Riappari con i potenziamenti azzerati e 1 proiettile.','Dopo il respawn hai circa 3 secondi di protezione.']},
        {id:'cpu',title:'9. Giocare contro la CPU',body:['Scegli FACILE, MEDIO o DIFFICILE. La CPU evita gli ostacoli e cambia priorità in base alle risorse.','Senza munizioni e senza scudo non ti insegue: cerca munizioni. Se non ce ne sono, fugge e prova a mantenere le distanze.','Con scudo ma senza munizioni può tentare una speronata solo se tu non hai scudo né protezione. Con munizioni torna al comportamento offensivo.']},
        {id:'online',title:'10. Online, stanze, chat e voce',body:[
          'Per creare una partita online, inserisci prima il tuo nome e aspetta che lo stato del server indichi che è pronto. Poi premi CREA PARTITA. Scegli PUBBLICA per farla comparire nell elenco oppure PRIVATA per permettere l accesso solo tramite il codice di 4 caratteri.',
          'Se crei da solo una stanza PUBBLICA, usa RIEMPI CON CPU: i 3 posti liberi vengono occupati da CPU difficili e puoi iniziare subito mentre aspetti altri giocatori.',
          'La stanza pubblica resta accessibile mentre giochi con le CPU. Quando entra un giocatore umano, sostituisce una CPU senza riavviare la partita e inizia con 0 eliminazioni, 5 proiettili e nessun potenziamento.',
          'CONDIVIDI STANZA copia un link diretto. Puoi inviarlo con WhatsApp, Telegram, email o qualsiasi altra app. Chi apre il link avvia Galaxy Combat e il gioco prova a farlo entrare direttamente nella stanza senza cercarla né digitare il codice.',
          'Puoi anche entrare normalmente con ENTRA, scegliendo una stanza pubblica o inserendo il codice di 4 caratteri di una stanza privata.',
          'Dopo l ingresso passerai alla lobby. Qui vedrai i giocatori connessi, potrai usare la chat e attivare la voce. L host preme INIZIA quando ci sono abbastanza giocatori.',
          'Nella stanza puoi usare chat e voce. Tieni premuto il comando del microfono per parlare.'
        ],stepsTitle:'CREARE O ENTRARE - PASSO PER PASSO',steps:[
          ['1. Inserisci il nome','Nella schermata principale scrivi il nome con cui vuoi apparire e aspetta che il server risulti pronto.'],
          ['2. Crea una partita','Premi CREA PARTITA e scegli PUBBLICA o PRIVATA.'],
          ['3. Riempi con CPU','Se sei solo in una stanza pubblica, usa RIEMPI CON CPU: i 3 posti liberi diventano CPU difficili e puoi iniziare subito.'],
          ['4. Condividi la stanza','Premi CONDIVIDI STANZA per copiare il link diretto e invialo con WhatsApp, Telegram, email o un altra app.'],
          ['5. Continua a giocare mentre arrivano persone','Gioca contro le CPU mentre aspetti. Ogni giocatore umano che entra sostituisce una CPU senza riavviare la partita.'],
          ['6. Stanza privata','In una stanza privata puoi condividere il link diretto oppure il codice di 4 caratteri.'],
          ['7. Entra in una pubblica','Premi ENTRA e scegli una partita pubblica disponibile.'],
          ['8. Entra con codice','Inserisci il codice di 4 caratteri per entrare in una stanza privata.'],
          ['9. Inizia','L host preme INIZIA quando vuole; con il riempimento CPU può iniziare anche con un solo giocatore umano.']
        ],media:[
          ['assets/manual/portada.webp','Schermata principale di Galaxy Combat.','Da qui puoi giocare contro la CPU, creare una partita online o entrare in una stanza.'],
          ['assets/manual/crear-partida.webp','Pulsante Crea partita.','CREA PARTITA permette di scegliere tra stanza pubblica e privata.'],
          ['assets/manual/unirse-sala.webp','Pulsante Entra.','ENTRA apre l elenco delle stanze pubbliche e l ingresso tramite codice.'],
          ['assets/manual/partida.webp','Esempio di partita.','Dopo l avvio ogni giocatore mantiene il proprio HUD, colore della nave e controlli.']
        ],tips:['Se passi da Wi-Fi a rete mobile, aspetta qualche secondo prima di uscire: la riconnessione automatica può recuperare la partita.','Su PC V è push-to-talk; su mobile usa il controllo vocale sullo schermo.']},
        {id:'end',title:'11. Fine partita e rivincita',body:['Quando qualcuno raggiunge 5 eliminazioni compare la vittoria. Puoi scegliere RIGIOCA per riavviare la stessa stanza o MENU PRINCIPALE per uscire.','La rivincita azzera punteggi, munizioni, potenziamenti, meteore, asteroidi e posizioni.']},
        {id:'pwa',title:'12. Installare come app',body:['Galaxy Combat è una PWA. Su iPhone/iPad apri il gioco in Safari, premi Condividi e scegli Aggiungi alla schermata Home. Su Android/Chrome usa Installa app o Aggiungi a schermata Home.','Dal suo icono si apre con meno interfaccia del browser. Il gioco è pensato per l orientamento orizzontale.','Il codice principale usa priorità alla rete per evitare versioni obsolete, mentre immagini, suoni e font vengono memorizzati in cache.']},
        {id:'tips',title:'13. Consigli di combattimento',body:['Non inseguire sempre in linea retta: usa gli asteroidi come copertura e varia la traiettoria.','Controlla le munizioni prima di iniziare un inseguimento.','Lo scudo non è solo difensivo: può creare un opportunità di speronata contro una nave senza protezione.','Velocità e cadenza sono potenti, ma la morte le azzera: a volte evitare lo scontro è la scelta migliore.']},
        {id:'thanks',title:'14. Grazie',body:['Grazie per esserti interessato a Galaxy Combat.','Spero che ti diverta giocando. Ci vediamo in battaglia!']}
      ]
    },
    fr: {
      button:'MANUEL', title:'MANUEL DE JEU', subtitle:'Tout ce qu il faut pour piloter, survivre et gagner dans Galaxy Combat.', close:'FERMER', contents:'SOMMAIRE',
      sections:[
        {id:'objective',title:'1. Objectif et partie',body:['Galaxy Combat est un jeu de combat spatial arcade pour 1 à 4 joueurs. En ligne, 2 à 4 personnes peuvent jouer; tu peux aussi affronter le CPU avec trois niveaux de difficulté.','Le premier joueur à atteindre 5 éliminations gagne. Le HUD de chaque vaisseau affiche ses éliminations par rapport à l objectif. En cas d égalité en tête, il n y a pas de leader unique.','Après destruction tu réapparais rapidement, mais tu perds munitions et améliorations. Après le respawn tu disposes d une courte protection.'],tips:['Reste en mouvement: un vaisseau immobile est une cible facile.','Les améliorations flottantes peuvent retourner une partie; surveille l arène autant que les adversaires.']},
        {id:'controls',title:'2. Commandes',body:['PC: A / D ou flèches gauche / droite pour tourner; W ou flèche haut pour accélérer; CTRL ou ESPACE pour tirer. ESC quitte la partie.','Mobile: joue en paysage. L inclinaison du téléphone contrôle la rotation et se calibre automatiquement au début. Une touche rapide sur l écran tire; maintiens un peu plus longtemps pour accélérer tant que le doigt reste posé.','Voix: active-la depuis le menu. Sur PC maintiens V pour parler. Sur mobile un contrôle vocal apparaît pendant la partie.'],tips:['Sur mobile, tiens le téléphone dans ta position de jeu confortable avant le départ: elle devient la référence.','Les commandes expirent côté serveur si les mises à jour cessent, évitant une accélération ou rotation bloquée.']},
        {id:'hud',title:'3. HUD, éliminations et leader',body:['Chaque joueur possède un HUD de la couleur de son vaisseau. Il indique munitions, vitesse et éliminations.','Quand tu obtiens une élimination, la nouvelle valeur apparaît avec une grande animation d échelle. Si une mort environnementale te retire un point, PÉNALITÉ -1 apparaît avant la mise à jour du HUD.','Lorsqu il existe un leader unique, une annonce apparaît et son nom pulse légèrement dans le HUD.']},
        {id:'weapons',title:'4. Munitions, tirs et BRUTAL',body:['Tu commences avec 5 balles. Chaque tir consomme une munition; récupère des capsules pour continuer à attaquer.','L amélioration de cadence réduit le délai entre les tirs. Aux niveaux avancés elle augmente aussi la vitesse du projectile.','L amélioration VISÉE prépare un MISSILE GUIDÉ : le prochain tir corrige sa trajectoire vers un adversaire. Si tu n as plus de munitions au moment de la ramasser, elle te donne aussi 1 balle, tout en respectant le délai normal de recharge.','Une élimination à très longue distance déclenche BRUTAL. La distance parcourue par la balle est affichée en mètres en prenant un vaisseau de 8 m comme référence. Le seuil actuel est d environ 142 m.'],tips:['Évite de gaspiller ta dernière balle.','Le missile guidé est consommé au prochain tir; oriente-toi approximativement vers la cible avant de le lancer.','Les tirs disparaissent hors de l arène et peuvent aussi détruire de petites météorites ou supprimer des améliorations flottantes.']},
        {id:'pickups',title:'5. Améliorations flottantes',body:['Les améliorations apparaissent périodiquement. Il peut y en avoir jusqu à 5. Quand la plus ancienne va être remplacée, elle clignote pendant ses 2 dernières secondes entre 50 % et 100 % d opacité.','Astéroïdes et météorites peuvent faire disparaître une amélioration en la traversant.'],pickups:[['ammo1','MUNITIONS +1','Ajoute 1 balle à la réserve.'],['ammo3','MUNITIONS +6','Ajoute 6 balles à la réserve.'],['cadence','CADENCE','Permet de tirer plus souvent; les niveaux élevés accélèrent aussi les projectiles.'],['mira','VISÉE · MISSILE GUIDÉ','Transforme le prochain tir en missile guidé. Si tu es à 0 munition, donne aussi 1 balle.'],['speed','VITESSE','Augmente la vitesse par pas de +0,5 jusqu à x2.'],['shield','BOUCLIER','Te protège pendant 10 s. Si tu percutes et détruis un vaisseau sans bouclier, tu récupères ses munitions et améliorations.'],['camo','INVISIBILITÉ','En ligne uniquement. Active le mode fantôme pendant 10 s. Icône: œil barré.']]},
        {id:'ghost',title:'6. Mode fantôme',body:['L invisibilité dure 10 secondes et n existe qu en ligne. Les adversaires ne voient pas ton vaisseau en continu.','Pendant ce mode, une pastille semi-transparente de la couleur du joueur apparaît près de son HUD avec le texte FANTÔME. Le vaisseau invisible se révèle brièvement environ toutes les 4 secondes.','Ton propre vaisseau reste partiellement visible pour toi.','Le mode fantôme et son indicateur sont visibles sur PC comme sur mobile.'],tips:['Change de direction après chaque révélation pour rendre ta trajectoire difficile à prévoir.']},
        {id:'hazards',title:'7. Astéroïdes et météorites',body:['Évite les astéroïdes et les météorites : ils peuvent détruire ton vaisseau.','Les petites météorites de la pluie peuvent être détruites en tirant dessus.']},
        {id:'death',title:'8. Morts, pénalités et respawn',body:['Si un autre joueur te détruit, il gagne une élimination. Si tu meurs à cause du décor ou d une collision sans attaquant, tu perds 1 élimination si tu en avais; le score ne descend jamais sous 0.','À la mort tu perds munitions, vitesse améliorée, cadence, bouclier et invisibilité. Tu réapparais avec les améliorations réinitialisées et 1 balle.','Après le respawn tu disposes d environ 3 secondes de protection.']},
        {id:'cpu',title:'9. Jouer contre le CPU',body:['Choisis FACILE, MOYEN ou DIFFICILE. Le CPU évite les obstacles et change de priorité selon ses ressources.','Sans munitions ni bouclier, il ne te poursuit pas: il cherche des munitions. S il n y en a pas, il fuit et garde ses distances.','Avec un bouclier mais sans munitions, il peut tenter de te percuter seulement si tu n as ni bouclier ni protection. Avec des balles il reprend son comportement offensif.']},
        {id:'online',title:'10. En ligne, salles, chat et voix',body:[
          'Pour créer une partie en ligne, saisis d abord ton nom et attends que le serveur indique qu il est prêt. Appuie ensuite sur CRÉER UNE PARTIE. Choisis PUBLIQUE pour apparaître dans la liste ou PRIVÉE pour autoriser uniquement l accès par code à 4 caractères.',
          'Si tu crées seul une salle PUBLIQUE, utilise REMPLIR AVEC CPU : les 3 places libres sont occupées par des CPU difficiles et tu peux commencer immédiatement en attendant d autres joueurs.',
          'La salle publique reste accessible pendant que tu joues avec les CPU. Lorsqu un joueur humain arrive, il remplace une CPU sans redémarrer la partie et commence avec 0 élimination, 5 balles et aucune amélioration.',
          'PARTAGER LA SALLE copie un lien direct. Tu peux l envoyer par WhatsApp, Telegram, e-mail ou toute autre application. La personne qui ouvre ce lien lance Galaxy Combat et le jeu essaie de la faire entrer directement dans cette salle sans la chercher ni saisir le code.',
          'Tu peux aussi rejoindre normalement avec REJOINDRE, en choisissant une salle publique ou en saisissant le code à 4 caractères d une salle privée.',
          'Une fois dans la salle, tu arrives dans le lobby. Tu y vois les joueurs connectés, peux utiliser le chat texte et activer la voix. L hôte appuie sur DÉMARRER quand il y a assez de joueurs.',
          'Dans la salle, tu peux utiliser le chat et la voix. Maintiens le bouton du micro pour parler.'
        ],stepsTitle:'CRÉER OU REJOINDRE - ÉTAPE PAR ÉTAPE',steps:[
          ['1. Saisis ton nom','Sur l écran principal, écris le nom que tu veux utiliser et attends que le serveur soit prêt.'],
          ['2. Crée une partie','Appuie sur CRÉER UNE PARTIE et choisis PUBLIQUE ou PRIVÉE.'],
          ['3. Remplis avec CPU','Si tu es seul dans une salle publique, utilise REMPLIR AVEC CPU : les 3 places libres deviennent des CPU difficiles et tu peux commencer immédiatement.'],
          ['4. Partage la salle','Appuie sur PARTAGER LA SALLE pour copier le lien direct et envoie-le par WhatsApp, Telegram, e-mail ou une autre application.'],
          ['5. Continue à jouer pendant que des joueurs arrivent','Joue contre les CPU en attendant. Chaque joueur humain qui rejoint remplace une CPU sans redémarrer la partie.'],
          ['6. Salle privée','Dans une salle privée tu peux aussi partager le lien direct ou le code à 4 caractères.'],
          ['7. Rejoins une publique','Appuie sur REJOINDRE et choisis une salle publique disponible.'],
          ['8. Rejoins avec un code','Saisis le code à 4 caractères pour entrer dans une salle privée.'],
          ['9. Démarre','L hôte appuie sur DÉMARRER quand il veut; avec le remplissage CPU la partie peut commencer avec un seul humain.']
        ],media:[
          ['assets/manual/portada.webp','Écran principal de Galaxy Combat.','Depuis cet écran, tu peux jouer contre le CPU, créer une partie en ligne ou rejoindre une salle.'],
          ['assets/manual/crear-partida.webp','Bouton Créer une partie.','CRÉER UNE PARTIE ouvre le choix entre salle publique et privée.'],
          ['assets/manual/unirse-sala.webp','Bouton Rejoindre.','REJOINDRE ouvre la liste des salles publiques et l entrée par code privé.'],
          ['assets/manual/partida.webp','Exemple de partie.','Une fois lancée, chaque joueur conserve son HUD, la couleur de son vaisseau et ses commandes.']
        ],tips:['Si tu passes du Wi-Fi aux données mobiles, attends quelques secondes avant de quitter.','Sur PC, V est le push-to-talk; sur mobile utilise le contrôle vocal à l écran.']},
        {id:'end',title:'11. Fin de partie et revanche',body:['Quand quelqu un atteint 5 éliminations, l écran de victoire apparaît. Choisis REJOUER pour relancer la même salle ou MENU PRINCIPAL pour quitter.','La revanche réinitialise scores, munitions, améliorations, météorites, astéroïdes et positions.']},
        {id:'pwa',title:'12. Installer comme application',body:['Galaxy Combat est une PWA. Sur iPhone/iPad ouvre le jeu dans Safari, touche Partager puis Sur l écran d accueil. Sur Android/Chrome utilise Installer l application ou Ajouter à l écran d accueil.','Depuis l icône le jeu ressemble davantage à une app et utilise moins d interface navigateur. Le mode paysage est recommandé.','Le code principal privilégie le réseau pour éviter les anciennes versions; images, sons et polices restent en cache pour accélérer le démarrage.']},
        {id:'tips',title:'13. Conseils de combat',body:['Ne poursuis pas toujours en ligne droite: utilise les astéroïdes comme couverture et varie ta trajectoire.','Vérifie tes munitions avant de poursuivre un rival.','Le bouclier peut aussi servir offensivement pour une collision contre un vaisseau non protégé.','Vitesse et cadence sont puissantes, mais la mort les réinitialise: préserver un avantage peut valoir mieux qu un duel risqué.']},
        {id:'thanks',title:'14. Merci',body:['Merci de t intéresser à Galaxy Combat.','J espère que tu vas bien t amuser. À bientôt au combat !']}
      ]
    },
    de: {
      button:'ANLEITUNG', title:'SPIELANLEITUNG', subtitle:'Alles, was du zum Fliegen, Überleben und Gewinnen in Galaxy Combat brauchst.', close:'SCHLIESSEN', contents:'INHALT',
      sections:[
        {id:'objective',title:'1. Ziel und Spiel',body:['Galaxy Combat ist ein Arcade-Weltraumkampf für 1 bis 4 Spieler. Online spielen 2 bis 4 Personen; außerdem kannst du gegen die CPU in drei Schwierigkeitsstufen antreten.','Wer zuerst 5 Abschüsse erreicht, gewinnt. Das HUD jedes Schiffs zeigt die Abschüsse im Verhältnis zum Spielziel. Bei Gleichstand gibt es keinen eindeutigen Anführer.','Nach der Zerstörung spawnst du schnell neu, verlierst aber Munition und gesammelte Verbesserungen. Nach dem Respawn erhältst du kurzzeitig Schutz.'],tips:['Bleib in Bewegung: ein stehendes Schiff ist ein leichtes Ziel.','Schwebende Verbesserungen können ein Spiel drehen; beobachte die Arena ebenso wie deine Gegner.']},
        {id:'controls',title:'2. Steuerung',body:['PC: A / D oder Pfeil links / rechts zum Drehen; W oder Pfeil hoch zum Beschleunigen; CTRL oder LEERTASTE zum Feuern. ESC verlässt das Spiel.','Mobil: spiele im Querformat. Die Neigung des Telefons steuert die Drehung und wird beim Spielstart automatisch kalibriert. Kurz auf den Spielbereich tippen feuert; etwas länger gedrückt halten beschleunigt, solange der Finger aufliegt.','Sprache: im Hauptmenü aktivieren. Auf PC V gedrückt halten zum Sprechen. Mobil erscheint während des Spiels eine Sprechtaste.'],tips:['Halte das Telefon vor dem Start in deiner bequemen Spielposition; diese wird als Referenz genommen.','Serverseitige Steuerbefehle laufen aus, wenn keine Updates mehr eintreffen, damit Schub oder Drehung nicht hängen bleiben.']},
        {id:'hud',title:'3. HUD, Abschüsse und Führung',body:['Jeder Spieler hat ein HUD in der Farbe seines Schiffs. Es zeigt Munition, Geschwindigkeit und Abschüsse.','Bei einem Abschuss erscheint der neue Wert synchron mit einer großen Skalierungsanimation. Kostet dich ein Umwelttod einen Punkt, erscheint zuerst STRAFE -1 und danach aktualisiert sich das HUD.','Gibt es einen eindeutigen Anführer, erscheint eine Meldung und sein Name pulsiert leicht im HUD.']},
        {id:'weapons',title:'4. Munition, Schüsse und BRUTAL',body:['Du startest mit 5 Schüssen. Jeder Schuss verbraucht eine Munition; sammle Kapseln, um weiter angreifen zu können.','Die Feuerraten-Verbesserung verkürzt die Zeit zwischen Schüssen. Höhere Stufen erhöhen zusätzlich die Projektilgeschwindigkeit.','Die ZIELHILFE bereitet eine LENKRAKETE vor: Der nächste Schuss korrigiert seine Flugbahn in Richtung eines Gegners. Hast du beim Einsammeln 0 Munition, erhältst du zusätzlich 1 Schuss; die normale Nachladezeit bleibt bestehen.','Ein Abschuss aus sehr großer Entfernung löst BRUTAL aus. Die Flugstrecke der Kugel wird in Metern angezeigt, wobei ein 8-m-Schiff als Referenz dient. Die aktuelle Schwelle liegt bei etwa 142 m.'],tips:['Verschwende nicht deine letzte Kugel.','Die Lenkrakete wird mit dem nächsten Schuss verbraucht; richte dein Schiff vor dem Start ungefähr auf das Ziel aus.','Kugeln verschwinden außerhalb der Arena und können kleine Meteore zerstören oder schwebende Verbesserungen entfernen.']},
        {id:'pickups',title:'5. Schwebende Verbesserungen',body:['Verbesserungen erscheinen regelmäßig. Maximal 5 können gleichzeitig vorhanden sein. Wenn die älteste gleich ersetzt wird, blinkt sie in den letzten 2 Sekunden zwischen 50 % und 100 % Deckkraft.','Asteroiden und Meteore können Verbesserungen beim Durchqueren zerstören.'],pickups:[['ammo1','MUNITION +1','Fügt 1 Schuss hinzu.'],['ammo3','MUNITION +6','Fügt 6 Schüsse hinzu.'],['cadence','FEUERRATE','Erlaubt häufigeres Feuern; hohe Stufen machen Projektile zusätzlich schneller.'],['mira','ZIELHILFE · LENKRAKETE','Macht den nächsten Schuss zur Lenkrakete. Bei 0 Munition gibt sie zusätzlich 1 Schuss.'],['speed','GESCHWINDIGKEIT','Erhöht die Schiffsgeschwindigkeit in +0,5-Schritten bis x2.'],['shield','SCHILD','Schützt dich 10 s lang. Rammst und zerstörst du ein Schiff ohne Schild, übernimmst du seine Munition und Verbesserungen.'],['camo','UNSICHTBARKEIT','Nur online. Aktiviert 10 s lang den Geistmodus. Symbol: durchgestrichenes Auge.']]},
        {id:'ghost',title:'6. Geistmodus',body:['Unsichtbarkeit dauert 10 Sekunden und gibt es nur online. Gegner sehen dein Schiff nicht dauerhaft.','Im Geistmodus erscheint neben dem HUD eine halbtransparente Kapsel in Spielerfarbe mit dem Text GEIST. Das unsichtbare Schiff wird ungefähr alle 4 Sekunden kurz sichtbar.','Das eigene Schiff bleibt für den Spieler teilweise sichtbar, damit es präzise steuerbar bleibt.','Geistmodus und Anzeige sind sowohl auf PC als auch auf Mobilgeräten sichtbar.'],tips:['Ändere nach jeder Sichtbarkeit deine Richtung, damit Gegner die Flugbahn schlechter vorhersagen können.']},
        {id:'hazards',title:'7. Asteroiden und Meteore',body:['Weiche Asteroiden und Meteoren aus: Sie können dein Schiff zerstören.','Kleine Meteore aus dem Meteorschauer kannst du abschießen.']},
        {id:'death',title:'8. Tode, Strafen und Respawn',body:['Zerstört dich ein anderer Spieler, erhält der Angreifer einen Abschuss. Stirbst du durch eine Arenagefahr oder eine Kollision ohne Angreifer, verlierst du 1 Abschuss, falls du einen hattest; der Wert fällt nie unter 0.','Beim Tod verlierst du Munition, Geschwindigkeits- und Feuerratenverbesserungen, Schild und Unsichtbarkeit. Du spawnst ohne Munition und mit zurückgesetzten Verbesserungen.','Nach dem Respawn bist du ungefähr 3 Sekunden geschützt.']},
        {id:'cpu',title:'9. Gegen die CPU',body:['Wähle EINFACH, MITTEL oder SCHWER. Die CPU vermeidet Hindernisse und ändert ihre Prioritäten abhängig von ihren Ressourcen.','Ohne Munition und Schild verfolgt sie dich nicht: sie sucht Munition. Gibt es keine, flieht sie und versucht Abstand zu halten.','Mit Schild aber ohne Munition kann sie dich rammen, wenn du weder Schild noch Spawn-Schutz hast. Mit Munition kehrt sie zu ihrem offensiven Verhalten zurück.']},
        {id:'online',title:'10. Online, Räume, Chat und Sprache',body:[
          'Um ein Online-Spiel zu erstellen, gib zuerst deinen Namen ein und warte, bis der Server als bereit angezeigt wird. Drücke dann SPIEL ERSTELLEN. Wähle ÖFFENTLICH, damit der Raum in der Liste erscheint, oder PRIVAT, damit er nur mit dem 4-stelligen Code geöffnet werden kann.',
          'Erstellst du allein einen ÖFFENTLICHEN Raum, kannst du MIT CPU AUFFÜLLEN wählen: Die 3 freien Plätze werden mit schweren CPUs besetzt und du kannst sofort starten, während du auf weitere Spieler wartest.',
          'Der öffentliche Raum bleibt während des CPU-Spiels beitretbar. Kommt ein menschlicher Spieler dazu, ersetzt er eine CPU ohne Neustart und beginnt mit 0 Abschüssen, 5 Schüssen und ohne Verbesserungen.',
          'RAUM TEILEN kopiert einen direkten Link. Du kannst ihn über WhatsApp, Telegram, E-Mail oder jede andere App senden. Wer den Link öffnet, startet Galaxy Combat und das Spiel versucht, ihn direkt in diesen Raum zu setzen, ohne Suche oder Codeeingabe.',
          'Alternativ kannst du normal über BEITRETEN einen öffentlichen Raum auswählen oder den 4-stelligen Code eines privaten Raums eingeben.',
          'Nach dem Beitritt gelangst du in die Lobby. Dort siehst du verbundene Spieler, kannst den Textchat nutzen und Sprache aktivieren. Der Host drückt STARTEN, sobald genug Spieler bereit sind.',
          'Im Raum kannst du Chat und Sprache verwenden. Halte die Mikrofontaste gedrückt, um zu sprechen.'
        ],stepsTitle:'ERSTELLEN ODER BEITRETEN - SCHRITT FÜR SCHRITT',steps:[
          ['1. Namen eingeben','Trage auf dem Hauptbildschirm deinen Spielernamen ein und warte, bis der Server als bereit angezeigt wird.'],
          ['2. Spiel erstellen','Drücke SPIEL ERSTELLEN und wähle ÖFFENTLICH oder PRIVAT.'],
          ['3. Mit CPU auffüllen','Bist du allein in einem öffentlichen Raum, wähle MIT CPU AUFFÜLLEN. Die 3 freien Plätze werden mit schweren CPUs besetzt und du kannst sofort starten.'],
          ['4. Raum teilen','Drücke RAUM TEILEN, um den direkten Link zu kopieren, und sende ihn über WhatsApp, Telegram, E-Mail oder eine andere App.'],
          ['5. Weiterspielen, während Spieler dazukommen','Spiele gegen die CPUs weiter. Jeder menschliche Spieler ersetzt beim Beitritt eine CPU, ohne die Partie neu zu starten.'],
          ['6. Privater Raum','Bei einem privaten Raum kannst du ebenfalls den direkten Link oder den 4-stelligen Code teilen.'],
          ['7. Öffentlichem Raum beitreten','Drücke BEITRETEN und wähle einen verfügbaren öffentlichen Raum.'],
          ['8. Mit Code beitreten','Gib den 4-stelligen Code ein, um einem privaten Raum beizutreten.'],
          ['9. Starten','Der Host startet jederzeit; mit CPU-Auffüllung kann die Partie auch mit nur einem Menschen beginnen.']
        ],media:[
          ['assets/manual/portada.webp','Galaxy-Combat-Hauptbildschirm.','Von hier aus kannst du gegen die CPU spielen, ein Online-Spiel erstellen oder einem Raum beitreten.'],
          ['assets/manual/crear-partida.webp','Schaltfläche Spiel erstellen.','SPIEL ERSTELLEN öffnet die Wahl zwischen öffentlichem und privatem Raum.'],
          ['assets/manual/unirse-sala.webp','Schaltfläche Beitreten.','BEITRETEN öffnet die öffentlichen Räume und die Code-Eingabe für private Räume.'],
          ['assets/manual/partida.webp','Beispiel einer Partie.','Nach dem Start behält jeder Spieler sein HUD, seine Schiffsfarbe und seine Steuerung.']
        ],tips:['Beim Wechsel von WLAN zu mobilen Daten einige Sekunden warten, bevor du das Spiel verlässt.','Auf PC ist V Push-to-talk; mobil nutzt du die Sprechtaste auf dem Bildschirm.']},
        {id:'end',title:'11. Spielende und Revanche',body:['Erreicht jemand 5 Abschüsse, erscheint der Sieg-Bildschirm. Wähle NOCHMAL SPIELEN für dieselbe Runde mit denselben Spielern oder HAUPTMENÜ zum Verlassen.','Die Revanche setzt Punkte, Munition, Verbesserungen, Meteore, Asteroiden und Spawnpositionen zurück.']},
        {id:'pwa',title:'12. Als App installieren',body:['Galaxy Combat ist eine PWA. Auf iPhone/iPad in Safari öffnen, Teilen tippen und Zum Home-Bildschirm wählen. Auf Android/Chrome App installieren oder Zum Startbildschirm hinzufügen verwenden.','Vom Icon gestartet wirkt das Spiel stärker wie eine App und zeigt weniger Browser-Oberfläche. Querformat ist vorgesehen.','Der Hauptcode wird bevorzugt aus dem Netz geladen, um veraltete Versionen zu vermeiden; Bilder, Sounds und Schriften werden für schnelleren Start gecacht.']},
        {id:'tips',title:'13. Kampftipps',body:['Verfolge Gegner nicht immer geradlinig: nutze Asteroiden als Deckung und variiere deine Flugbahn.','Prüfe deine Munition, bevor du eine Verfolgung startest.','Ein Schild ist nicht nur defensiv: gegen ein ungeschütztes Schiff kann er eine Rammchance eröffnen.','Geschwindigkeit und Feuerrate sind stark, werden beim Tod aber zurückgesetzt. Manchmal ist Ausweichen besser als ein riskanter Kampf.']},
        {id:'thanks',title:'14. Danke',body:['Danke für dein Interesse an Galaxy Combat.','Ich hoffe, du hast viel Spaß beim Spielen. Wir sehen uns im Kampf!']}
      ]
    }
  };


  const CONTROL_FLARE_GUIDE = {
    es: {
      visual:{mobileTitle:'MOVIL · BOTONES',turn:'GIRAR',fire:'DISPARO',oneTap:'1 TOQUE',bullet:'BALA',doubleTap:'2 TOQUES',flares:'BENGALAS',shockwave:'ONDA EXPANSIVA',specialPriority:'ONDA primero · luego BENGALAS',hold:'MANTENER',accelerate:'ACELERAR',pcTitle:'PC · TECLADO',pcTap:'TOQUE',pcHold:'MANTENER',wait:'3 s entre bengalas'},
      pc:'PC: A / D o flechas para girar; W para acelerar; CTRL o ESPACIO para disparar. Mantén disparo para usar el arma especial: si llevas ESFERA se activa primero la ONDA EXPANSIVA; si no, se lanzan bengalas. ESC sale de la partida.',
      mobile:'Movil: horizontal. Flechas de la izquierda para girar. En la derecha: un toque dispara, doble toque usa el arma especial y mantener pulsado acelera. Si llevas ESFERA y bengalas, el doble toque activa primero la ONDA EXPANSIVA; despues podras seguir usando las bengalas acumuladas.',
      tip:'La ESFERA y las bengalas usan el mismo gesto especial. La ONDA EXPANSIVA tiene prioridad y no consume las bengalas que tengas guardadas.',
      flare:['flare','BENGALAS','Cada carga despliega tres bengalas durante 3 s. Entre un lanzamiento y el siguiente deben pasar al menos 3 s, aunque lleves varias cargas. Desvian misiles, bloquean balas, pueden romper escudos o destruir naves al chocar; si tu bengala destruye a un rival, esa baja se suma a tu marcador. Tambien destruyen los meteoritos pequenos de la lluvia. Si chocan con el meteorito gigante, la bengala explota pero el gigante sigue. PC: mantén disparo; movil: doble toque rapido. No necesitan municion ni arma cargada.'],
      shockwave:['shockwave','ESFERA · ONDA EXPANSIVA','Mejora rara y no acumulable: solo puedes llevar 1 carga. Se indica con un pequeno circulo en la parte trasera de la nave. PC: mantén disparo; movil: doble toque rapido, igual que las bengalas. Si tienes esfera y bengalas, la ONDA tiene prioridad y las bengalas quedan guardadas para despues. La onda se expande hasta 30 m. Destruye naves sin escudo; si una nave lleva escudo, rompe el escudo pero la nave sobrevive. Respeta la proteccion de aparicion. Tambien deshace balas, misiles guiados y bengalas desplegadas, destruye meteoritos pequenos de la lluvia y aparta los asteroides normales y el meteorito gigante sin destruirlos.'],
      hazard:'Meteorito pequeno: se destruyen los dos. Meteorito gigante: la bengala explota y desaparece, pero el gigante sigue intacto.'
    },
    en: {
      visual:{mobileTitle:'MOBILE · BUTTONS',turn:'TURN',fire:'FIRE',oneTap:'1 TAP',bullet:'SHOT',doubleTap:'2 TAPS',flares:'FLARES',shockwave:'SHOCKWAVE',specialPriority:'SHOCKWAVE first · then FLARES',hold:'HOLD',accelerate:'ACCELERATE',pcTitle:'PC · KEYBOARD',pcTap:'TAP',pcHold:'HOLD',wait:'3 s between flares'},
      pc:'PC: A / D or arrow keys to turn; W to accelerate; CTRL or SPACE to fire. Hold fire to deploy flares. ESC leaves the match.',
      mobile:'Mobile: landscape. Use the left arrows to turn. On the right: tap to fire, double tap for flares, hold to accelerate.',
      tip:'Simple controls: turn left, turn right, fire and accelerate.',
      flare:['flare','FLARES','Each charge deploys three flares for 3 s. At least 3 s must pass before the same ship can deploy another charge, even if several are stored. They divert guided missiles, block bullets, can break shields or destroy ships on contact; if your flare destroys a rival, the kill is added to your score. They also destroy small meteors in meteor showers. If they hit the giant meteor, the flare explodes but the giant remains. PC: hold fire; mobile: quick double tap. No ammo or loaded weapon is required.'],
      shockwave:['shockwave','SPHERE · SHOCKWAVE','Rare, non-stackable upgrade: you can carry only 1 charge. A small circle behind the ship shows that it is loaded. PC: hold fire; mobile: quick double tap, the same gesture as flares. If you carry both, the shockwave has priority and your stored flares remain available afterwards. The wave expands to 30 m. It destroys unshielded ships; a shield is broken but its ship survives. Spawn protection is respected. It also clears bullets, guided missiles and deployed flares, destroys small shower meteors, and pushes normal asteroids and the giant meteor away without destroying them.'],
      hazard:'Small meteor: both are destroyed. Giant meteor: the flare explodes and disappears, but the giant meteor is unaffected.'
    },
    it: {
      visual:{mobileTitle:'MOBILE · PULSANTI',turn:'GIRA',fire:'SPARO',oneTap:'1 TOCCO',bullet:'COLPO',doubleTap:'2 TOCCHI RAPIDI',flares:'BENGALA',shockwave:'ONDA ESPANSIVA',specialPriority:'ONDA prima · poi BENGALA',hold:'TIENI PREMUTO',accelerate:'ACCELERA',pcTitle:'PC · TASTIERA',pcTap:'TOCCO BREVE',pcHold:'TIENI 0,22 s',wait:'3 s tra i lanci'},
      pc:'PC: A / D o frecce sinistra / destra per girare; W o freccia su per accelerare. CTRL o SPAZIO: tocco breve = sparo normale; tieni premuto per circa 0,22 s = lancia le bengala equipaggiate. Le bengala funzionano anche con 0 munizioni o arma non carica. ESC esce dalla partita.',
      mobile:'Mobile: gioca in orizzontale e usa solo i pulsanti touch. Le frecce nella meta sinistra fanno girare la nave. Nella meta destra: tocco rapido = sparo normale; due tocchi rapidi consecutivi (entro circa 0,35 s) = bengala; tieni premuto = accelera. Le bengala non richiedono un colpo carico.',
      tip:'Comandi semplici: gira a sinistra, gira a destra, spara e accelera.',
      flare:['flare','BENGALA','Ogni carica dispiega tre bengala per 3 s. Tra un lancio e il successivo devono passare almeno 3 s, anche con piu cariche disponibili. Deviano i missili guidati, bloccano i proiettili, possono rompere gli scudi o distruggere navi al contatto; se una tua bengala distrugge un rivale, l eliminazione viene aggiunta al tuo punteggio. Distruggono anche le meteore piccole della pioggia. Se colpiscono il meteorite gigante, la bengala esplode ma il gigante continua. PC: tieni premuto il fuoco; mobile: doppio tocco rapido. Non servono munizioni ne arma carica.'],
      shockwave:['shockwave','SFERA · ONDA ESPANSIVA','Potenziamento raro e non cumulabile: puoi portare 1 sola carica. Un piccolo cerchio dietro la nave indica che e pronta. PC: tieni premuto il fuoco; mobile: doppio tocco rapido. Se hai anche bengala, l onda ha priorita e le bengala restano disponibili. Raggio 30 m: distrugge navi senza scudo; con scudo, rompe lo scudo ma la nave sopravvive. Rispetta la protezione di comparsa. Elimina proiettili, missili guidati e bengala dispiegate, distrugge le meteore piccole e spinge via asteroidi normali e meteorite gigante senza distruggerli.'],
      hazard:'Meteorite piccolo: si distruggono entrambi. Meteorite gigante: la bengala esplode e scompare, ma il gigante resta intatto.'
    },
    fr: {
      visual:{mobileTitle:'MOBILE · BOUTONS',turn:'TOURNER',fire:'TIR',oneTap:'1 TOUCHE',bullet:'TIR',doubleTap:'2 TOUCHES RAPIDES',flares:'LEURRES',shockwave:'ONDE DE CHOC',specialPriority:'ONDE d abord · puis LEURRES',hold:'MAINTENIR',accelerate:'ACCELERER',pcTitle:'PC · CLAVIER',pcTap:'APPUI BREF',pcHold:'MAINTENIR 0,22 s',wait:'3 s entre les lancers'},
      pc:'PC : A / D ou fleches gauche / droite pour tourner; W ou fleche haut pour accelerer. CTRL ou ESPACE : appui bref = tir normal; maintenir environ 0,22 s = deployer les leurres equipes. Les leurres fonctionnent meme avec 0 munition ou une arme non chargee. ESC quitte la partie.',
      mobile:'Mobile : joue en paysage et utilise uniquement les boutons tactiles. Les fleches de la moitie gauche font tourner le vaisseau. A droite : touche rapide = tir normal; deux touches rapides successives (environ 0,35 s) = deployer les leurres; maintenir = accelerer. Les leurres ne demandent pas de munition chargee.',
      tip:'Sur mobile il n y a plus de controle par inclinaison : la rotation se fait uniquement avec les boutons/fleches de gauche.',
      flare:['flare','LEURRES','Chaque charge deploie trois leurres pendant 3 s. Il faut attendre au moins 3 s avant de deployer une autre charge avec le meme vaisseau, meme si plusieurs charges sont disponibles. Ils detournent les missiles guides, bloquent les tirs, peuvent briser les boucliers ou detruire un vaisseau au contact; si ton leurre detruit un rival, l elimination est ajoutee a ton score. Ils detruisent aussi les petites meteorites de la pluie. S ils touchent la meteorite geante, le leurre explose mais le geant continue. PC : maintenir le tir; mobile : double touche rapide. Aucune munition chargee n est necessaire.'],
      shockwave:['shockwave','SPHERE · ONDE DE CHOC','Amelioration rare et non cumulable : une seule charge peut etre portee. Un petit cercle derriere le vaisseau indique qu elle est prete. PC : maintenir le tir; mobile : double touche rapide. Si tu as aussi des leurres, l onde a priorite et les leurres restent disponibles. Rayon de 30 m : detruit les vaisseaux sans bouclier; avec bouclier, le bouclier est detruit mais le vaisseau survit. La protection de reapparition est respectee. Elle elimine aussi tirs, missiles guides et leurres deployes, detruit les petites meteorites et repousse les asteroides et la meteorite geante sans les detruire.'],
      hazard:'Petite meteorite : les deux sont detruits. Meteorite geant : le leurre explose et disparait, mais le geant reste intact.'
    },
    de: {
      visual:{mobileTitle:'MOBIL · TASTEN',turn:'DREHEN',fire:'FEUER',oneTap:'1 TIPP',bullet:'SCHUSS',doubleTap:'2 SCHNELLE TIPPS',flares:'FLARES',shockwave:'SCHOCKWELLE',specialPriority:'SCHOCKWELLE zuerst · dann FLARES',hold:'HALTEN',accelerate:'BESCHLEUNIGEN',pcTitle:'PC · TASTATUR',pcTap:'KURZ DRUECKEN',pcHold:'0,22 s HALTEN',wait:'3 s zwischen Ausloesungen'},
      pc:'PC: A / D oder Pfeil links / rechts zum Drehen; W oder Pfeil hoch zum Beschleunigen. CTRL oder LEERTASTE: kurz tippen = normal feuern; etwa 0,22 s halten = ausgeruestete Flares ausstossen. Flares funktionieren auch mit 0 Munition oder ungeladener Waffe. ESC verlaesst das Spiel.',
      mobile:'Mobil: im Querformat spielen und nur die Touch-Tasten verwenden. Die Pfeile auf der linken Haelfte drehen das Schiff. Rechts: kurz tippen = normal feuern; zweimal schnell hintereinander tippen (ca. innerhalb 0,35 s) = Flares; halten = beschleunigen. Flares brauchen keine geladene Munition.',
      tip:'Mobil gibt es keine Neigungssteuerung mehr: gedreht wird ausschliesslich mit den linken Pfeiltasten.',
      flare:['flare','FLARES','Jede Ladung setzt drei Flares fuer 3 s aus. Vor der naechsten Ladung desselben Schiffs muessen mindestens 3 s vergehen, auch wenn mehrere Ladungen vorhanden sind. Sie lenken Lenkraketen ab, blockieren Schuesse, koennen Schilde brechen oder Schiffe bei Kontakt zerstoeren; zerstoert dein Flare einen Gegner, wird dir der Abschuss gutgeschrieben. Sie zerstoeren auch kleine Meteore des Schauers. Treffen sie den Riesenmeteor, explodiert die Flare, der Riesenmeteor fliegt weiter. PC: Feuer halten; mobil: schneller Doppeltipp. Keine Munition oder geladene Waffe erforderlich.'],
      shockwave:['shockwave','SPHAERE · SCHOCKWELLE','Seltenes, nicht stapelbares Upgrade: nur 1 Ladung kann getragen werden. Ein kleiner Kreis hinter dem Schiff zeigt die Ladung an. PC: Feuer halten; mobil: schneller Doppeltipp. Sind auch Flares vorhanden, hat die Schockwelle Vorrang und die Flares bleiben gespeichert. Radius 30 m: zerstoert Schiffe ohne Schild; bei Schild wird nur der Schild zerstoert und das Schiff ueberlebt. Respawn-Schutz bleibt wirksam. Die Welle entfernt auch Kugeln, Lenkraketen und aktive Flares, zerstoert kleine Meteore und stoesst normale Asteroiden sowie den Riesenmeteor weg, ohne sie zu zerstoeren.'],
      hazard:'Kleiner Meteor: beide werden zerstoert. Riesenmeteor: die Flare explodiert und verschwindet, der Riesenmeteor bleibt unbeschaedigt.'
    }
  };

  const ENHANCEMENTS = {
    es: {
      noticeLabel: 'IMPORTANTE',
      controlsNotice: 'IMPORTANTE: si no aceleras, la nave no avanza. El movimiento tiene inercia y deslizamiento, asi que debes ir corrigiendo la trayectoria girando la nave mientras te desplazas.',
      onlineNotice: 'PUEDES EMPEZAR A JUGAR AUNQUE ESTES SOLO: crea una partida publica, pulsa RELLENAR CON CPU y las plazas libres se completaran con CPU. Cuando entren jugadores reales, iran sustituyendo a las CPU sin reiniciar la partida.',
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
      onlineNotice: 'YOU CAN START PLAYING EVEN IF YOU ARE ALONE: create a public game and press FILL WITH CPU. Empty slots are filled with CPUs, and real players replace them as they join without restarting the match.',
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
      onlineNotice: 'PUOI INIZIARE ANCHE SE SEI SOLO: crea una partita pubblica e usa RIEMPI CON CPU. I posti liberi vengono occupati dalle CPU e i giocatori reali le sostituiscono entrando, senza riavviare la partita.',
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
      onlineNotice: 'TU PEUX COMMENCER MEME SI TU ES SEUL : cree une partie publique et utilise REMPLIR AVEC CPU. Les places libres sont occupees par des CPU, puis les vrais joueurs les remplacent en rejoignant la partie sans la redemarrer.',
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
      onlineNotice: 'DU KANNST AUCH ALLEIN SOFORT STARTEN: Erstelle ein oeffentliches Spiel und waehle MIT CPU AUFFUELLEN. Freie Plaetze werden mit CPUs besetzt und echte Spieler ersetzen sie spaeter, ohne die Partie neu zu starten.',
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
      const guide = CONTROL_FLARE_GUIDE[lang];
      const controls = pack.sections.find(section => section.id === 'controls');
      if(controls){
        controls.noticeLabel = patch.noticeLabel || 'IMPORTANT';
        controls.notice = patch.controlsNotice;
        if(guide){
          controls.body[0]=guide.pc;
          controls.body[1]=guide.mobile;
          controls.controlVisual=guide.visual||null;
          if(Array.isArray(controls.tips)&&controls.tips.length)controls.tips[0]=guide.tip;
        }
      }
      const online = pack.sections.find(section => section.id === 'online');
      if(online&&patch.onlineNotice){
        online.noticeLabel = patch.noticeLabel || 'IMPORTANT';
        online.notice = patch.onlineNotice;
      }
      const hud = pack.sections.find(section => section.id === 'hud');
      if(hud){
        hud.diagram = {
          title: patch.hudDiagramTitle,
          src: 'assets/manual/hud.png',
          alt: patch.hudDiagramAlt,
          caption: patch.hudDiagramCaption,
          items: patch.hudLegend.map((item,index)=>[
            item[0],
            item[1],
            index===0?'assets/sprites/municion1.png':
            index===1?'assets/sprites/cadencia.png':
            index===2?'assets/sprites/velocidad.png':''
          ])
        };
      }
      const weapons = pack.sections.find(section => section.id === 'weapons');
      if(weapons){
        weapons.weaponStateTitle = patch.weaponStateTitle;
        weapons.weaponStates = patch.weaponStates;
      }
      if(guide){
        const pickups = pack.sections.find(section => section.id === 'pickups');
        if(pickups&&Array.isArray(pickups.pickups)&&!pickups.pickups.some(item=>item&&item[0]==='flare'))pickups.pickups.push(guide.flare);
        if(pickups&&Array.isArray(pickups.pickups)&&guide.shockwave&&!pickups.pickups.some(item=>item&&item[0]==='shockwave'))pickups.pickups.push(guide.shockwave);
        // V19.82: la sección de meteoritos se mantiene deliberadamente breve.
        // Los detalles de las bengalas se explican en la propia mejora BENGALAS.
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
    if(kind==='mira')return '<img src="assets/sprites/mira1.png" alt="" loading="lazy">';
    if(kind==='speed')return '<img src="assets/sprites/velocidad.png" alt="" loading="lazy">';
    if(kind==='flare')return '<img src="assets/sprites/bengalahud.png" alt="" loading="lazy">';
    if(kind==='shockwave')return '<span aria-hidden="true" style="display:inline-flex;width:34px;height:34px;border:2px solid #9edcff;border-radius:50%;align-items:center;justify-content:center;color:#fff;font-size:22px;line-height:1">●</span>';
    if(kind==='shield')return '<span class="manual-vector-icon manual-shield-icon" aria-hidden="true"></span>';
    if(kind==='camo')return '<img src="assets/sprites/ojo.png" alt="" loading="lazy">';
    return '<span class="manual-vector-icon manual-eye-icon" aria-hidden="true"><i></i></span>';
  }
  function renderControlVisual(section){
    const v=section&&section.controlVisual;
    if(!v)return '';
    const bullet='assets/sprites/municion1.png';
    const flare='assets/sprites/bengalahud.png';
    const shock='<span aria-hidden="true" style="display:inline-flex;width:30px;height:30px;border:2px solid #9edcff;border-radius:50%;align-items:center;justify-content:center;color:#fff;font-size:18px;line-height:1;box-shadow:0 0 8px rgba(158,220,255,.65)">●</span>';
    const fireKey='<span class="manual-demo-fire">'+escapeHtml(v.fire)+'</span>';
    return '<div class="manual-control-visual">'
      +'<div class="manual-control-visual-title">'+escapeHtml(v.mobileTitle)+'</div>'
      +'<div class="manual-phone-demo">'
        +'<div class="manual-phone-turn"><div class="manual-demo-arrows"><span>◀</span><span>▶</span></div><b>'+escapeHtml(v.turn)+'</b></div>'
        +'<div class="manual-phone-fire">'+fireKey+'<small>'+escapeHtml(v.hold)+' = '+escapeHtml(v.accelerate)+'</small></div>'
      +'</div>'
      +'<div class="manual-action-examples">'
        +'<div class="manual-action-example shot"><div class="manual-action-input">'+fireKey+'<span class="manual-action-count">×1</span></div><span class="manual-action-arrow">→</span><div class="manual-action-result"><img src="'+bullet+'" alt=""><strong>'+escapeHtml(v.bullet)+'</strong><small>'+escapeHtml(v.oneTap)+'</small></div></div>'
        +'<div class="manual-action-example flare"><div class="manual-action-input">'+fireKey+'<span class="manual-action-plus">+</span>'+fireKey+'</div><span class="manual-action-arrow">→</span><div class="manual-action-result">'+shock+'<strong>'+escapeHtml(v.shockwave||'ONDA')+'</strong><small>'+escapeHtml(v.doubleTap)+'</small><span class="manual-action-plus">+</span><img src="'+flare+'" alt=""><strong>'+escapeHtml(v.flares)+'</strong><em>'+escapeHtml(v.specialPriority||v.wait)+'</em></div></div>'
        +'<div class="manual-action-example thrust"><div class="manual-action-input">'+fireKey+'<span class="manual-hold-mark">'+escapeHtml(v.hold)+'</span></div><span class="manual-action-arrow">→</span><div class="manual-action-result manual-action-text"><strong>'+escapeHtml(v.accelerate)+'</strong></div></div>'
      +'</div>'
      +'<div class="manual-pc-demo"><strong>'+escapeHtml(v.pcTitle)+'</strong>'
        +'<div><span class="manual-keycap">A</span><span class="manual-key-or">/</span><span class="manual-keycap">D</span><span class="manual-key-or">·</span><span class="manual-keycap" aria-label="izquierda">←</span><span class="manual-key-or">/</span><span class="manual-keycap" aria-label="derecha">→</span><span class="manual-action-arrow">→</span><b>'+escapeHtml(v.turn)+'</b></div>'
        +'<div><span class="manual-keycap">CTRL</span><span class="manual-key-or">/</span><span class="manual-keycap">ESPACIO</span><span>'+escapeHtml(v.pcTap)+'</span><span class="manual-action-arrow">→</span><img src="'+bullet+'" alt=""><b>'+escapeHtml(v.bullet)+'</b></div>'
        +'<div><span class="manual-keycap">CTRL</span><span class="manual-key-or">/</span><span class="manual-keycap">ESPACIO</span><span>'+escapeHtml(v.pcHold)+'</span><span class="manual-action-arrow">→</span>'+shock+'<b>'+escapeHtml(v.shockwave||'ONDA')+'</b><span class="manual-key-or">/</span><img src="'+flare+'" alt=""><b>'+escapeHtml(v.flares)+'</b><small>'+escapeHtml(v.specialPriority||'')+'</small></div>'
      +'</div>'
    +'</div>';
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
      const controlVisual=renderControlVisual(section);
      const notice=section.notice?'<div class="manual-alert"><strong>'+escapeHtml(section.noticeLabel||'IMPORTANT')+'</strong><p>'+escapeHtml(section.notice)+'</p></div>':'';
      const tips=section.tips&&section.tips.length?'<div class="manual-tips">'+section.tips.map(t=>'<div><span aria-hidden="true">✦</span><p>'+escapeHtml(t)+'</p></div>').join('')+'</div>':'';
      const pickups=section.pickups?'<div class="manual-pickup-grid">'+section.pickups.map(([kind,name,desc])=>'<article class="manual-pickup"><div class="manual-pickup-icon">'+pickupIcon(kind)+'</div><div><h4>'+escapeHtml(name)+'</h4><p>'+escapeHtml(desc)+'</p></div></article>').join('')+'</div>':'';
      const steps=section.steps&&section.steps.length?'<div class="manual-steps"><h4>'+escapeHtml(section.stepsTitle||'')+'</h4>'+section.steps.map(([name,desc])=>'<article class="manual-step"><h5>'+escapeHtml(name)+'</h5><p>'+escapeHtml(desc)+'</p></article>').join('')+'</div>':'';
      const media=section.media&&section.media.length?'<div class="manual-media-grid">'+section.media.map(([src,alt,caption])=>'<figure class="manual-media"><img src="'+escapeHtml(src)+'" alt="'+escapeHtml(alt)+'" loading="lazy"><figcaption>'+escapeHtml(caption)+'</figcaption></figure>').join('')+'</div>':'';
      const diagram=section.diagram?'<div class="manual-diagram"><h4>'+escapeHtml(section.diagram.title||'')+'</h4><div class="manual-diagram-layout"><figure class="manual-diagram-figure"><img src="'+escapeHtml(section.diagram.src)+'" alt="'+escapeHtml(section.diagram.alt||'')+'" loading="lazy"><figcaption>'+escapeHtml(section.diagram.caption||'')+'</figcaption></figure><div class="manual-diagram-items">'+(section.diagram.items||[]).map(([name,desc,icon])=>'<article class="manual-diagram-item"><div class="manual-diagram-item-head">'+(icon?'<img class="manual-diagram-item-icon" src="'+escapeHtml(icon)+'" alt="" loading="lazy">':'')+'<h5>'+escapeHtml(name)+'</h5></div><p>'+escapeHtml(desc)+'</p></article>').join('')+'</div></div></div>':'';
      const weaponStates=section.weaponStates&&section.weaponStates.length?'<div class="manual-weapon-states"><h4>'+escapeHtml(section.weaponStateTitle||'')+'</h4><div class="manual-weapon-state-grid">'+section.weaponStates.map(([src,name,desc],idx)=>'<article class="manual-weapon-state '+(idx===1?'ready':'not-ready')+'"><div class="manual-weapon-state-image"><img src="'+escapeHtml(src)+'" alt="'+escapeHtml(name)+'" loading="lazy"></div><div><h5>'+escapeHtml(name)+'</h5><p>'+escapeHtml(desc)+'</p></div></article>').join('')+'</div></div>':'';
      return '<section id="manual-'+section.id+'" class="manual-section" data-section="'+section.id+'"><h3>'+escapeHtml(stripFlashbackText(section.title))+'</h3>'+body+controlVisual+notice+diagram+weaponStates+steps+media+pickups+tips+'</section>';
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
