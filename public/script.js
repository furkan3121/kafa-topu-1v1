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
  ball: { x: 600, y: 315, r: 24 },
  scores: [0, 0],
  time: 90,
  started: false
};

let names = ["Oyuncu 1", "Oyuncu 2"];
let audio = null;

function sound(type) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();

    const o = audio.createOscillator();
    const g = audio.createGain();

    o.connect(g);
    g.connect(audio.destination);

    const now = audio.currentTime;

    if (type === "goal") {
      o.frequency.setValueAtTime(220, now);
      o.frequency.exponentialRampToValueAtTime(660, now + .22);
      g.gain.setValueAtTime(.12, now);
      g.gain.exponentialRampToValueAtTime(.001, now + .45);
      o.start();
      o.stop(now + .45);
    } else {
      o.frequency.value = 110;
      g.gain.setValueAtTime(.06, now);
      g.gain.exponentialRampToValueAtTime(.001, now + .1);
      o.start();
      o.stop(now + .1);
    }
  } catch {}
}

/* MENÜ */

function goGame() {
  menu.classList.add("hidden");
  game.classList.remove("hidden");
  resize();
}

function resize() {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * d;
  canvas.height = window.innerHeight * d;
}

window.addEventListener("resize", resize);
resize();

/* ODA OLUŞTUR */

$("create").onclick = () => {

  const name =
    $("name").value.trim() || "Oyuncu 1";

  socket.emit(
    "createRoom",
    { name },
    r => {

      if (!r || !r.ok) {
        $("status").textContent = "Oda oluşturulamadı.";
        return;
      }

      me = r.index;
      roomId = r.roomId;

      $("roomCode").textContent = roomId;
      $("roomBox").classList.remove("hidden");

      $("status").textContent =
        "Arkadaşın bu kodla katılsın.";

      sound("ui");
    }
  );
};

/* ODAYA KATIL */

$("join").onclick = () => {

  const rid =
    $("code").value.trim().toUpperCase();

  const name =
    $("name").value.trim() || "Oyuncu 2";

  if (!rid) {
    $("status").textContent =
      "Oda kodu gir.";
    return;
  }

  socket.emit(
    "joinRoom",
    {
      roomId: rid,
      name
    },
    r => {

      if (!r || !r.ok) {
        $("status").textContent =
          r?.error || "Odaya girilemedi.";
        return;
      }

      me = r.index;
      roomId = r.roomId;

      goGame();
    }
  );
};

/* KOPYALA */

$("copy").onclick = async () => {

  try {
    await navigator.clipboard.writeText(roomId);
    $("copy").textContent = "KOPYALANDI ✓";
  } catch {}
};

/* BUTONLAR */

$("rematch").onclick = () => {
  socket.emit("rematch");
};

$("back").onclick = () => {
  location.reload();
};

/* ODA DURUMU */

socket.on("lobby", d => {

  $("n0").textContent = d.names[0];
  $("n1").textContent = d.names[1];

  if (d.count < 2) {

    $("status").textContent =
      "Arkadaş bekleniyor...";

  } else {

    goGame();
  }
});

/* MAÇ BAŞLADI */

socket.on("matchStart", d => {

  names = d.names || names;

  $("n0").textContent = names[0];
  $("n1").textContent = names[1];

  $("overlay").classList.add("hidden");

  sound("ui");
});

/* OYUN DURUMU */

socket.on("state", s => {

  state = s;

  $("s0").textContent = s.scores[0];
  $("s1").textContent = s.scores[1];

  $("time").textContent =
    Math.ceil(s.time);
});

/* GOL */

socket.on("goal", () => {
  sound("goal");
});

/* MAÇ BİTTİ */

socket.on("matchEnd", d => {

  sound("goal");

  $("resultTitle").textContent =
    d.winner === -1
      ? "BERABERE!"
      : d.winner === me
        ? "🏆 KAZANDIN!"
        : "😅 KAYBETTİN!";

  $("resultScore").textContent =
    `${d.scores[0]} - ${d.scores[1]}`;

  $("overlay").classList.remove("hidden");
});

/* RAKİP ÇIKTI */

socket.on("opponentLeft", () => {

  $("resultTitle").textContent =
    "RAKİP AYRILDI";

  $("resultScore").textContent = "";

  $("overlay").classList.remove("hidden");
});

/* =========================
   KONTROLLER
========================= */

function sendInput() {
  socket.emit("input", {
    left: !!input.left,
    right: !!input.right,
    jump: !!input.jump,
    shoot: !!input.shoot
  });
}

function press(key) {

  if (input[key]) return;

  input[key] = true;
  sendInput();

  if (key === "shoot") {
    sound("kick");
  }
}

function release(key) {

  if (!input[key]) return;

  input[key] = false;
  sendInput();
}

/* PC KLAVYE */

window.addEventListener("keydown", e => {

  let key = null;

  if (e.code === "KeyA" || e.code === "ArrowLeft")
    key = "left";

  if (e.code === "KeyD" || e.code === "ArrowRight")
    key = "right";

  if (e.code === "KeyW" || e.code === "ArrowUp")
    key = "jump";

  if (e.code === "Space" || e.code === "Enter")
    key = "shoot";

  if (key) {
    e.preventDefault();
    press(key);
  }
});

