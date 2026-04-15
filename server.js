const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static(__dirname));

// ====== TÀI KHOẢN ======
const accounts = {
    admin: { password: "Tran2003", role: "admin", money: 0 },
    banker: { password: "Tran2003@", role: "banker", money: 10000 }
};

// tạo 10 player
for(let i=1;i<=10;i++){
    accounts["player"+i] = {
        password:"123",
        role:"player",
        money:1000
    };
}

let users = {};
let tableUsers = [];
let dealer = null;
let bets = {};
let history = [];
let adminResult = null;
let limit = {min:1,max:1000};

// ====== LOGIN ======
io.on("connection", socket=>{

    socket.on("login", ({username,password})=>{
        let acc = accounts[username];

        if(acc && acc.password === password){
            users[socket.id] = {
                username,
                role:acc.role,
                money:acc.money
            };

            socket.emit("login_success", users[socket.id]);
            io.emit("users", users);
        }else{
            socket.emit("login_error");
        }
    });

    // ====== VÀO BÀN ======
    socket.on("join_table", ()=>{
        let user = users[socket.id];
        if(!user) return;

        if(!tableUsers.includes(user.username)){
            tableUsers.push(user.username);
        }

        if(!dealer) dealer = user.username;

        io.emit("table_users", tableUsers);
        io.emit("dealer", dealer);
    });

    socket.on("leave_table", ()=>{
        let user = users[socket.id];
        if(!user) return;

        tableUsers = tableUsers.filter(u=>u!==user.username);
        io.emit("table_users", tableUsers);
    });

    // ====== CƯỢC ======
    socket.on("bet", ({item,amount})=>{
        let user = users[socket.id];
        if(!user) return;

        if(amount < limit.min || amount > limit.max) return;

        if(user.role==="dealer" && user.money < 0) return;

        if(!bets[item]) bets[item]=0;
        bets[item]+=amount;

        user.money -= amount;

        io.emit("bet_totals", bets);
        io.emit("users", users);
    });

    // ====== LẮC ======
    socket.on("roll", ()=>{
        let result;

        if(adminResult){
            result = adminResult;
            adminResult = null;
        }else{
            let items = ["Bầu","Cua","Tôm","Cá","Nai","Gà"];
            result = [
                items[Math.floor(Math.random()*6)],
                items[Math.floor(Math.random()*6)],
                items[Math.floor(Math.random()*6)]
            ];
        }

        // tính tiền
        for(let id in users){
            let u = users[id];

            for(let item in bets){
                let count = result.filter(r=>r===item).length;
                if(count>0){
                    u.money += bets[item]*count;
                }
            }
        }

        history.unshift({result});
        if(history.length>10) history.pop();

        bets = {};

        io.emit("dice_result", result.join(" - "));
        io.emit("history", history);
        io.emit("users", users);
        io.emit("bet_totals", bets);
    });

    // ====== ADMIN ======
    socket.on("admin_set", r=>{
        let user = users[socket.id];
        if(user && user.role==="admin"){
            adminResult = r.split(",");
        }
    });

    socket.on("admin_view", ()=>{
        let user = users[socket.id];
        if(user && user.role==="admin"){
            socket.emit("admin_result", adminResult);
        }
    });

    // ====== BANKER ======
    socket.on("add_chip", data=>{
        let user = users[socket.id];
        if(user.role==="banker"){
            for(let id in users){
                if(users[id].username===data.user){
                    users[id].money += data.chip;
                }
            }
            io.emit("users", users);
        }
    });

    socket.on("sub_chip", data=>{
        let user = users[socket.id];
        if(user.role==="banker"){
            for(let id in users){
                if(users[id].username===data.user){
                    users[id].money -= data.chip;
                }
            }
            io.emit("users", users);
        }
    });

    socket.on("set_limit", l=>{
        let user = users[socket.id];
        if(user.role==="banker"){
            limit = l;
            io.emit("limit", limit);
        }
    });

    socket.on("disconnect", ()=>{
        delete users[socket.id];
    });

});

http.listen(3000, ()=>{
    console.log("Server chạy 3000");
});
