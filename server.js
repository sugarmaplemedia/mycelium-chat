/** Required Files */
const express = require("express");
const fs = require('fs');
const http = require("http");
const socketio = require("socket.io");
const base64id = require('base64id'); /**< Base64ID setup (for generating message IDs) */

/** Express setup */
const app = express();
app.use(express.static("pub"));
const server = http.Server(app);

/** Socket.io setup */
const io = socketio(server);

/** Environment variables */
const PORT = process.env.PORT || 8082; /**< default server port */
server.listen(PORT, () => console.log(`server is listening on port ${PORT}`));
const CHAT_HISTORY_FNAME = "chat_history.json";       /**< default chat history file name */
const CHAT_HISTORY_PATH = "./" + CHAT_HISTORY_FNAME; /**< default chat history path */

/** GLOBALS */
const usersList = new Map();
const roomsList = ["global", "the mushroom", "pretty fly (for a fungi)", "domestic terrorism"];
let chatHistory;
if (!(chatHistory = load_chat_history())) {
    chatHistory = {};
    for (room of roomsList) {
        chatHistory[room] = [];
    }
}

/* SERVER FUNCTIONS */

/** Load designated chat history file from file system */
function load_chat_history() {
    try {
        return JSON.parse(fs.readFileSync(CHAT_HISTORY_PATH));
    } catch (err) {
        console.log(`Error: ${CHAT_HISTORY_FNAME} is ${err.code}`);
    }
    return undefined;
}

/** Save local chat history array to file */
function save_chat_history() {
    fs.writeFileSync(CHAT_HISTORY_FNAME, JSON.stringify(chatHistory, { type: "application/json;charset=utf-8" }), (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log('Successfuly written to the file!');
        }
    });
}

/* PROCESS EVENTS */
process.on("SIGINT", () => {
    save_chat_history();
    console.log(`Process ${process.pid} has been interrupted`);
    process.exit(0);
});

process.on('exit', (code) => {
    save_chat_history();
    console.log('Process exit event with code: ', code);
});

/* WEBSOCKET FUNCTIONS */
io.on("connection", (socket) => {
    console.log("user connected " + socket.id);
    socket.emit("init", chatHistory.global, roomsList);

    /** A user gives the server their room and username
     *    sends user to room
     *    adds user ID and name to mapped list
     *    sends new user data to clients
     */
    socket.on("setUserData", (room, username) => {
        socket.join(room);
        usersList.set(socket.id, username);
        socket.emit("setRoomHistory", chatHistory[room]);
        io.emit("updateUsers", "add", username);
    });

    /** Receive a message from the client, and:
     *    new: record it to the server chat history, and push that message to all clients
     *    update: update a message in the server chat history, and push that update to all clients
     *    delete: delete that message from the server chat history and all client chat histories
     */
    socket.on("updateChat", (room, action, message) => {
        switch (action) {
            case "new":
                let newMessage = {
                    text: message.text,
                    editMessage: false,
                    author: message.author,
                    timestamp: Date.now(),
                    id: base64id.generateId()
                };

                chatHistory[room].push(newMessage);
                io.to(room).emit("updateChat", "new", newMessage);
                break;
            case "update":
                let updatedMessage = chatHistory[room][chatHistory[room].findIndex(msg => msg.id == message.id)];
                updatedMessage.text = message.text;
                io.to(room).emit("updateChat", "update", updatedMessage);
                break;
            case "delete":
                chatHistory[room].splice(chatHistory[room].findIndex(msg => msg.id == message.id), 1);
                io.to(room).emit("updateChat", "delete", message);
                break;
        }
    });

    /** A user disconnects from the server
     *    log their disconnection
     *    tell users the username who left
     *    remove user from mapped list
     */
    socket.on("disconnect", () => {
        console.log(socket.id + " disconnected");
        io.emit("updateUsers", "remove", usersList.get(socket.id));
        usersList.delete(socket.id);
    });
});
