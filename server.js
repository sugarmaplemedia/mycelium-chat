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
const roomsList = ["global", "the mushroom", "pretty fly (for a fungi)", "in the dirt"];
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
    /* @TODO we should ultimately persist users to the file system as well as users shouldn't lose their metadata simply because the server went down. */
    fs.writeFileSync(CHAT_HISTORY_FNAME, JSON.stringify(chatHistory, { type: "application/json;charset=utf-8" }), (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log('Successfuly written to the file!');
        }
    });
}

/* R G B */
const mushroom_color_min = 53;
const mushroom_color_max = 177;

function generate_mushroom_color() {
    /**
     * Basically I found a min and max that doesn't tear the icon up, which is what I used here.
     *
     * @NOTE the only issue I found is this doesn't play well with firefox so we should use Chrome during our presentation.
     * Not totally sure why but we're time strapped so I don't really care either.
     */
    const r = ((Math.random() * (mushroom_color_max - mushroom_color_min + 1) + mushroom_color_min) / mushroom_color_max);
    const g = ((Math.random() * (mushroom_color_max - mushroom_color_min + 1) + mushroom_color_min) / mushroom_color_max);
    const b = ((Math.random() * (mushroom_color_max - mushroom_color_min + 1) + mushroom_color_min) / mushroom_color_max);
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
        let user_color = generate_mushroom_color();
        /**
         * So pretty much the idea is usernames are unique (they should be). With this they should be the key in the usersList.
         * This allows the user to "relogin" without losing any of their ability to edit or delete their previous messages
         * Also this allows the user icon color to persist along with any other metadata
         */
        let userExist = usersList.get(username);
        if(userExist !== undefined)
        {
            userExist.socket = socket.id;
        }
        else
        {
            /* icon color should be stored along with any other metadata we deem fit for the user */
            usersList.set(username, {socket: socket.id, icon_color: user_color});
        }
        socket.emit("setRoomHistory", chatHistory[room]);
        io.emit("updateUsers", "add", username, user_color);
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
                    icon_color: usersList.get(message.author).icon_color, /**< Fetch user icon color */
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
