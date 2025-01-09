const express = require('express');
const app = express();
const port = 3000;
const http = require("http");
const path = require('path');
const socketio = require("socket.io");

const server = http.createServer(app);
const io = socketio(server);

// Set the view engine to EJS
app.set("view engine", "ejs");

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Socket.IO connection
io.on("connection", function (socket) {
    console.log("User connected:", socket.id);

    socket.on("send-location", function (data) {
        console.log("Location received from user:", socket.id, data);
        io.emit("receive-location", { id: socket.id, ...data });
    });

    socket.on("disconnect", function () {
        console.log("User disconnected:", socket.id);
        io.emit("user-disconnect", socket.id);
    });
});

// Route for the home page
app.get("/", function (req, res) {
    res.render("index");
});

// Start the server
server.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});