window.addEventListener("keyup", e => {

  let key = null;

  if (e.code === "KeyA" || e.code === "ArrowLeft")
    key = "left";

  if (e.code === "KeyD" || e.code === "ArrowRight")
    key = "right";

  if (e.code === "KeyW" || e.code === "ArrowUp")
    key = "jump";

  if (e.code === "Space" || e.code === "Enter")
    key = "shoot";

  if (key) {
    e.preventDefault();
    release(key);
  }
});

/* =========================
   TELEFON KONTROLLERİ
========================= */

document.querySelectorAll("#touch button")
.forEach(button => {

  const key = button.dataset.k;

  button.addEventListener("pointerdown", e => {

    e.preventDefault();
    e.stopPropagation();

    button.setPointerCapture?.(e.pointerId);

    press(key);
  });

  button.addEventListener("pointerup", e => {

    e.preventDefault();
    e.stopPropagation();

    release(key);
  });

  button.addEventListener("pointercancel", e => {
    release(key);
  });

  button.addEventListener("pointerleave", e => {

    if (e.buttons === 0) {
      release(key);
    }
  });
});

/* =========================
   ÇİZİM
========================= */

const W = 1200;
const H = 650;
const GROUND = 560;

function draw() {

  const scale =
    Math.min(
      canvas.width / W,
      canvas.height / H
    );

  const ox =
    (canvas.width - W * scale) / 2;

  const oy =
    (canvas.height - H * scale) / 2;

  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    ox,
    oy
  );

  const grad =
    ctx.createLinearGradient(
      0,
      0,
      0,
      H
    );

  grad.addColorStop(0, "#4da8d8");
  grad.addColorStop(1, "#d9f3ff");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#667789";

  for (let x = 0; x < W; x += 75) {
    ctx.fillRect(
      x,
      255 + (x % 90),
      58,
      170
    );
  }

  ctx.fillStyle = "#52b957";
  ctx.fillRect(
    0,
    GROUND,
    W,
    H - GROUND
  );

  ctx.fillStyle = "#d8f2d5";
  ctx.fillRect(
    0,
    GROUND,
    W,
    7
  );

  ctx.strokeStyle = "#ffffffaa";
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.moveTo(W / 2, GROUND);
  ctx.lineTo(W / 2, 150);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(
    W / 2,
    GROUND,
    90,
    Math.PI,
    0
  );
  ctx.stroke();

  state.players.forEach(
    (p, i) => character(p, i)
  );

  ball(state.ball);

  ctx.setTransform(
    1, 0, 0, 1, 0, 0
  );
}

function character(p, i) {

  const x = p.x;
  const y = p.y;

  ctx.fillStyle = "#0003";

  ctx.beginPath();

  ctx.ellipse(
    x,
    GROUND + 3,
    48,
    10,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.fillStyle = "#222b38";

  ctx.fillRect(
    x - 30,
    y + 91,
    23,
    20
  );

  ctx.fillRect(
    x + 7,
    y + 91,
    23,
    20
  );

  ctx.fillStyle =
    i ? "#e9415d" : "#258eea";

  ctx.beginPath();

  ctx.roundRect(
    x - 34,
    y + 45,
    68,
    57,
    15
  );

  ctx.fill();

  ctx.fillStyle = "#1c2636";

  ctx.fillRect(
    x - 34,
    y + 84,
    68,
    24
  );

  ctx.fillStyle = "#d99870";

  ctx.fillRect(
    x - 9,
    y + 37,
    18,
    16
  );

  ctx.fillStyle = "#e8aa82";

  ctx.beginPath();

  ctx.arc(
    x,
    y + 27,
    38,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.fillStyle = "#24201e";

  ctx.beginPath();

  ctx.arc(
    x,
    y + 17,
    38,
    Math.PI,
    Math.PI * 2
  );

  ctx.fill();

  ctx.fillRect(
    x - 37,
    y + 14,
    10,
    12
  );

  ctx.fillStyle = "#14171c";

  ctx.beginPath();

  ctx.arc(
    x - 13,
    y + 27,
    4,
    0,
    Math.PI * 2
  );

  ctx.arc(
    x + 13,
    y + 27,
    4,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.fillStyle = "#f2f2f2";

  ctx.fillRect(
    x - 38,
    y + 108,
    32,
    11
  );

  ctx.fillRect(
    x + 7,
    y + 108,
    32,
    11
  );

  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";

  ctx.fillText(
    i ? "P2" : "P1",
    x,
    y - 20
  );
}

function ball(b) {

  ctx.fillStyle = "#fff";

  ctx.beginPath();

  ctx.arc(
    b.x,
    b.y,
    b.r || 24,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;

  ctx.stroke();

  ctx.fillStyle = "#222";

  for (let i = 0; i < 5; i++) {

    const a =
      i * Math.PI * 2 / 5;

    ctx.beginPath();

    ctx.arc(
      b.x + Math.cos(a) * 9,
      b.y + Math.sin(a) * 9,
      5,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }
}

function loop() {

  draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
