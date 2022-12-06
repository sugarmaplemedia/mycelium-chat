/** Socket.io client-side setup */
const socket = io();

const mushroom_icon_size = 20;

/** Vue app setup */
Vue.createApp({
    data() {
        return {
            /** Metadata */
            author: "guest", // Client username
            room: "", // Room the client is in
            users: null, // Users connected to chat
            rooms: [], // Available rooms to join
            history: [], // Chat history

            /** Messaging */
            text: "", // Input text for submitting new messages
            editText: "", // Input text for editing messages

        };
    },
    created() {
        //generate random name if no login provided.
        if(this.author === "")
        {
            this.author = "guest-" + this.makeid(5);
        }
    },
    mounted() {
        /** Initialize global chatroom */
        socket.on("init", (chat, users, rooms) => {
            this.history = chat;
            this.rooms = rooms;
            this.users = users;
            console.log(this.users.entries().);
        });

        /** Receive room chat history and switch over viewable messages */
        socket.on("setRoomHistory", roomHistory => {
            this.history = roomHistory;
        });

        /** Receive users from server, and:
         *    add: add them to the list of users
         *    remove: remove them from the list of users
         */
        socket.on("updateUsers", (action, username, icon_color) => {
            switch (action) {
                case "add":
                    this.users.push({username: username, icon_color: icon_color});
                    break;
                case "remove":
                    this.users.splice(this.users.findIndex(user => user.username == username), 1);
                    break;
            }
        });

        /** Receive message from server, and:
         *    new: push that message to the chat history
         *    update: use that message's ID to update a message in the chat history
         *    delete: use that message's ID to delete a message from the chat history 
         */
        socket.on("updateChat", (action, message) => {
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
        },
        makeid(length) {
            let result = '';
            let ASCII_S = 48;  /*< ASCI START */
            let ASCII_E = 122; /*< ASCI END */
            for ( let i = 0; i < length; i++ ) {
                result += String.fromCharCode(Math.random() * (ASCII_E - ASCII_S + 1) + ASCII_S);
            }
            return result;
        },

        check_for_mention(str) {
            if(str.includes('@' + this.author)) return true;
            return false;
        },

        /*
         * Each icon color filter has a unique id based on the index of the message being rendered
         * we need to use this or it will only apply one filter all mushrooms.
         */
        get_icon_color_filter(id){
            return {
                '-webkit-filter': 'url(#picked-filter' + id + ')',
                'filter': 'url(#picked-filter' + id + ')',
                'font-size': mushroom_icon_size + 'px',
            }
        }
    },
}).mount('#app');
