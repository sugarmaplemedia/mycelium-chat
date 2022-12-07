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

/** Global Variables */
const usersList = new Map();
const roomsList = ["global", "the mushroom", "pretty fly (for a fungi)", "in the dirt"];
let chatHistory;


/* SERVER FUNCTIONS */

/** Load designated chat history file from file system */
if (!(chatHistory = load_chat_history())) {
    chatHistory = {};
    for (room of roomsList) {
        chatHistory[room] = [];
    }
}
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

/* R G B  M U S H R O O M S*/
const mushroomColorMin = 53;
const mushroomColorMax = 177;
function generateMushroomColor() {
    const r = ((Math.random() * (mushroomColorMax - mushroomColorMin + 1) + mushroomColorMin) / mushroomColorMax);
    const g = ((Math.random() * (mushroomColorMax - mushroomColorMin + 1) + mushroomColorMin) / mushroomColorMax);
    const b = ((Math.random() * (mushroomColorMax - mushroomColorMin + 1) + mushroomColorMin) / mushroomColorMax);
    const a = 1;

    let matrix = `
                ${r} 0 0 0 0
                0 ${g} 0 0 0
                0 0 0 ${b} 0
                0 0 0 ${a} 0
            `;

    return matrix;
}


/* PROCESS EVENTS */

/** On interrupt, save the chat history */
process.on("SIGINT", () => {
    save_chat_history();
    console.log(`Process ${process.pid} has been interrupted`);
    process.exit(0);
});

/** On shutdown, save the chat history */
process.on('exit', (code) => {
    save_chat_history();
    console.log('Process exit event with code: ', code);
});


/* WEBSOCKET FUNCTIONS */

io.on("connection", (socket) => {
    /** Iterate through user map and send client all current users */
    let usersForClientIterator = usersList.entries();
    let usersForClient = [];
    let thisUser;
    while ((thisUser = usersForClientIterator.next().value) != undefined) {
        usersForClient.push(thisUser);
    }

    /** Send client chat history for global room, along with users and current rooms */
    socket.emit("init", chatHistory.global, usersForClient, roomsList);


    /** Receive room from client and set them in that room */
    socket.on("setRoom", roomName => {
        socket.join(roomName);
        socket.emit("setRoomHistory", chatHistory[roomName], roomName);
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
                    iconColor: usersList.get(message.author).iconColor, /**< Fetch user icon color */
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

    /** A user gives the server their room and username
     *    sends user to room
     *    adds user ID and name to mapped list
     *    sends new user data to clients
     */
    socket.on("setUserData", (room, username) => {
        socket.join(room);
        let userColor = generateMushroomColor();
        let userExist = usersList.get(username);
        if (userExist !== undefined) {
            userExist.socket = socket.id;
        } else {
            /* icon color should be stored along with any other metadata we deem fit for the user */
            usersList.set(username, {socket: socket.id, iconColor: userColor});
        }
        socket.emit("setRoomHistory", chatHistory[room], room);
        io.emit("updateUsers", "add", username, userColor);
    });

    
    /** A user disconnects from the server
     *    log their disconnection
     *    tell users the username who left
     *    remove user from mapped list
     */
    socket.on("disconnect", () => {
        let userToRemoveIterator = usersList.entries();
        let userToRemove;
        let userRemoved = false;
        while (!userRemoved && (userToRemove = userToRemoveIterator.next().value) != undefined) {
            if (userToRemove[1].socket == socket.id) {
                io.emit("updateUsers", "remove", userToRemove[0], null);
                usersList.delete(userToRemove[0]);
                userRemoved = true;
            }
        }
    });
});
