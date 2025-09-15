# Grow n’ Flow — System Architecture

## Overview
**Grow n’ Flow** is a turn-based aquaponics simulation game built with **boardgame.io**, **Node.js**, and **React + WebGL**.  
Players manage a virtual aquaponics system by feeding fish, controlling aeration, and advancing time.  
The game evaluates system health using a simplified aquaponics model based on the curriculum.

---

## Core Loop
1. **Player Actions** — feed fish, toggle aeration, dose buffer, plant crops, advance time.  
2. **Simulation Update** — backend engine applies nitrogen cycle, plant uptake, and oxygen dynamics.  
3. **State Update** — boardgame.io syncs new system state to the frontend.  
4. **Visualization** — React HUD + WebGL scene show system health.  
5. **Repeat** until win/loss conditions are reached.

---

## Architecture Diagram
```plaintext
+---------------------------+
|        Frontend           |
|  React + WebGL            |
|  - HUD (pH, DO, TAN, NOx) |
|  - Actions UI             |
|  - Visualization Scene    |
+-------------+-------------+
              |
              | Boardgame.io Client (WebSocket/HTTP)
              v
+---------------------------+
|         Backend           |
|  Node.js + boardgame.io   |
|  - Game Engine            |
|  - Simulation Kernel      |
|  - Moves: Feed, Toggle,   |
|    AdvanceTime            |
|  - End Conditions         |
+-------------+-------------+
              |
              | (future) Persistence
              v
+---------------------------+
|         Database          |
|        PostgreSQL         |
+---------------------------+
