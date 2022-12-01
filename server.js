/** Required Files */
var express = require("express");
var fs = require('fs');
var http = require("http");
var socketio = require("socket.io");
var base64id = require('base64id'); /**< Base64ID setup (for generating message IDs) */

/** Express setup */
var app = express();
app.use(express.static("pub"));
var server = http.Server(app);

/** Socket.io setup */
var io = socketio(server);

/** Environment variables */
const PORT = process.env.PORT || 8082;
server.listen(PORT, () => {
    console.log(`server is listening on port ${PORT}`);
});

const CHAT_HISTORY_FNAME = "chat_history.json";       /**< default chat history file name */
const CHAT_HISTORY_PATH  = "./" + CHAT_HISTORY_FNAME; /**< default chat history path */

/** GLOBALS */
const chatHistory = load_chat_history();
const usersList = new Map();

/* SERVER FUNCTIONS */

/** Load designated chat history file from file system */
function load_chat_history() {
    try {
        return JSON.parse(fs.readFileSync(CHAT_HISTORY_PATH));
    } catch(err) {
        console.log(err.code);
    }
    return [];
}

/** Save local chat history array to file */
function save_chat_history() {
    fs.writeFileSync(CHAT_HISTORY_FNAME, JSON.stringify(chatHistory, {type: "application/json;charset=utf-8"}), (err) => {
        if (err) console.log(err);
        console.log('Successfuly written to the file!');
    });
}

process.on("SIGINT", () => {
    save_chat_history();
    console.log(chatHistory);
    console.log(`Process ${process.pid} has been interrupted`);
    process.exit(0);
});

/* WEBSOCKET FUNCTIONS */
io.on("connection", (socket) => {
    console.log("user connected " + socket.id);
    socket.emit("init", chatHistory);

    socket.on("updateUsers", userName => {
        usersList.set(socket.id, userName);
        io.emit("updateUsers", "add", userName);
    });

    // Receive a message from the client, and:
    socket.on("updateChat", (action, message) => {
        switch (action) {
            // Record it to the server chat history, and push that message to all clients
            case "new":
                let newMessage = {
                    text: message.text,
                    editMessage: false,
                    author: message.author,
                    timestamp: Date.now(),
                    id: base64id.generateId()
                };
            
                chatHistory.push(newMessage);
                io.emit("updateChat", "new", newMessage);
                break;
            // Update a message in the server chat history, and push that update to all clients
            case "update":
                let updatedMessage = chatHistory[chatHistory.findIndex(msg => msg.id == message.id)];
                updatedMessage.text = message.text;
                io.emit("updateChat", "update", updatedMessage);
                break;
            // Delete that message from the server chat history and all client chat histories
            case "delete":
                chatHistory.splice(chatHistory.findIndex(msg => msg.id == message.id), 1);
                io.emit("updateChat", "delete", message);
                break;
        }
    });

    socket.on("disconnect", () => {
        console.log(socket.id + " disconnected");
        usersList.delete(socket.id);
    });
});