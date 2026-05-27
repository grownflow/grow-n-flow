# Grow-n-Flow Frontend

## How It Works
This is a React-based interface for managing a web hosted simulated aquaponics system. It connects to a Node.js backend through HTTP APIs to handle all the game logic. When you launch the app, it starts a new session by requesting a match (match id) from the server. From there, you can add fish, plant seeds, feed your fish, harvest crops, and move the simulation forward which then sends requests to update the system state. The interface shows you the tank, plant beds, and water chemistry in real time, with everything updating based on what's happening in the backend simulation.

New players are guided by a **step-by-step tutorial banner** that appears at game start and auto-advances as each action is completed. Fish feeding is **automated by default** — the game draws daily food from your inventory before each Progress, so you never need to manually feed before advancing time.

## Technologies Used
- React 19 (UI components and rendering)
- Vite (development server and build tooling)
- Axios (API requests to backend)
- JavaScript (frontend logic)
- X3DOM (for 3D rendering of fish tank scene)
- CSS (for application styling)

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation
1. Navigate to the `FlowFarmFrontend` directory:
   ```bash
   cd FlowFarmFrontend
   ```
2. Install project dependencies:
   ```bash
   npm install
   ```

### Running the Development Server
Start the frontend server with:
```bash
npm run dev
```
By default, the app will be available at http://localhost:5173. The frontend expects the backend to be running at http://localhost:4000.

### Building for Production
To create a production build:
```bash
npm run build
```

To preview the production build:
```bash
npm run preview
```

---

## Project Structure
- `src/App.jsx` – Entry point for the app UI.
- `src/components/` – UI modules (game display, tanks, plants, stats, popups).
- `src/services/gameAPI.js` – Functions that handle API requests to the backend.

Basic workflow:
- On app start, a new game is created via the backend.
- The user can add fish, plant seeds, feed fish, harvest plants, and progress game turns.
- Game state and simulation data are fetched and displayed as the user interacts.

---

## Simulation Overview

### Nitrogen Cycle

Fish produce ammonia as waste. A biofilter colony of nitrifying bacteria converts ammonia → nitrite → nitrate each game day. Plants absorb nitrate as fertilizer, completing the cycle.

The simulation uses a **capacity-based biofilter model**: the biofilter removes up to its rated capacity (ppm/day) each turn. As long as your fish load stays within that capacity, ammonia and nitrite remain near zero — only nitrate builds up over time (which is the normal, healthy state of an established aquaponics system). Ammonia and nitrite only accumulate when:

- Fish load exceeds biofilter capacity (too many fish or not enough biofilter)
- The pump fails (reduces throughput to ~15%)
- The biofilter clogs (reduces efficiency by 50%)
- An event spikes water chemistry directly (disease, ammonia surge)

**Default capacity:** 2.0 ppm/day (80% efficiency × 2.5 ppm/day base). This handles ~13 tilapia before capacity alerts appear. Purchasing and applying biofilter units raises efficiency toward 100% (2.5 ppm/day maximum).

### Biofilter Capacity Alerts

The system alerts panel will warn you when:

| Load | Alert |
|------|-------|
| ≥ 80% | "Purchase a biofilter unit before adding more fish" |
| > 100% | "Ammonia will keep rising — apply biofilter units or reduce fish load" |

### Water Chemistry Targets

| Parameter | Safe Range | Danger Threshold |
|-----------|------------|------------------|
| Ammonia | < 1.0 mg/L | ≥ 2.0 mg/L |
| Nitrite | < 0.5 mg/L | ≥ 1.0 mg/L |
| Nitrate | 5–80 mg/L | < 1.0 mg/L |
| pH | 6.5–7.5 | < 6.5 or > 7.5 |
| Dissolved Oxygen | ≥ 5.0 mg/L | < 4.0 mg/L |
| Iron | ≥ 1.0 mg/L | < 1.0 mg/L |

### Events

Events are blocked for the first 7 game days (grace period). After that, technical events (water leaks, pump failures, disease outbreaks) are announced one day in advance as a **Pending Event**, giving you one turn to prepare before effects apply. Fish-specific events (disease, ammonia spike) only trigger when fish are present; plant-specific events only trigger when plants are growing.

---

## Player Guide

### Interface Overview

| Area | Purpose |
|------|---------|
| **Top bar** | Day counter, money, event status, Progress buttons |
| **3D scene** | Live view of tank and grow beds; click fish or plants to inspect |
| **Side panel tabs** | Market, Water, Plants, Inventory, Fish, Bills, Events |
| **Notification banner** | Appears above the scene after each Progress action; shows deaths, events, and warnings |
| **Tutorial banner** | Green banner at the bottom of the screen on first play; guides you through steps 1–5 |

### Auto-Feed

Auto-feed is **on by default**. Before each simulated day, if the tank contains no food and you have Fish Food in inventory, the game automatically draws exactly one day's supply for your fish and places it in the tank. This means you never need to manually feed before pressing Progress — as long as you keep Fish Food stocked.

To disable auto-feed (for manual feeding control), use the **Auto-feed: ON / OFF** toggle in the Fish tab. When auto-feed is off and the tank is empty, fish begin accumulating starvation penalties after 2 unfed days and die on day 5.

> **Note:** You start every new game with 1 free pack of Fish Food (10 units) — enough for about 5 days with a small tank.

### Turn Flow

The simulation only advances when you press **Progress Day** or **Progress 3 Days**. All other actions (buying fish, feeding, water changes, applying consumables) take effect immediately on the current game state but do **not** advance time.

