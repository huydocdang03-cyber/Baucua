const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

let users = {};
let bets = [];
let dealer = null;
let nextResult = null;

function createUser(id, name, role="player"){
    users[id] = {
        id,
        name,
        role,
        money: role === "banker" ? 100000 : 1000
    };
}

io.on("connection", (socket) => {

    socket.on("join", ({name, role}) => {
        createUser(socket.id, name, role);
        io.emit("users", users);
    });

    // ADMIN tạo kết quả trước
    socket.on("admin_generate", () => {
        const user = users[socket.id];
        if(user.role !== "admin") return;

        const items = ["Bầu","Cua","Tôm","Cá","Nai","Gà"];
        nextResult = [];

        for(let i=0;i<3;i++){
            nextResult.push(items[Math.floor(Math.random()*6)]);
        }

        socket.emit("preview", nextResult);
    });

    // BANKER chọn dealer
    socket.on("set_dealer", (targetId) => {
        const user = users[socket.id];
        if(user.role !== "banker") return;

        if(users[targetId].money <= 0) return;

        dealer = targetId;
        io.emit("dealer", dealer);
    });

    // BANKER chuyển tiền
    socket.on("transfer", ({to, amount}) => {
        const user = users[socket.id];
        if(user.role !== "banker") return;

        users[socket.id].money -= amount;
        users[to].money += amount;

        io.emit("users", users);
    });

    // cược
    socket.on("bet", ({item, amount}) => {
        let user = users[socket.id];
        if(user.money <= 0) return;

        bets.push({id: socket.id, item, amount});
    });

    // roll
    socket.on("roll", () => {
        if(!dealer) return;

        let result;

        if(nextResult){
            result = nextResult;
            nextResult = null;
        } else {
            const items = ["Bầu","Cua","Tôm","Cá","Nai","Gà"];
            result = [];
            for(let i=0;i<3;i++){
                result.push(items[Math.floor(Math.random()*6)]);
            }
        }

        bets.forEach(b => {
            let player = users[b.id];
            let d = users[dealer];

            let count = result.filter(r=>r===b.item).length;

            if(count>0){
                let win = b.amount * count;
                player.money += win;
                d.money -= win;
            }else{
                player.money -= b.amount;
                d.money += b.amount;
            }
        });

        bets = [];

        if(users[dealer].money < 0){
            io.emit("dealer_broke", dealer);
            dealer = null;
        }

        io.emit("result", result);
        io.emit("users", users);
    });

    socket.on("disconnect", ()=>{
        delete users[socket.id];
        io.emit("users", users);
    });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server chạy"));
