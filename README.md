# Brain Playground

Giochi personali per allenare la testa. Niente pubblicità, niente account, niente tracciamento, funziona anche offline.

**Sito:** https://bettyfe10.github.io/brain-playground/

## Giochi

| Gioco | Tipo | Note |
|---|---|---|
| Sudoku | Logica | 4 livelli, griglie generate sul momento con soluzione unica |
| Nonogram | Logica | 5x5, 10x10, 15x15, sempre risolvibili con la sola logica |
| Calcudoku | Logica | Da 4x4 a 7x7, gabbie con + - × ÷, soluzione unica |
| Takuzu | Logica | Da 6x6 a 12x12, soluzione unica |
| Stelle | Logica | Star Battle da 5x5 a 8x8, soluzione unica |
| Parole | Parole | Parola del giorno e modalità libera, dizionario italiano incluso |
| Snake | Arcade | 3 velocità, con o senza muri, pad a pollice |
| Labirinto | Arcade | Labirinto nuovo a ogni livello, personaggi originali (Bip e i Brontoli) |
| Campo minato | Logica | Ogni griglia verificata: si risolve senza mai tirare a indovinare |
| Flow | Logica | Da 5x5 a 9x9, collega i colori e riempi la griglia |
| Lights Out | Logica | Da 4x4 a 7x7, con il numero minimo di mosse calcolato |
| Torre di Hanoi | Logica | Da 4 a 7 dischi, con aiuto alla mossa ottimale |
| Memory | Relax | Da 6 a 15 coppie, icone originali |
| Solitario | Relax | Klondike, pesca 1 o 3, tocco per spostare e completamento automatico |
| 2048 | Arcade | Swipe, annulla, record |

Tutte le griglie e i labirinti sono generati sul dispositivo: partite infinite, anche senza rete.

## Struttura

- `index.html`, `home.js` - pagina iniziale
- `<gioco>/index.html`, `<gioco>/app.js` - un gioco per cartella
- `shared/` - stile, funzioni comuni, font Nunito (licenza OFL), mascotte
- `sw.js` - service worker: alla prima apertura salva tutti i giochi per l'uso offline
- `manifest.webmanifest`, `icons/` - installazione come app sul telefono

## Sicurezza

- Content Security Policy rigida: solo script dal sito stesso, nessuno script inline, nessuna risorsa esterna.
- Nessuna richiesta di rete verso terzi, nessun cookie, nessun dato personale.
- I dati salvati (partite, statistiche) restano nel browser e vengono controllati prima dell'uso: un salvataggio corrotto fa ripartire il gioco pulito.

## Pubblicazione

GitHub Pages dal branch `main`, cartella root. Ogni push su `main` aggiorna il sito in 1-2 minuti.

**Dopo ogni modifica aumenta `VERSION` in `sw.js`** (es. `brain-playground-v3`), altrimenti i telefoni continuano a usare la versione salvata. Gli aggiornamenti arrivano alla seconda apertura dell'app.

## Crediti

- Parole accettate in "Parole": [an-array-of-italian-words](https://www.npmjs.com/package/an-array-of-italian-words) (MIT).
- Font: [Nunito](https://fonts.google.com/specimen/Nunito) (SIL Open Font License, vedi `shared/fonts/OFL-Nunito.txt`).
