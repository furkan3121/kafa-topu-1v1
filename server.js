const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const FPS = 60;
const DT = 1 / FPS;
const SNAPSHOT = 1000 / 20;

const W = 1200;
const H = 650;
const GROUND = 560;
const GOAL_TOP = 410;

const MATCH = 90;

const rooms = new Map();

/* =========================
ODA KODU
========================= */

function id() {
let x;

do {
x = Math.random()
.toString(36)
.slice(2, 7)
.toUpperCase();
} while (rooms.has(x));

return x;
}

/* =========================
OYUNCU
========================= */

function player(x) {
return {
x,
y: GROUND - 112,

vx: 0,
vy: 0,

w: 58,
h: 112,

grounded: true,
jumpLock: false,
kickCd: 0

};
}

/* =========================
YENİ OYUN
========================= */

function newGame() {
return {
started: false,
finished: false,

time: MATCH,

scores: [0, 0],

players: [
  player(180),
  player(1020)
],

ball: {
  x: W / 2,
  y: 320,
  vx: 0,
  vy: 0,
  r: 24
},

countdown: 0,
lastTick: Date.now(),
winner: null

};
}

/* =========================
DIŞARI GÖNDERİLEN STATE
========================= */

function publicState(g) {
return {
started: g.started,
finished: g.finished,

time: g.time,

scores: g.scores,

countdown: g.countdown,

winner: g.winner,

players: g.players.map(p => ({
  x: p.x,
  y: p.y,
  vx: p.vx,
  vy: p.vy,
  grounded: p.grounded
})),

ball: g.ball

};
}

/* =========================
TUR RESET
========================= */

function resetRound(g) {

g.players[0] = player(180);
g.players[1] = player(1020);

g.ball = {
x: W / 2,
y: 315,

vx: Math.random() < 0.5 ? -2 : 2,
vy: -2,

r: 24

};
}

/* =========================
MAÇ BAŞLAT
========================= */

function begin(g) {

g.started = true;
g.finished = false;

g.time = MATCH;

g.scores = [0, 0];

g.winner = null;

resetRound(g);
}

/* =========================
GOL
========================= */

function goal(room, scorer) {

const g = room.game;

if (!g.started || g.finished) return;

g.scores[scorer]++;

io.to(room.id).emit("goal", {
scorer,
scores: g.scores
});

resetRound(g);
}

/* =========================
MAÇ BİTİR
========================= */

function endMatch(room) {

const g = room.game;

if (g.finished) return;

g.started = false;
g.finished = true;

if (g.scores[0] === g.scores[1]) {
g.winner = -1;
} else {
g.winner =
g.scores[0] > g.scores[1]
? 0
: 1;
}

io.to(room.id).emit("matchEnd", {
scores: g.scores,
winner: g.winner
});
}

/* =========================
TOP - OYUNCU ÇARPIŞMASI
========================= */

function collideBallPlayer(b, p, idx) {

const cx = p.x;
const cy = p.y + 49;

let dx = b.x - cx;
let dy = b.y - cy;

let d = Math.hypot(dx, dy) || 1;

const min = b.r + 34;

if (d < min) {

const nx = dx / d;
const ny = dy / d;

const overlap = min - d;

b.x += nx * overlap;
b.y += ny * overlap;

const speed =
  6.2 +
  Math.min(
    4,
    Math.abs(p.vx) * 0.25
  );

b.vx +=
  nx * speed +
  p.vx * 0.35;

b.vy +=
  ny * speed -
  1.2;

}
}

/* =========================
FİZİK
========================= */

function simulate(room) {

const g = room.game;

if (!g.started || g.finished) return;

/* OYUNCULAR */

for (let i = 0; i < 2; i++) {

const p = g.players[i];

const input =
  room.inputs[i] || {};


/* HAREKET */

const accel = 0.85;

if (input.left) {
  p.vx -= accel;
}

if (input.right) {
  p.vx += accel;
}


/* SÜRTÜNME */

p.vx *= 0.84;

p.vx =
  Math.max(
    -9,
    Math.min(9, p.vx)
  );


/* ZIPLAMA */

if (
  input.jump &&
  !p.jumpLock &&
  p.grounded
) {

  p.vy = -17.5;

  p.grounded = false;
}

p.jumpLock = !!input.jump;


/* YER ÇEKİMİ */

p.vy += 0.72;


/* KONUM */

p.x += p.vx;
p.y += p.vy;


/* SAHA SINIRI */

p.x =
  Math.max(
    58,
    Math.min(
      W - 58,
      p.x
    )
  );


/* ZEMİN */

if (p.y >= GROUND - p.h) {

  p.y = GROUND - p.h;

  p.vy = 0;

  p.grounded = true;
}


/* ŞUT COOLDOWN */

p.kickCd =
  Math.max(
    0,
    p.kickCd - DT
  );


/* ŞUT */

if (
  input.shoot &&
  p.kickCd <= 0
) {

  const b = g.ball;

  const dx =
    b.x - p.x;

  const dy =
    b.y - (p.y + 48);

  const dist =
    Math.hypot(dx, dy);


  if (dist < 145) {

    const dir =
      i === 0 ? 1 : -1;

    b.vx +=
      dir * 10 +
      p.vx * 0.45;

    b.vy -= 6.5;

    p.kickCd = 0.28;

  } else {

    p.kickCd = 0.12;
  }
}

}

/* =========================
TOP FİZİĞİ
========================= */

const b = g.ball;

b.vy += 0.48;

b.x += b.vx;
b.y += b.vy;

b.vx *= 0.994;

/* ZEMİN */

if (b.y + b.r > GROUND) {

b.y = GROUND - b.r;

b.vy *= -0.68;

b.vx *= 0.98;

}

/* TAVAN */

if (b.y - b.r < 35) {

b.y = 35 + b.r;

b.vy =
  Math.abs(b.vy) * 0.8;

}

/* SOL DUVAR */

if (
b.x - b.r < 0 &&
b.y < GOAL_TOP
) {

b.x = b.r;

b.vx =
  Math.abs(b.vx) * 0.82;

}

/* SAĞ DUVAR */

if (
b.x + b.r > W &&
b.y < GOAL_TOP
) {

b.x = W - b.r;

b.vx =
  -Math.abs(b.vx) * 0.82;

}

/* OYUNCU ÇARPIŞMALARI */

for (let i = 0; i < 2; i++) {

collideBallPlayer(
  b,
  g.players[i],
  i
);

}

/* SOL KALE */

if (
b.x + b.r < 4 &&
b.y > GOAL_TOP
) {

goal(room, 1);

}

/* SAĞ KALE */

if (
b.x - b.r > W - 4 &&
b.y > GOAL_TOP
) {

goal(room, 0);

}
}

