const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const FPS = 60, DT = 1/FPS, SNAPSHOT = 1000/20;
const W = 1200, H = 650, GROUND = 560, GOAL_TOP = 410;
const MATCH = 90;

const rooms = new Map();

function id() {
  let x;
  do x = Math.random().toString(36).slice(2,7).toUpperCase(); while(rooms.has(x));
  return x;
}
function player(x) {
  return { x, y: GROUND-112, vx:0, vy:0, w:58, h:112, grounded:true, jumpLock:false, kickCd:0 };
}
function newGame() {
  return {
    started:false, finished:false, time: MATCH, scores:[0,0],
    players:[player(180),player(1020)],
    ball:{x:W/2,y:320,vx:0,vy:0,r:24},
    countdown:0, lastTick:Date.now(), winner:null
  };
}
function publicState(g) {
  return {
    started:g.started, finished:g.finished, time:g.time, scores:g.scores,
    countdown:g.countdown, winner:g.winner,
    players:g.players.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,grounded:p.grounded})),
    ball:g.ball
  };
}
function resetRound(g) {
  g.players[0]=player(180); g.players[1]=player(1020);
  g.ball={x:W/2,y:315,vx:(Math.random()<.5?-2:2),vy:-2,r:24};
}
function begin(g) {
  g.started=true; g.finished=false; g.time=MATCH; g.scores=[0,0]; g.winner=null;
  resetRound(g);
}
function goal(room, scorer) {
  const g=room.game;
  if(!g.started || g.finished) return;
  g.scores[scorer]++;
  io.to(room.id).emit("goal", { scorer, scores:g.scores });
  resetRound(g);
}
function endMatch(room) {
  const g=room.game; if(g.finished) return;
  g.started=false; g.finished=true;
  g.winner = g.scores[0]===g.scores[1] ? -1 : (g.scores[0]>g.scores[1]?0:1);
  io.to(room.id).emit("matchEnd", { scores:g.scores, winner:g.winner });
}
function collideBallPlayer(b,p,idx) {
  const cx=p.x, cy=p.y+49;
  let dx=b.x-cx, dy=b.y-cy, d=Math.hypot(dx,dy)||1;
  const min=b.r+34;
  if(d<min) {
    const nx=dx/d, ny=dy/d, overlap=min-d;
    b.x += nx*overlap; b.y += ny*overlap;
    const speed=6.2 + Math.min(4,Math.abs(p.vx)*.25);
    b.vx += nx*speed + p.vx*.35;
    b.vy += ny*speed - 1.2;
  }
}
function simulate(room) {
  const g=room.game;
  if(!g.started || g.finished) return;
  for(let i=0;i<2;i++){
    const p=g.players[i], input=room.inputs[i]||{};
    const accel=0.85;
    if(input.left) p.vx-=accel;
    if(input.right) p.vx+=accel;
    p.vx*=0.84; p.vx=Math.max(-9,Math.min(9,p.vx));
    if(input.jump && !p.jumpLock && p.grounded){ p.vy=-17.5; p.grounded=false; }
    p.jumpLock=!!input.jump;
    p.vy+=0.72;
    p.x+=p.vx; p.y+=p.vy;
    p.x=Math.max(58,Math.min(W-58,p.x));
    if(p.y>=GROUND-p.h){p.y=GROUND-p.h;p.vy=0;p.grounded=true;}
    p.kickCd=Math.max(0,p.kickCd-DT);
    if(input.shoot && p.kickCd<=0){
      const b=g.ball, dx=b.x-p.x, dy=b.y-(p.y+48), dist=Math.hypot(dx,dy);
      if(dist<145){
        const dir=i===0?1:-1;
        b.vx += dir*10 + p.vx*.45;
        b.vy -= 6.5;
        p.kickCd=.28;
      } else p.kickCd=.12;
    }
  }

  const b=g.ball;
  b.vy+=0.48; b.x+=b.vx; b.y+=b.vy; b.vx*=0.994;
  if(b.y+b.r>GROUND){b.y=GROUND-b.r;b.vy*=-.68;b.vx*=.98;}
  // Side walls. Goals are openings below GOAL_TOP.
  if(b.y-b.r<35){b.y=35+b.r;b.vy=Math.abs(b.vy)*.8;}
  if(b.x-b.r<0 && b.y<GOAL_TOP){b.x=b.r;b.vx=Math.abs(b.vx)*.82;}
  if(b.x+b.r>W && b.y<GOAL_TOP){b.x=W-b.r;b.vx=-Math.abs(b.vx)*.82;}

  for(let i=0;i<2;i++) collideBallPlayer(b,g.players[i],i);

  if(b.x+b.r<4 && b.y>GOAL_TOP) goal(room,1);
  if(b.x-b.r>W-4 && b.y>GOAL_TOP) goal(room,0);
}
function broadcast(room){ io.to(room.id).emit("state",publicState(room.game)); }

io.on("connection", socket=>{
  socket.on("createRoom", ({name}={}, cb)=>{
    const rid=id(), room={id:rid,players:[socket.id],names:[String(name||"Oyuncu 1").slice(0,16),"Oyuncu 2"],inputs:[{},{}],game:newGame(),lastBroadcast:0};
    rooms.set(rid,room); socket.join(rid); socket.data.roomId=rid; socket.data.index=0;
    cb?.({ok:true,roomId:rid,index:0,name:room.names[0]});
    io.to(rid).emit("lobby",{count:1,names:room.names});
  });
  socket.on("joinRoom", ({roomId,name}={},cb)=>{
    const rid=String(roomId||"").trim().toUpperCase(), room=rooms.get(rid);
    if(!room) return cb?.({ok:false,error:"Oda bulunamadı."});
    if(room.players.length>=2) return cb?.({ok:false,error:"Bu oda dolu."});
    const idx=1; room.players.push(socket.id); room.names[idx]=String(name||"Oyuncu 2").slice(0,16);
    socket.join(rid); socket.data.roomId=rid; socket.data.index=idx;
    cb?.({ok:true,roomId:rid,index:idx});
    io.to(rid).emit("lobby",{count:2,names:room.names});
    begin(room); io.to(rid).emit("matchStart",{duration:MATCH,names:room.names}); broadcast(room);
  });
  socket.on("input", data=>{
    const room=rooms.get(socket.data.roomId), i=socket.data.index;
    if(!room || ![0,1].includes(i)) return;
    room.inputs[i]={left:!!data.left,right:!!data.right,jump:!!data.jump,shoot:!!data.shoot};
  });
  socket.on("rematch",()=>{
    const room=rooms.get(socket.data.roomId); if(!room||room.players.length!==2) return;
    begin(room); io.to(room.id).emit("matchStart",{duration:MATCH,names:room.names}); broadcast(room);
  });
  socket.on("disconnect",()=>{
    const rid=socket.data.roomId, room=rooms.get(rid); if(!room)return;
    room.players=room.players.filter(x=>x!==socket.id);
    if(!room.players.length) rooms.delete(rid);
    else {room.game.started=false; io.to(rid).emit("opponentLeft");}
  });
});

// Authoritative simulation loop.
setInterval(()=>{
  for(const room of rooms.values()){
    if(room.game.started){
      simulate(room);
      room.game.time=Math.max(0,room.game.time-DT);
      if(room.game.time<=0) endMatch(room);
    }
    if(Date.now()-room.lastBroadcast>=SNAPSHOT){broadcast(room);room.lastBroadcast=Date.now();}
  }
},1000/FPS);

server.listen(PORT,"0.0.0.0",()=>console.log(`Kafa Topu Pro listening on ${PORT}`));
