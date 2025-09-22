const { app, bgioServer} = require("./app");
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server at http://localhost:${PORT}`);
});

bgioServer.run(8000, () => {
  console.log(`Boardgame.io server at http://localhost:8000`);
})
