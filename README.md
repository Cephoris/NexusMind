# NexusMind — Clone de XMind avec tldraw

NexusMind est une application de mind mapping construite sur le moteur de canvas infini **tldraw**, offrant une expérience similaire à XMind.

## ✨ Fonctionnalités

- **Canvas infini** propulsé par tldraw (zoom, pan, sélection)
- **Nœuds de mind map** personnalisés (Sujet central, branches, sous-sujets)
- **Branches courbées** automatiques entre les nœuds (Bezier SVG overlay)
- **Raccourcis clavier** : Tab (enfant), Enter (frère), Delete (supprimer), Espace (replier)
- **5 thèmes** : Dark, Light, Midnight, Forest, Sunset, Classic
- **20 marqueurs** (priorités, drapeaux, étoiles, etc.)
- **Panneau latéral** : Plan (outline), Marqueurs, Propriétés, Thème
- **Édition de propriétés** : titre, couleurs, taille de police, notes
- **Undo/Redo** natif tldraw
- **Sauvegarde/chargement** JSON
- **Export PNG** via SVG
- **Replier/déplier** les branches

## 🚀 Démarrage

```bash
npm install
npm run dev
```

→ http://localhost:5173

## 🛠️ Build

```bash
npm run build
```

## 🧱 Stack technique

- **tldraw** — moteur de canvas infini (rendering, zoom, pan, undo/redo)
- **React 19** + **TypeScript**
- **Vite** — bundler
- **Tailwind CSS 4** — styling
- **Lucide React** — icônes

## 📐 Architecture

```
src/
├── App.tsx                    — Composant principal + raccourcis clavier
├── styles.css                 — Styles globaux
├── mindmap/
│   ├── types.ts               — Types, thèmes, marqueurs, factory functions
│   ├── shapes.tsx             — Custom ShapeUtil (MindNode, MindBranch)
│   ├── layout.ts              — Layout engine + branch path generation
│   └── BranchOverlay.tsx      — Overlay SVG pour les branches courbées
├── components/
│   ├── Toolbar.tsx            — Barre d'outils
│   └── SidePanel.tsx           — Panneau latéral (outline, markers, props, theme)
```

## ⌨️ Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| Tab | Ajouter un sujet enfant |
| Enter | Ajouter un sujet frère |
| Delete | Supprimer le sujet |
| Espace | Replier/déplier |
| Ctrl+Z | Annuler |
| Ctrl+Y | Rétablir |

## 📄 Licence

MIT