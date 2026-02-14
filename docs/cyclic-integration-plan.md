# Cyclic Dungeon Integration Plan

Use the [Bite-Sized Dungeon Generator plan](.cursor/plans/bite-sized_dungeon_generator_e5a5a384.plan.md) as the basis (6 rooms, layouts, graph UI, export) and [Cyclic Dungeon Generation](https://dicegoblin.blog/making-meaningful-dungeons-with-cyclic-dungeon-generation/) (Dice Goblin / Sersa Victory / Unexplored) as the **framework for populating** the dungeon: what goes in each room and how corridors behave.

---

## Goal

- **Keep:** All existing behavior (10 layouts, 6 nodes/6 edges, force-directed graph, two-panel UI, explode, connect, rename, edge descriptions, export).
- **Add:** A “cycle” layer that drives **placement of monsters, treasure, keys, locks, and corridor roles** so each generated dungeon follows a meaningful pattern (lock-and-key, foreshadowing, two paths, shortcut, etc.) instead of random stocking.

---

## Cyclic Framework (simplified for 6 rooms)

The full system has 12 cycles; we adapt a subset that fits a 6-room graph:

| Cycle | Idea | Roles in 6 rooms |
|-------|------|------------------|
| **Lock & Key** | One obstacle (lock), one or two things needed (keys). Keys can be literal or “means to pass” (item, info, ally). | 1 start, 1 lock (goal), 1–2 key rooms, 2–3 path/hazard. |
| **Foreshadowing** | Tease the goal early; the path to it has trials. | 1 start, 1 goal (visible but blocked), 2–3 trial/hazard rooms, 1–2 path. |
| **Two Paths** | Two routes (e.g. two keys); both needed or one is shortcut. | 1 start, 1 goal, 2 “branch” rooms (keys/long paths), 2 path. |
| **Hidden Shortcut** | Main path is long; a hidden/short path bypasses part of it. | 1 start, 1 goal, 1–2 main-path rooms, 1 shortcut (edge or room), rest path. |

Roles we need to map onto the graph:

- **Start** – entrance; often an “empty” or light stocking.
- **Goal / Lock** – what players are working toward; obstacle or reward; good fit for **special** or **monster** (the “lock”).
- **Key** – thing(s) needed to overcome the lock; good fit for **treasure** or **monster_treasure** (reward + challenge).
- **Hazard / Trial** – danger or challenge on the way; **monster** or **treasure** (trapped) or **special**.
- **Path** – connector; **empty** or light content.

Edges can be:

- **Main path** – primary route (often corridor or doorway).
- **Shortcut** – bypass (often doorway; can pre-fill description “hidden shortcut”).
- **Long path** – optional corridor_1/2 for “two long paths” or foreshadowing.

---

## Data Model Additions

Minimal extension; roles can be derived at generation time and optionally stored for UI/export.

**Option A – Store roles (recommended for UI):**

- **DungeonNode:** optional `cycleRole?: 'start' | 'goal' | 'key' | 'hazard' | 'path'`.
- **DungeonLink:** optional `edgeRole?: 'main' | 'shortcut' | 'long_path'`.

**Option B – No new fields:** cycle only influences the **assignment** of `roomType`, `content`, and `connectionType`/descriptions at generation; no role stored. Simpler but you can’t show “Key” / “Lock” in the UI.

Recommendation: **Option A** so the left panel can show a small “Cycle” badge (e.g. “Lock & Key”) and per-room/edge role (e.g. “Key”, “Lock”) and so export can mention the cycle in the markdown header.

---

## Generator Flow (biteSizedGenerator + cycle)

1. **Layout (unchanged)**  
   Pick one of the 10 layouts (6 nodes, 6 edges). This gives adjacency and “shape” (hub, leaves, loops).

2. **Cycle type**  
   Pick a cycle (e.g. random among Lock & Key, Foreshadowing, Two Paths, Hidden Shortcut), or allow user to choose in UI later.

3. **Map roles onto the layout**  
   Use graph topology:
   - **Start:** pick a node (e.g. one with degree 1, or random among low-degree nodes) → mark as start and entrance.
   - **Goal/Lock:** e.g. a node “opposite” the start (far in graph distance), or a high-degree “hub” so it’s the natural climax.
   - **Key(s):** e.g. leaf nodes or nodes on a branch (so they’re “off the main path”).
   - **Shortcut (edge):** if cycle is Hidden Shortcut, pick one edge that creates a shorter path start→goal and mark it as shortcut; others main/long.
   - **Long path (edges):** for Two Paths or Foreshadowing, edges on branches can be corridor_1/2; main route doorways.

   Implement a small **role mapper** that, given `layoutIndex` and `cycleType`, returns:
   - `nodeRoles: Record<nodeIndex, cycleRole>`
   - `edgeRoles: Record<edgeKey, edgeRole>` (edgeKey = normalized "a-b" for layout edges).

4. **Stock rooms from roles**  
   Keep the Bite-Sized **counts** (1 monster+treasure, 1 monster, 1 treasure, 3 empty, 1 optionally special), but **assign** them by role instead of random shuffle:
   - Start → usually **empty** (or one specific type if cycle demands it).
   - Goal/Lock → **special** or **monster** (the obstacle).
   - Key → **treasure** or **monster_treasure** (the thing you need).
   - Hazard → **monster** or **treasure** (trapped) or **special**.
   - Path → **empty** (or fill remaining types).

   If a cycle needs two “key” rooms, assign treasure and monster_treasure to the two key slots; etc. So we still output exactly the Bite-Sized mix, but **placement** is driven by the cycle.

5. **Connection types and descriptions from cycle**  
   - **Shortcut** edge → prefer doorway; set default description “Hidden shortcut” or “Secret passage”.
   - **Long path** edges → prefer corridor_1 or corridor_2.
   - **Main path** → doorway or corridor by roll; optional default description “Main path to …”.

6. **Default content from role**  
   Replace or extend `getDefaultContent(roomType)` with `getDefaultContentFromRole(roomType, cycleRole)` so prompts reflect the cycle (e.g. Key room: “What must the party obtain here?”; Lock: “What blocks progress until the key is used?”).

---

## UI Additions (lightweight)

- **Cycle selector:** Dropdown or “Cycle: Lock & Key” label when generating; option to “Regenerate with same/different cycle” or “New dungeon” (random cycle).
- **Room list / detail:** Optional badge for `cycleRole` (e.g. “Key”, “Lock”, “Start”) next to room type so the GM sees the intended structure.
- **Edge tooltip or editor:** Show `edgeRole` (Main / Shortcut / Long path) and/or pre-filled description from cycle.

No need to change the graph component or export flow beyond adding cycle + roles to the markdown header and room/edge metadata if desired.

---

## File and Code Touchpoints

- **[src/types.ts](src/types.ts)** – Add optional `cycleRole` to `DungeonNode`, `edgeRole` to `DungeonLink`; add `cycleType?: string` to `GraphData` or a separate “dungeon meta” object if you prefer.
- **[src/lib/biteSizedGenerator.ts](src/lib/biteSizedGenerator.ts)** – Add cycle type enum/const; implement role mapper (layout + cycle → nodeRoles, edgeRoles); change stocking from “shuffle ROOM_TYPES” to “assign by role”; set connection types and default descriptions from edge roles; call `getDefaultContentFromRole` where appropriate.
- **New file (e.g. [src/lib/cyclicMapper.ts](src/lib/cyclicMapper.ts))** – `mapCycleToLayout(layoutIndex, cycleType)` → `{ nodeRoles, edgeRoles }`; helper to pick start/goal/keys from layout topology (degree, distance).
- **[src/components/RoomEditor.tsx](src/components/RoomEditor.tsx)** – Show cycle type and optional `cycleRole` badge per room.
- **Export** – Optionally add “Cycle: Lock & Key” (or current cycle) to the markdown title or a small “Design” section.

---

## Implementation Order

1. Extend types (cycleRole, edgeRole, cycleType).
2. Implement cyclic mapper: topology helpers (e.g. node degrees, distances from a chosen start), then for each cycle type assign start/goal/keys/shortcut/long path.
3. In biteSizedGenerator: pick cycle (random or param), call mapper, assign room types and default content from roles, set edge types and default descriptions from edge roles.
4. UI: cycle label and optional role badges; keep existing behavior otherwise.
5. Export: optional cycle in markdown.

This keeps the Bite-Sized structure and app behavior, and uses the cyclic dungeon idea purely as the **framework for populating** rooms and corridors so dungeons feel purposeful (lock-and-key, foreshadowing, two paths, shortcut) instead of random.
