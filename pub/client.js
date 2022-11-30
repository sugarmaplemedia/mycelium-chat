// Socket.io Client setup
var socket = io();

// What are these vars for? Please define
const MESSAGE    = 0;
const USER       = 1;
const EVENT_SIZE = 2;

Vue.createApp({
    data() {
        return {
            submit: false,
            text: "",
            author: "aks",
            history: []
        };
    },
    created() {
        // I don't think this is necessary - Harrison
        window.addEventListener('keydown', (e) => {
            if (e.key == 'Enter') {
                this.submit = true;
            }
        });
        // Ditto ^ - Harrison
        window.addEventListener('keyup', (e) => {
            if(e.key == 'Enter') {
                this.submit = false;
            }
        });
    },
    methods: {
        message_send() {
            if(this.submit && this.text != "") {
                socket.emit("event", MESSAGE ,{"message": this.text, "author": this.author});
                this.text = "";
            }
        },
    },
    computed: {
    },
    mounted() {
        socket.on("update", (d) => {
            this.history.push(d);
        })
        socket.on("init", (x) => {
            this.history = x;
        });
    },
}).mount('#app');