```
┌─────────────────────────────────────────────────────┐
│  Take actions (feed fish, buy supplies, water change)│
│         ↓                                            │
│  Press Progress Day (or Progress 3 Days)             │
│         ↓                                            │
│  Simulation runs: fish eat, water chemistry updates, │
│  plants grow, events may fire                        │
│         ↓                                            │
│  Notification banner shows what happened             │
│         ↓                                            │
│  Take corrective actions if needed, then Progress    │
└─────────────────────────────────────────────────────┘
```

**Important:** actions you take *after* a Progress are applied to the current water state immediately. For example, if an alarm fires for high ammonia, you can do a Partial Water Change right then — the ammonia drops immediately in the panel. Press Progress again to run the next day with the corrected water chemistry.

### Responding to Alarms

Alarms appear in the notification banner and in the **Water** tab's system alerts. Each alarm type has a direct corrective action:

| Alarm | Action to take |
|-------|---------------|
| High ammonia (≥ 1.0) | Partial Water Change → Water tab; stop feeding if overfeeding |
| Critical ammonia (≥ 2.0) | Partial Water Change immediately; Stop Feeding |
| High nitrite (≥ 0.5) | Partial Water Change; let biofilter work |
| Low dissolved oxygen | Increase Aeration → Water tab |
| Biofilter at 80–100% | Buy and apply a Biofilter unit → Market tab |
| Fish unfed for 3+ days | Feed Fish → Fish tab; buy Fish Food from Market |
| Pump Failure / Water Leak / Filter Clog | Repair System → Events tab (costs money) |
| Low iron | Apply Chelated Iron → Water tab (buy from Market first) |
| pH out of range | Apply Buffering Solution → Water tab |

After taking corrective action, press **Progress Day** to see the effect.

### Color-Coded Water Chemistry

Every parameter card in the **Water** tab has a color-coded border and value:

| Color | Meaning |
|-------|---------|
| **Green** | Within safe range |
| **Yellow** | Approaching a threshold — monitor closely |
| **Red** | At or past the danger threshold — take action now |

The "Ideal" label on each card shows the target range. Parameters covered: Ammonia, Nitrite, Nitrate, pH, Dissolved Oxygen, Iron, Phosphorus, Potassium.

### Progress 3 Days — Safety Behaviour

**Progress 3 Days** automatically stops early if a critical condition arises mid-batch:

- Any fish die
- Ammonia reaches ≥ 2.0 mg/L or nitrite ≥ 1.0 mg/L
- Dissolved oxygen drops to ≤ 4.0 mg/L
- A system-damage event (pump failure, water leak, filter clog) activates

When stopped early, the notification banner shows which day the problem occurred and what caused it, so you can take action before continuing.

**Pending event warning:** when a technical event is queued (shown in the top bar as "Upcoming: …"), the **Progress 3 Days** button turns amber with a ⚠ label. This means the event will activate on the first day of the next Progress, giving it up to 3 days to compound before you can respond. Use **Progress Day** instead so you can react after day 1.

### 7-Move Quick Start

A first plant harvest and first fish harvest can be achieved in exactly 7 actions with no water management needed (the 7-day grace period blocks all events). Auto-feed handles feeding automatically on every Progress — no separate feed step required.

| # | Action | Notes |
|---|--------|-------|
| 1 | **Buy Fish Food** (1 pack, Market) | $20 → 10 units; auto-feed draws from this |
| 2 | **Add Fish** — 5 Tilapia (Fish tab) | $12.50; fingerlings start at 10 g |
| 3 | **Plant Seeds** — Basil or Romaine (Plants tab) | $0.25–$0.30/seed |
| 4 | **Progress 3 Days** | Auto-feed runs each day; tilapia ≈ 305 g by day 3 |
| 5 | **Progress 3 Days** | Auto-feed continues; Basil matures day 5, Romaine day 6; tilapia ≈ 600 g |
| 6 | **Harvest All Plants** | Sells all mature plants to inventory |
| 7 | **Sell Fish** (Fish tab) | All 5 tilapia ≥ 480 g → harvestable |

> The tutorial banner walks you through steps 1–3 automatically. It dismisses itself once you have progressed past day 5.

### Managing the Biofilter

A healthy, established system keeps ammonia and nitrite near zero — **only nitrate should rise** over time (this is normal and good; plants use it). The biofilter can process up to **2.0 ppm/day** of ammonia at default 80% efficiency.

**You start every new game with 1 free Biofilter unit in your inventory.** Open the Market tab to read how it works, then go to the Water tab → Supplements to apply it and boost your efficiency to 85% right away.

Watch the **biofilter load** alerts in the Water tab:
- < 80% load → system is healthy, ammonia stays near zero
- 80–100% load → buy and apply a Biofilter unit before adding more fish
- > 100% load → ammonia will start building every day; reduce fish or upgrade immediately

Buying each additional Biofilter unit (Market, $120) increases efficiency by 5%, up to 100% (2.5 ppm/day max capacity).

### Repair System Tip

The first time a **system-damage event** activates (pump failure, water leak, or filter clog), the notification banner shows a one-time tip: *"Go to the Events tab to repair this for $X."* Events with a repair cost persist and reduce system performance until repaired — they do not clear on their own.

---

## Backend Integration
- The frontend relies on the backend API (see `../gnf-backend/README.MD` for backend setup).
- Make sure CORS is enabled on the backend (package is included by default).

---

## Development
- Run `npm run lint` to check code for issues.
- Modify UI components in `src/components/` as needed.

---

## Troubleshooting
If you have trouble starting the app, ensure both the frontend and backend servers are running and accessible at their expected ports. Review browser and terminal logs for error messages.
