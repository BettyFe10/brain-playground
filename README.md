# Brain Playground

Giochi di logica personali, senza pubblicità, utilizzabili anche offline.

## Giochi
- **Sudoku**: 4 livelli di difficoltà, griglie generate sul momento con soluzione unica, note, annulla, aiuti, statistiche e salvataggio automatico.

## Struttura
- `index.html` - app completa (HTML, CSS e JS in un unico file)
- `sw.js` - service worker per il funzionamento offline
- `manifest.webmanifest` - rende l'app installabile sul telefono
- `icons/` - icone dell'app
- `.nojekyll` - dice a GitHub Pages di pubblicare i file così come sono

## Pubblicazione
Il sito è pubblicato con GitHub Pages dal branch `main`, cartella root:
https://bettyfe10.github.io/brain-playground/

Ogni push su `main` aggiorna il sito in 1-2 minuti.

## Aggiornamenti
Dopo ogni modifica, aumenta `VERSION` in `sw.js` (es. `brain-playground-v2`) così i dispositivi scaricano la nuova versione.
