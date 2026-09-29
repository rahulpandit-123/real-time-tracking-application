const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1. Setup: use EJS for pages, and serve files from the "public" folder
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// 2. Show the home page (views/index.ejs)
app.get("/", (req, res) => {
  res.render("index");
});

// 3. Real-time part
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // A user sends their location -> send it to EVERYONE
  socket.on("send-location", (data) => {
    io.emit("receive-location", {
      id: socket.id,
      username: data.username,   // new: the user's name
      latitude: data.latitude,
      longitude: data.longitude,
    });
  });

  // A user leaves -> tell everyone so their marker can be removed
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    io.emit("user-disconnect", socket.id);
  });
});

// 4. Start the server
server.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});