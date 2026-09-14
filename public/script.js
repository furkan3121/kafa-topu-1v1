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
    { x: 180, y: 448, vx: 0, vy: 0 },
    { x: 1020, y: 448, vx: 0, vy: 0 }
  ],
  ball: { x: 600, y: 315, r: 24 },
  scores: [0, 0],
  time: 90,
  started: false
};

let names = ["Oyuncu 1", "Oyuncu 2"];
let audio = null;

/* SES */
function sound(type) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();

    if (audio.state === "suspended") audio.resume();

    const o = audio.createOscillator();
    const g = audio.createGain();

    o.connect(g);
    g.connect(audio.destination);

    const now = audio.currentTime;

    if (type === "goal") {
      o.frequency.setValueAtTime(220, now);
      o.frequency.exponentialRampToValueAtTime(660, now + 0.22);
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      o.start();
      o.stop(now + 0.45);
    } else if (type === "kick") {
      o.frequency.value = 110;
      g.gain.setValueAtTime(0.06, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      o.start();
      o.stop(now + 0.09);
    } else {
      o.frequency.value = 440;
      g.gain.setValueAtTime(0.04, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      o.start();
      o.stop(now + 0.12);
    }
  } catch {}
}

/* OYUN EKRANI */
function goGame() {
  menu.classList.add("hidden");
  game.classList.remove("hidden");
  resize();
}

function resize() {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * d;
  canvas.height = innerHeight * d;
}

window.addEventListener("resize", resize);
resize();

/* ODA OLUŞTUR */
$("create").onclick = () => {
  const name = $("name").value.trim() || "Oyuncu 1";

  $("status").textContent = "Oda oluşturuluyor...";

  socket.emit("createRoom", { name }, result => {
    if (!result || !result.ok) {
      $("status").textContent = "Oda oluşturulamadı.";
      return;
    }

    me = result.index;
    roomId = result.roomId;

    $("roomCode").textContent = roomId;
    $("roomBox").classList.remove("hidden");

    $("status").textContent =
      "Arkadaşın bu kodu girerek katılsın.";

    sound("ui");
  });
};

/* ODAYA KATIL */
$("join").onclick = () => {
  const rid = $("code").value.trim().toUpperCase();
  const name = $("name").value.trim() || "Oyuncu 2";

  if (!rid) {
    $("status").textContent = "Oda kodu gir.";
    return;
  }

  $("status").textContent = "Odaya bağlanılıyor...";

  socket.emit("joinRoom", {
    roomId: rid,
    name
  }, result => {

    if (!result || !result.ok) {
      $("status").textContent =
        result?.error || "Odaya katılamadı.";
      return;
    }

    me = result.index;
    roomId = result.roomId;

    goGame();
  });
};

/* KOD KOPYALA */
$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(roomId);
    $("copy").textContent = "KOPYALANDI ✓";
  } catch {
    $("status").textContent = "Kod: " + roomId;
  }
};

/* YENİDEN MAÇ */
$("rematch").onclick = () => {
  $("overlay").classList.add("hidden");
  socket.emit("rematch");
};

/* ANA MENÜ */
$("back").onclick = () => {
  location.reload();
};

/* ODA DURUMU */
socket.on("lobby", data => {
  names = data.names || names;

  $("n0").textContent = names[0];
  $("n1").textContent = names[1];

  if (data.count < 2) {
    $("status").textContent = "Arkadaş bekleniyor...";
  } else {
    goGame();
  }
});

/* MAÇ BAŞLADI */
socket.on("matchStart", data => {
  names = data.names || names;

  $("n0").textContent = names[0];
  $("n1").textContent = names[1];

  $("overlay").classList.add("hidden");

  sound("ui");
});

/* SUNUCUDAN OYUN DURUMU */
socket.on("state", data => {
  state = data;

  $("s0").textContent = data.scores[0];
  $("s1").textContent = data.scores[1];

  $("time").textContent = Math.ceil(data.time);
});

/* GOL */
socket.on("goal", data => {
  sound("goal");

  if (data?.scores) {
    $("s0").textContent = data.scores[0];
    $("s1").textContent = data.scores[1];
  }
});

/* MAÇ BİTTİ */
socket.on("matchEnd", data => {
  sound("goal");

  if (data.winner === -1) {
    $("resultTitle").textContent = "BERABERE!";
  } else if (data.winner === me) {
    $("resultTitle").textContent = "🏆 KAZANDIN!";
  } else {
    $("resultTitle").textContent = "😅 KAYBETTİN!";
  }

  $("resultScore").textContent =
    `${data.scores[0]} - ${data.scores[1]}`;

  $("overlay").classList.remove("hidden");
});

/* RAKİP ÇIKTI */
socket.on("opponentLeft", () => {
  $("resultTitle").textContent = "RAKİP AYRILDI";
  $("resultScore").textContent = "";

  $("overlay").classList.remove("hidden");
});

