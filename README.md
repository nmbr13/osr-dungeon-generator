# Bite-Sized Dungeon Generator

A two-panel web app for generating and editing small dungeons as force-directed graphs, based on the [Bite-Sized Dungeons](https://traversefantasy.blogspot.com/2022/11/bite-sized-dungeons.html) method.

## Features

- **Left panel**: Room list and editor. Select a room to edit its name, markdown content, and entrance flag. Add new connections between rooms and set connection type (doorway, corridor, stuck door). Use “Explode into 6-room dungeon” to replace a room with a full 6-room sub-dungeon.
- **Right panel**: Interactive force-directed graph. Click nodes to select (syncs with left panel), click edges to set connection type, drag nodes to rearrange.
- **Export**: “Export markdown” downloads a single markdown file containing an embedded image of the dungeon graph and all room writeups (entrance rooms first, then the rest).

## Recipe (6 rooms)

Each generated dungeon has:

- 1 monster room with treasure  
- 1 monster room without treasure  
- 1 unoccupied room with treasure (hidden or trapped)  
- 3 empty rooms (one may be “special”)

Layouts are chosen from 10 fixed 6-node, 6-edge graphs with at least one loop. Connection types are rolled (doorway, 1-turn corridor, 2-turn corridor, stuck door).

## Run locally

```bash
npm install
npm run dev
```

Then open the URL shown (e.g. http://localhost:5173).

## Build

```bash
npm run build
```

Output is in `dist/`.
