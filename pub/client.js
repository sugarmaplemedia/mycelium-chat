// Socket.io Client setup
var socket = io();

// Vue app
Vue.createApp({
    data() {
        return {
            text: "", // Input text for submitting new messages
            editText: "", // Input text for editing messages
            author: "aks", // The message author
            history: [], // Chat history
            users: [] // Users connected to chat
        };
    },
    mounted() {
        // Initialize chat
        socket.on("init", (chat) => {
            this.history = chat;
        });

        socket.on("updateUsers", (action, userName) => {
            switch (action) {
                case "add":
                    users.push(userName);
                    break;
                case "remove":
                    users.splice(users.findIndex(user => user == userName), 1);
                    break;
            }
        });

        // Receive message from server, and:
        socket.on("updateChat", (action, message) => {
            switch (action) {
                // push that message to the chat history
                case "new":
                    this.history.push(message);
                    break;
                // use that message's ID to update a message in the chat history
                case "update":
                    this.history[this.history.findIndex(msg => msg.id == message.id)] = message;
                    break;
                // use that message's ID to delete a message from the chat history 
                case "delete":
                    this.history.splice(this.history.findIndex(msg => msg.id == message.id), 1);
                    break;
            }
        });

        socket.emit("updateUsers", this.author);
    },
    methods: {
        // Take text from an input box and send it to the server in order to:
        updateChat(action, message) {
            switch (action) {
                // push a new message to the chat history
                case "new":
                    if(this.text != "") {
                        socket.emit("updateChat", "new",
                            {
                                text: this.text,
                                author: this.author
                            }
                        );
                        this.text = "";
                    }
                    break;
                // update a message within the chat history
                case "update":
                    // This ensures only one edit textbox is open at a time
                    if (!message.editMessage) {
                        this.history.forEach(msg => msg.editMessage = false);
                        message.editMessage = true;
                    } else {
                        socket.emit("updateChat", "update",
                            {
                                id: message.id,
                                text: this.editText
                            }
                        );
                        message.editMessage = false;
                        this.editText = "";
                    }
                    break;
                // Delete a message from the chat history
                case "delete":
                    socket.emit("updateChat", "delete", message);
                    break;
            }
        }
    }
}).mount('#app');
