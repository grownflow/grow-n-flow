# Grow-n-Flow Frontend

## How It Works
This is a React-based interface for managing a web hosted simulated aquaponics system. It connects to a Node.js backend through HTTP APIs to handle all the game logic. When you launch the app, it starts a new session by requesting a match (match id) from the server. From there, you can add fish, plant seeds, feed your fish, harvest crops, and move the simulation forward which then sends requests to update the system state. The interface shows you the tank, plant beds, and water chemistry in real time, with everything updating based on what's happening in the backend simulation.

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
