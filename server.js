// Express setup
var express = require("express");
var app = express();
app.use(express.static("pub"));
var http = require("http");
var server = http.Server(app);

// Socket.io setup
var socketio = require("socket.io");
var io = socketio(server);

// Base64ID setup (for generating message IDs)
var base64id = require('base64id');

// Environment variables
const PORT = process.env.PORT || 8082;
server.listen(PORT, () => {
    console.log(`server is listening on port ${PORT}`);
});

/* Anthony please comment these variables and functions */
/** DEFNS */
const USER_JOIN  = 1;
const USER_LEAVE = 2;
const EVENT_SIZE = 3;

const STR_DEFAULT_SERVER = "global.";
const STR_USER_JOIN      = " has joined ";
const STR_USER_LEAVE     = " has left ";

/** GLOBALS */
const chatHistory = [];
const idHistory = [];
var USER_HISTORY = new Map();

/** EVENT HANDLES */
function user_handle(action, data, socket, obj) {
    let ret = false;
    if(!USER_HISTORY.has(data.author))
    {
        obj.message = format_user_string(action, data);
        ret = true;
    }
    USER_HISTORY.set(data.author, socket.id);
    console.log(USER_HISTORY);
    return ret;
}

/** HELPER FUNCTIONS */
// ?
function format_user_string(e, data) {
    if(e == USER_LEAVE) {
        return (data.author + STR_USER_LEAVE + STR_DEFAULT_SERVER)
    } else {
        return (data.author + STR_USER_JOIN + STR_DEFAULT_SERVER)
    }
}
// Create unique id for each message, referenced when updating messages
function generateMessageId() {
    let newId;
    do {
        newId = base64id.generateId();
    } while (idHistory.includes(newId));
    idHistory.push(newId);
    return newId;
}

/* WEBSOCKET FUNCTIONS */
io.on("connection", (socket) => {
    console.log("user connected " + socket.id);
    socket.emit("init", chatHistory);

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
                    id: generateMessageId()
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
    });
});