/* KONTROLLER */
function sendInput() {
  socket.emit("input", {
    left: !!input.left,
    right: !!input.right,
    jump: !!input.jump,
    shoot: !!input.shoot
  });
}

function setInput(key, value) {
  input[key] = value;
  sendInput();
}

/* KLAVYE */
function keyboardKey(code) {
  if (
    code === "KeyA" ||
    code === "ArrowLeft"
  ) return "left";

  if (
    code === "KeyD" ||
    code === "ArrowRight"
  ) return "right";

  if (
    code === "KeyW" ||
    code === "ArrowUp"
  ) return "jump";

  if (
    code === "Space" ||
    code === "Enter"
  ) return "shoot";

  return null;
}

window.addEventListener("keydown", e => {
  const key = keyboardKey(e.code);

  if (!key) return;

  e.preventDefault();

  if (!input[key]) {
    setInput(key, true);

    if (key === "shoot") {
      sound("kick");
    }
  }
});

window.addEventListener("keyup", e => {
  const key = keyboardKey(e.code);

  if (!key) return;

  e.preventDefault();
  setInput(key, false);
});

/* TELEFON TUŞLARI */
document.querySelectorAll("#touch button").forEach(button => {

  const key = button.dataset.k;

  const press = e => {
    e.preventDefault();

    if (!input[key]) {
      setInput(key, true);

      if (key === "shoot") {
        sound("kick");
      }
    }
  };

  const release = e => {
    e.preventDefault();
    setInput(key, false);
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);

  /* Telefonlarda dokunma sonrası takılmayı önler */
  button.addEventListener("contextmenu", e => {
    e.preventDefault();
  });
});


/* =========================
   GÖRSEL OYUN
========================= */

const W = 1200;
const H = 650;
const GROUND = 560;

function draw() {

  const scale = Math.min(
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

  /* GÖKYÜZÜ */
  const gradient =
    ctx.createLinearGradient(0, 0, 0, H);

  gradient.addColorStop(0, "#4da8d8");
  gradient.addColorStop(1, "#d9f3ff");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  /* ARKA PLAN BİNALARI */
  ctx.fillStyle = "#667789";

  for (let x = 0; x < W; x += 75) {
    ctx.fillRect(
      x,
      255 + (x % 90),
      58,
      170
    );
  }

  /* ÇİM */
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

  /* ORTA ÇİZGİ */
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

  /* KALELER */
  drawGoal(0);
  drawGoal(1);

  /* OYUNCULAR */
  if (state.players) {
    state.players.forEach((p, i) => {
      drawCharacter(p, i);
    });
  }

  /* TOP */
  if (state.ball) {
    drawBall(state.ball);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}


/* KALE */
function drawGoal(side) {

  const x = side === 0 ? 0 : W - 115;

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 9;

  ctx.strokeRect(
    x,
    410,
    115,
    150
  );

  /* kale ağı */
  ctx.strokeStyle = "#ffffff55";
  ctx.lineWidth = 2;

  for (let y = 420; y < 560; y += 20) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 115, y);
    ctx.stroke();
  }

  for (let xx = x; xx <= x + 115; xx += 20) {
    ctx.beginPath();
    ctx.moveTo(xx, 410);
    ctx.lineTo(xx, 560);
    ctx.stroke();
  }
}


/* OYUNCU */
function drawCharacter(p, i) {

  const x = p.x;
  const y = p.y;

  /* GÖLGE */
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

  /* AYAK */
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

  /* GÖVDE */
  ctx.fillStyle =
    i === 0 ? "#258eea" : "#e9415d";

  ctx.beginPath();

  if (ctx.roundRect) {
    ctx.roundRect(
      x - 34,
      y + 45,
      68,
      57,
      15
    );
  } else {
    ctx.rect(
      x - 34,
      y + 45,
      68,
      57
    );
  }

  ctx.fill();

  /* ŞORT */
  ctx.fillStyle = "#1c2636";

  ctx.fillRect(
    x - 34,
    y + 84,
    68,
    24
  );

  /* BOYUN */
  ctx.fillStyle = "#d99870";

  ctx.fillRect(
    x - 9,
    y + 37,
    18,
    16
  );

  /* KAFA */
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

  /* SAÇ */
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

  /* GÖZLER */
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

  /* AYAKKABI */
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

  /* İSİM */
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";

  ctx.fillText(
    i === 0 ? "P1" : "P2",
    x,
    y - 20
  );
}


/* TOP */
function drawBall(b) {

  const r = b.r || 24;

  /* gölge */
  ctx.fillStyle = "#0002";

  ctx.beginPath();
  ctx.ellipse(
    b.x,
    GROUND + 2,
    r * 1.1,
    6,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /* top */
  ctx.fillStyle = "#fff";

  ctx.beginPath();

  ctx.arc(
    b.x,
    b.y,
    r,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.stroke();

  /* top desenleri */
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


/* ANİMASYON */
function loop() {
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
