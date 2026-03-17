# 🌱🌊 Grow n' Flow - System Setup 🐟🍅

Welcome to the Grow n' Flow Aquaponics Simulator! Follow these extremely simple steps to get your farm up and running. 🚜✨

## 🐳 The "One-Click" Method (Docker Compose)
The absolute easiest way to run the entire stack—Frontend, Backend, AND the **MongoDB Database**—is using Docker!

1. Make sure [Docker Desktop](https://www.docker.com/) is installed and running on your machine. 🖥️
2. Open your terminal in the root folder of this project.
3. Run this magic command:
   ```bash
   docker-compose up --build
   ```
*Boom!* 💥 Everything is live.
- 🎮 Play the game at: `http://localhost:5173`
- ⚙️ Backend API at: `http://localhost:8000`
- 🗄️ Database running on: `localhost:27017`

---

## 💻 The Manual Method (NPM & Local Node)

If you need to develop locally without the full Docker stack, follow these steps in order:

### 1. 🗄️ MongoDB Database Setup (REQUIRED)
The backend requires MongoDB to save the game state! You have two choices:
- **Fastest:** Spin up a temporary Mongo Docker container: 
  `docker run -d -p 27017:27017 --name grow-mongo mongo`
- **Native:** Download, install, and run [MongoDB Community Server](https://www.mongodb.com/try/download/community) locally on the default port (`27017`).

### 2. 🔌 Start the Backend
Open a terminal and run:
```bash
cd backend
npm install
npm start
```

### 3. 🎨 Start the Frontend
Open a **second** terminal window and run:
```bash
cd FlowFarmFrontend
npm install
npm run dev
```

Happy farming! 🥬🐟💧
