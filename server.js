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

const POWER_INTERVAL = 30;

const POWER_TYPES = [
  "speed",
  "strongShot",
  "superJump",
  "shield",
  "slow"
];

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
    kickCd: 0,

    power: {
      speedUntil: 0,
      strongShot: false,
      superJumpUntil: 0,
      shieldUntil: 0,
      slowUntil: 0
    }
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

    power: null,
    powerTimer: POWER_INTERVAL,

    countdown: 0,
    lastTick: Date.now(),
    winner: null
  };
}

/* =========================
DIŞARI GÖNDERİLEN STATE
========================= */

function publicState(g) {
  const now = Date.now() / 1000;

  return {
    started: g.started,
    finished: g.finished