/* =========================
STATE GÖNDER
========================= */

function broadcast(room) {

io
.to(room.id)
.emit(
"state",
publicState(room.game)
);
}

/* =====================================================
SOCKET.IO
===================================================== */

io.on("connection", socket => {

/* =========================
ODA OLUŞTUR
========================= */

socket.on(
"createRoom",
({ name } = {}, cb) => {

  const rid = id();

  const room = {

    id: rid,

    players: [
      socket.id
    ],

    names: [
      String(
        name || "Oyuncu 1"
      ).slice(0, 16),

      "Oyuncu 2"
    ],

    inputs: [
      {},
      {}
    ],

    game: newGame(),

    lastBroadcast: 0
  };


  rooms.set(
    rid,
    room
  );


  socket.join(rid);

  socket.data.roomId = rid;

  socket.data.index = 0;


  cb?.({
    ok: true,
    roomId: rid,
    index: 0,
    name: room.names[0]
  });


  io.to(rid).emit(
    "lobby",
    {
      count: 1,
      names: room.names
    }
  );
}

);

/* =========================
ODAYA KATIL
========================= */

socket.on(
"joinRoom",
({ roomId, name } = {}, cb) => {

  const rid =
    String(
      roomId || ""
    )
      .trim()
      .toUpperCase();

  const room =
    rooms.get(rid);


  if (!room) {

    return cb?.({
      ok: false,
      error: "Oda bulunamadı."
    });
  }


  if (
    room.players.length >= 2
  ) {

    return cb?.({
      ok: false,
      error: "Bu oda dolu."
    });
  }


  const idx = 1;


  room.players.push(
    socket.id
  );


  room.names[idx] =
    String(
      name || "Oyuncu 2"
    ).slice(0, 16);


  socket.join(rid);

  socket.data.roomId = rid;

  socket.data.index = idx;


  cb?.({
    ok: true,
    roomId: rid,
    index: idx
  });


  io.to(rid).emit(
    "lobby",
    {
      count: 2,
      names: room.names
    }
  );


  /*
    ÖNEMLİ:
    begin'e room değil,
    room.game gönderiyoruz.
  */

  begin(room.game);


  io.to(rid).emit(
    "matchStart",
    {
      duration: MATCH,
      names: room.names
    }
  );


  broadcast(room);
}

);

/* =========================
INPUT
========================= */

socket.on(
"input",
data => {

  const room =
    rooms.get(
      socket.data.roomId
    );

  const i =
    socket.data.index;


  if (!room) return;

  if (
    i !== 0 &&
    i !== 1
  ) {
    return;
  }


  room.inputs[i] = {

    left:
      !!data?.left,

    right:
      !!data?.right,

    jump:
      !!data?.jump,

    shoot:
      !!data?.shoot
  };
}

);

/* =========================
YENİDEN MAÇ
========================= */

socket.on(
"rematch",
() => {

  const room =
    rooms.get(
      socket.data.roomId
    );


  if (
    !room ||
    room.players.length !== 2
  ) {
    return;
  }


  begin(room.game);


  io.to(room.id).emit(
    "matchStart",
    {
      duration: MATCH,
      names: room.names
    }
  );


  broadcast(room);
}

);

/* =========================
BAĞLANTI KESİLİRSE
========================= */

socket.on(
"disconnect",
() => {

  const rid =
    socket.data.roomId;

  const room =
    rooms.get(rid);


  if (!room) return;


  room.players =
    room.players.filter(
      x => x !== socket.id
    );


  if (
    room.players.length === 0
  ) {

    rooms.delete(rid);

  } else {

    room.game.started =
      false;

    io.to(rid).emit(
      "opponentLeft"
    );
  }
}

);

});

/* =====================================================
SERVER OYUN DÖNGÜSÜ
===================================================== */

setInterval(() => {

for (
const room of rooms.values()
) {

if (
  room.game.started
) {

  simulate(room);


  room.game.time =
    Math.max(
      0,
      room.game.time - DT
    );


  if (
    room.game.time <= 0
  ) {

    endMatch(room);
  }
}


if (
  Date.now() -
    room.lastBroadcast >=
  SNAPSHOT
) {

  broadcast(room);

  room.lastBroadcast =
    Date.now();
}

}

}, 1000 / FPS);

/* =========================
SERVER
========================= */

server.listen(
PORT,
"0.0.0.0",
() => {

console.log(
  `Kafa Topu Pro listening on ${PORT}`
);

}
);
