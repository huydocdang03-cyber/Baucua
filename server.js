const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static(__dirname));

let users = {};
let bets = [];
let tables = { table1: [] };

let totals = {
    "Bầu":0,"Cua":0,"Tôm":0,
    "Cá":0,"Nai":0,"Gà":0
};

let dealer = "player1";
let nextResult = null;

let minBet = 100;
let maxBet = 1000;

// 🔐 TÀI KHOẢN
const accounts = {
    admin: { password: "Tran2003", role: "admin" },
    banker: { password: "Tran2003@", role: "banker" },

    player1: { password: "123", role: "player" },
    player2: { password: "123", role: "player" },
    player3: { password: "123", role: "player" },
    player4: { password: "123", role: "player" },
    player5: { password: "123", role: "player" },
    player6: { password: "123", role: "player" },
    player7: { password: "123", role: "player" },
    player8: { password: "123", role: "player" },
    player9: { password: "123", role: "player" },
    player10:{ password: "123", role: "player" }
};

io.on("connection", socket => {

    // 🔐 LOGIN
    socket.on("login", ({username, password})=>{
        let acc = accounts[username];
        if(acc && acc.password === password){
            users[socket.id] = {
                name: username,
                role: acc.role,
                money: 10000
            };
            socket.emit("login_success", users[socket.id]);
            io.emit("users", users);
        }
    });

    // 🪑 JOIN TABLE
    socket.on("join_table", table=>{
        if(!tables[table]) tables[table]=[];
        tables[table].push(socket.id);
        socket.join(table);

        io.to(table).emit("table_users", tables[table]);
    });

    // 🚪 LEAVE TABLE
    socket.on("leave_table", table=>{
        tables[table] = tables[table].filter(id=>id!==socket.id);
        socket.leave(table);

        io.to(table).emit("table_users", tables[table]);
    });

    // 🎲 BET
    socket.on("bet", ({item, amount, table})=>{
        let user = users[socket.id];
        if(!user) return;

        if(amount < minBet || amount > maxBet) return;

        totals[item] += amount;

        bets.push({id: socket.id, item, amount, table});

        io.to(table).emit("bet_totals", totals);
    });

    // 👑 ADMIN SET RESULT
    socket.on("set_result", result=>{
        let user = users[socket.id];
        if(user.role === "admin"){
            nextResult = result;
        }
    });

    // 🎲 ROLL
    socket.on("roll", table=>{
        let items = ["Bầu","Cua","Tôm","Cá","Nai","Gà"];
        let result;

        if(nextResult){
            result = nextResult;
            nextResult = null;
        } else {
            result = [];
            for(let i=0;i<3;i++){
                result.push(items[Math.floor(Math.random()*6)]);
            }
        }

        bets.forEach(b=>{
            let player = users[b.id];
            if(!player) return;

            let count = result.filter(r=>r===b.item).length;

            if(count>0){
                player.money += b.amount * count;
            } else {
                player.money -= b.amount;
            }
        });

        bets = [];

        totals = {
            "Bầu":0,"Cua":0,"Tôm":0,
            "Cá":0,"Nai":0,"Gà":0
        };

        io.emit("result", result);
        io.emit("users", users);
        io.emit("bet_totals", totals);
    });

    // 👑 SET DEALER
    socket.on("set_dealer", name=>{
        dealer = name;
        io.emit("dealer", dealer);
    });

    // 💰 SET LIMIT
    socket.on("set_limit", ({min,max})=>{
        minBet = min;
        maxBet = max;
    });

});

http.listen(3000, ()=>{
    console.log("Server chạy cổng 3000");
});
