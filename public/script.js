const socket = io();

const $ = id => document.getElementById(id);

const menu = $("menu");
const game = $("game");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");

const input = {
  left: false,
  right: false,
  jump: false,
  shoot: false
};

let me = 0;
let roomId = "";

let state = {
  players: [
    { x: 180, y: 448 },
    { x: 1020, y: 448 }
  ],
  ball: {
    x: 600,
    y: 315,
    r: 24
  },
  scores: [0, 0],
  time: 90,
  started: false
};

let names = ["Oyuncu 1", "Oyuncu 2"];
let audio = null;

/* =========================
   SES
========================= */

function sound(type) {
  try {
    audio ||= new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

    if (audio.state === "suspended") {
      audio.resume();
    }

    const o = audio.createOscillator();
    const g = audio.createGain();

    o.connect(g);
    g.connect(audio.destination);

    const now = audio.currentTime;

    if (type === "goal") {
      o.frequency.setValueAtTime(220, now);
      o.frequency.exponentialRampToValueAtTime(
        660,
        now + 0.22
      );

      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.45
      );

      o.start();
      o.stop(now + 0.45);
    } else {
      o.frequency.value = 110;

      g.gain.setValueAtTime(0.06, now);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.1
      );

      o.start();
