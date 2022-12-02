/** Socket.io client-side setup */
const socket = io();

/** Vue app setup */
Vue.createApp({
    data() {
        return {
            /** Metadata */
            author: "", // Client username
            room: "", // Room the client is in
            users: [], // Users connected to chat
            rooms: [], // Available rooms to join
            history: [], // Chat history

            /** Messaging */
            text: "", // Input text for submitting new messages
            editText: "" // Input text for editing messages
        };
    },
    mounted() {
        /** Initialize chatroom */
        socket.on("init", (chat, rooms) => {
            this.history = chat;
            this.rooms = rooms;
        });

        socket.on("setRoomHistory", roomHistory => {
            this.history = roomHistory;
        });

        /** Receive users from server, and:
         *    add: add them to the list of users
         *    remove: remove them from the list of users
         */
        socket.on("updateUsers", (action, userName) => {
            switch (action) {
                case "add":
                    this.users.push(userName);
                    break;
                case "remove":
                    this.users.splice(this.users.findIndex(user => user == userName), 1);
                    break;
            }
        });

        /** Receive message from server, and:
         *    new: push that message to the chat history
         *    update: use that message's ID to update a message in the chat history
         *    delete: use that message's ID to delete a message from the chat history 
         */
        socket.on("updateChat", (action, message) => {
            console.log(this.history);
            switch (action) {
                case "new":
                    this.history.push(message);
                    break;
                case "update":
                    this.history[this.history.findIndex(msg => msg.id == message.id)] = message;
                    break;
                case "delete":
                    this.history.splice(this.history.findIndex(msg => msg.id == message.id), 1);
                    break;
            }
        });
    },
    methods: {
        /** Show/Hide modal to select username and room */
        showModal() {
            document.getElementById("userdata-modal").classList.toggle("show-modal");
        },
        /** Set username and room, and send them to the server */
        setUserData(){
            this.room = document.getElementById("room-set").value;
            this.author = document.getElementById("username-set").value;
            socket.emit("setUserData", this.room, this.author);

            this.showModal();
        },
        /** Take text from an input box and send it to the server in order to:
         *    new: push a new message to the chat history
         *    update: update a message within the chat history
         *    delete: delete a message from the chat history
         */
        updateChat(action, message) {
            switch (action) {
                case "new":
                    if(this.text != "") {
                        socket.emit("updateChat", this.room, "new",
                            {
                                text: this.text,
                                author: this.author
                            }
                        );
                        this.text = "";
                    }
                    break;
                case "update":
                    // This ensures only one edit textbox is open at a time
                    if (!message.editMessage) {
                        this.history.forEach(msg => msg.editMessage = false);
                        message.editMessage = true;
                    } else {
                        socket.emit("updateChat", this.room, "update",
                            {
                                id: message.id,
                                text: this.editText
                            }
                        );
                        message.editMessage = false;
                        this.editText = "";
                    }
                    break;
                case "delete":
                    socket.emit("updateChat", this.room, "delete", message);
                    break;
            }
        }
    }
}).mount('#app');
