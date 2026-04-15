const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);

app.use(express.static(__dirname));

let users = {};
let tables = { table1: [] };
let bets = [];
let totals = { Bầu:0,Cua:0,Tôm:0,Cá:0,Nai:0,Gà:0 };

let dealer = "Chưa có";
let nextResult = null;
let history = [];

let minBet = 20;
let maxBet = 500;

// 🔐 ACCOUNTS
const accounts = {
    admin: { password: "Tran2003", role: "admin" },
    banker: { password: "Tran2003@", role: "banker" },
    player1: { password: "123", role: "player" },
    player2: { password: "123", role: "player" },
    player3: { password: "123", role: "player" }
};

io.on("connection", socket => {

    // LOGIN
    socket.on("login", ({username,password})=>{
        let acc = accounts[username];
        if(acc && acc.password === password){
            users[socket.id] = {
                name: username,
                role: acc.role,
                money: 10000
            };
            socket.emit("login_success", users[socket.id]);
            io.emit("users", users);
        } else {
            socket.emit("login_error");
        }
    });

    // JOIN TABLE
    socket.on("join_table", ()=>{
        tables.table1.push(socket.id);

        let list = tables.table1.map(id=>users[id]?.name);
        io.emit("table_users", list);
    });

    // LEAVE TABLE
    socket.on("leave_table", ()=>{
        tables.table1 = tables.table1.filter(id=>id!==socket.id);

        let list = tables.table1.map(id=>users[id]?.name);
        io.emit("table_users", list);
    });

    // BET
    socket.on("bet", ({item,amount})=>{
        let user = users[socket.id];
        if(!user) return;

        if(amount < minBet || amount > maxBet) return;

        totals[item]+=amount;
        bets.push({id:socket.id,item,amount});

        io.emit("bet_totals", totals);
    });

    // 💰 BANKER chỉnh tiền
    socket.on("adjust_money", ({target, amount})=>{
        let user = users[socket.id];
        if(!user || user.role !== "banker") return;

        let targetUser = Object.values(users).find(u=>u.name === target);
        if(!targetUser) return;

        targetUser.money += amount;

        io.emit("users", users);
    });

    // 🎲 DEALER chỉnh cược
    socket.on("set_limit", ({min,max})=>{
        let user = users[socket.id];
        if(!user || user.name !== dealer) return;

        minBet = Number(min);
        maxBet = Number(max);

        io.emit("limit", {min: minBet, max: maxBet});
    });

    // 👑 SET DEALER
    socket.on("set_dealer", name=>{
        dealer = name;
        io.emit("dealer", dealer);
    });

    // 👑 ADMIN SET RESULT (ẨN)
    socket.on("set_result", result=>{
        let user = users[socket.id];
        if(user.role === "admin"){
            nextResult = result;
        }
    });

    // 🎲 ROLL
    socket.on("roll", ()=>{
        let items=["Bầu","Cua","Tôm","Cá","Nai","Gà"];
        let result=[];

        if(nextResult){
            result = nextResult;
            nextResult=null;
        } else {
            for(let i=0;i<3;i++){
                result.push(items[Math.floor(Math.random()*6)]);
            }
        }

        // tính tiền
        bets.forEach(b=>{
            let p = users[b.id];
            let count = result.filter(r=>r===b.item).length;

            if(count>0) p.money += b.amount*count;
            else p.money -= b.amount;
        });

        // lưu lịch sử
        history.push({
            result,
            bets: bets.map(b=>({
                name: users[b.id]?.name,
                item: b.item,
                amount: b.amount
            })),
            time: new Date().toLocaleTimeString()
        });

        bets=[];
        totals={Bầu:0,Cua:0,Tôm:0,Cá:0,Nai:0,Gà:0};

        io.emit("result", result);
        io.emit("users", users);
        io.emit("bet_totals", totals);
        io.emit("history", history.slice(-10));
    });

});

server.listen(process.env.PORT || 3000);
