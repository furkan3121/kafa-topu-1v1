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

function createRoomId() {
  let code;

  do {
    code = Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();
  } while (rooms.has(code));

  return code;
}


/* =========================
   OYUNCU
========================= */

function createPlayer(x) {
  return {
    x: x,
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
   OYUN
========================= */

function createGame() {
  return {
    started: false,
    finished: false,

    time: MATCH,

    scores: [0, 0],

    players: [
      createPlayer(180),
      createPlayer(1020)
    ],

    ball: {
      x: W / 2,
      y: 320,
      vx: 0,
      vy: 0,
      r: 24
    },

    winner: null
  };
}


/* =========================
   GÖNDERİLECEK DURUM
========================= */

function publicState(game) {
  return {
    started: game.started,
    finished: game.finished,

    time: game.time,

    scores: [
      game.scores[0],
      game.scores[1]
    ],

    winner: game.winner,

    players: game.players.map(player => ({
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      grounded: player.grounded
    })),

    ball: {
      x: game.ball.x,
      y: game.ball.y,
      vx: game.ball.vx,
      vy: game.ball.vy,
      r: game.ball.r
    }
  };
}


/* =========================
   ROUND SIFIRLAMA
========================= */

function resetRound(game) {

  game.players[0] = createPlayer(180);
  game.players[1] = createPlayer(1020);

  game.ball = {
    x: W / 2,
    y: 315,
