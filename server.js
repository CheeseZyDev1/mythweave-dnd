const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 });
const rooms = new Map();
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const MAX_PLAYERS = 8;
const RECONNECT_GRACE_MS = 2 * 60 * 1000;
const BOT_TEMPLATES = {
  Lyra: { name: 'ไลรา', role: 'คลีริก · AI', icon: '🧝🏼‍♀️', modifier: 3 },
  Grimm: { name: 'กริมม์', role: 'โร้ก · AI', icon: '🥷', modifier: 4 },
  Ember: { name: 'เอ็มเบอร์', role: 'ซอร์เซอเรอร์ · AI', icon: '🧙🏼‍♀️', modifier: 3 }
};

app.use(express.static(__dirname, { extensions: ['html'] }));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('*path', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

function cleanText(value, max = 40) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function normalizeRoomCode(value) {
  const compact = cleanText(value, 16).toUpperCase().replace(/[^A-Z2-9]/g, '');
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : '';
}

function generateRoomCode() {
  let code;
  do {
    const chars = Array.from({ length: 8 }, () => ROOM_ALPHABET[crypto.randomInt(ROOM_ALPHABET.length)]).join('');
    code = `${chars.slice(0, 4)}-${chars.slice(4)}`;
  } while (rooms.has(code));
  return code;
}

function normalizeCampaign(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    location: cleanText(value.location, 24) || 'elderwood',
    visited: Array.isArray(value.visited) ? value.visited.slice(0, 20).map(item => cleanText(item, 24)).filter(Boolean) : ['elderwood'],
    round: Math.min(9999, Math.max(1, Number(value.round) || 1)),
    journal: cleanText(value.journal, 8000)
  };
}

function createRoom(payload) {
  const room = {
    id: generateRoomCode(),
    players: new Map(),
    order: [],
    turnIndex: 0,
    history: [],
    hostId: null,
    mode: payload?.mode === 'resume' ? 'resume' : 'new',
    campaign: payload?.mode === 'resume' ? normalizeCampaign(payload?.campaign) : null,
    started: false,
    createdAt: Date.now()
  };
  rooms.set(room.id, room);
  return room;
}

function rateLimitRoomAttempts(socket) {
  const now = Date.now();
  socket.data.roomAttempts = (socket.data.roomAttempts || []).filter(at => now - at < 60_000);
  if (socket.data.roomAttempts.length >= 10) return false;
  socket.data.roomAttempts.push(now);
  return true;
}

function roomError(socket, code, message) {
  socket.emit('room-error', { code, message });
}

function normalizeTurn(room) {
  room.order = room.order.filter(id => room.players.has(id));
  if (!room.order.length) {
    room.turnIndex = 0;
    return;
  }
  if (room.turnIndex >= room.order.length) room.turnIndex = 0;
  if (!room.players.get(room.order[room.turnIndex])?.online) {
    const onlineIndex = room.order.findIndex(id => room.players.get(id)?.online);
    if (onlineIndex >= 0) room.turnIndex = onlineIndex;
  }
}

function publicRoom(room) {
  normalizeTurn(room);
  if (!room.hostId || !room.players.has(room.hostId)) room.hostId = room.order[0] || null;
  return {
    players: room.order.map(id => {
      const player = room.players.get(id);
      return { id: player.id, name: player.name, iconData: player.iconData, icon: player.icon, location: player.location, online: player.online, ready: player.ready, isBot: Boolean(player.isBot), bot: Boolean(player.isBot), role: player.role || 'ผู้เล่นออนไลน์' };
    }),
    currentTurnId: room.order[room.turnIndex] || null,
    hostId: room.hostId,
    mode: room.mode,
    started: room.started,
    maxPlayers: MAX_PLAYERS
  };
}

function emitState(roomId) {
  const room = rooms.get(roomId);
  if (room) io.to(roomId).emit('room-state', publicRoom(room));
}

function playerFor(socket) {
  const room = rooms.get(socket.data.roomId);
  const player = room?.players.get(socket.data.playerId);
  return { room, player: player?.socketId === socket.id ? player : null };
}

function attachPlayer(socket, room, payload) {
  const requestedId = cleanText(payload?.player?.clientId, 80);
  const playerId = requestedId.length >= 12 ? requestedId : crypto.randomUUID();
  let player = room.players.get(playerId);
  if (!player && room.players.size >= MAX_PLAYERS) return { error: 'FULL' };
  if (room.started && !player) return { error: 'STARTED' };

  if (player) {
    player.name = cleanText(payload?.player?.name, 28) || player.name;
    player.iconData = String(payload?.player?.iconData || player.iconData || '').slice(0, 12000);
    player.location = cleanText(payload?.player?.location, 24) || player.location;
    player.socketId = socket.id;
    player.online = true;
    player.disconnectedAt = null;
  } else {
    player = {
      id: playerId,
      clientId: playerId,
      socketId: socket.id,
      name: cleanText(payload?.player?.name, 28) || 'นักผจญภัย',
      iconData: String(payload?.player?.iconData || '').slice(0, 12000),
      location: cleanText(payload?.player?.location, 24) || 'elderwood',
      online: true,
      ready: false,
      disconnectedAt: null
    };
    room.players.set(playerId, player);
    room.order.push(playerId);
  }

  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.data.playerId = playerId;
  return { player };
}

function enterRoom(socket, room, payload, eventName) {
  const existed = room.players.has(cleanText(payload?.player?.clientId, 80));
  const result = attachPlayer(socket, room, payload);
  if (result.error === 'FULL') return roomError(socket, 'ROOM_FULL', 'ห้องนี้มีผู้เล่นครบ 8 คนแล้ว');
  if (result.error === 'STARTED') return roomError(socket, 'GAME_STARTED', 'ห้องนี้เริ่มการผจญภัยแล้ว');
  if (!room.hostId) room.hostId = result.player.id;
  socket.emit(eventName, { roomId: room.id, selfId: result.player.id, reconnected: existed });
  io.to(room.id).emit('system-event', { text: `${result.player.name} ${existed ? 'กลับเข้าห้องแล้ว' : 'เข้าร่วมห้องแล้ว'}`, at: Date.now() });
  emitState(room.id);
}

function advanceTurn(room) {
  if (!room.order.length) return;
  for (let step = 1; step <= room.order.length; step++) {
    const index = (room.turnIndex + step) % room.order.length;
    if (room.players.get(room.order[index])?.online) {
      room.turnIndex = index;
      return;
    }
  }
}

function maybeRunBot(roomId) {
  const room = rooms.get(roomId);
  if (!room?.started) return;
  clearTimeout(room.botTimer);
  normalizeTurn(room);
  const bot = room.players.get(room.order[room.turnIndex]);
  if (!bot?.isBot) return;
  room.botTimer = setTimeout(() => {
    const currentRoom = rooms.get(roomId);
    if (!currentRoom?.started || currentRoom.order[currentRoom.turnIndex] !== bot.id) return;
    const raw = crypto.randomInt(1, 21);
    const result = { id: `${Date.now()}-${bot.id}`, rollerId: bot.id, rollerName: bot.name, iconData: '', sides: 20, modifier: bot.modifier || 2, raw, total: raw + (bot.modifier || 2), at: Date.now() };
    currentRoom.history.push(result);
    io.to(roomId).emit('dice-rolled', result);
    setTimeout(() => {
      const activeRoom = rooms.get(roomId);
      if (!activeRoom?.started || activeRoom.order[activeRoom.turnIndex] !== bot.id) return;
      advanceTurn(activeRoom);
      emitState(roomId);
      maybeRunBot(roomId);
    }, 1200);
  }, 900);
}

io.on('connection', socket => {
  socket.on('create-room', payload => {
    if (!rateLimitRoomAttempts(socket)) return roomError(socket, 'RATE_LIMIT', 'สร้างห้องถี่เกินไป กรุณารอสักครู่');
    if (socket.data.roomId) return roomError(socket, 'ALREADY_JOINED', 'คุณอยู่ในห้องแล้ว');
    const room = createRoom(payload);
    enterRoom(socket, room, payload, 'room-created');
  });

  socket.on('join-room', payload => {
    if (!rateLimitRoomAttempts(socket)) return roomError(socket, 'RATE_LIMIT', 'ลองเข้าห้องถี่เกินไป กรุณารอสักครู่');
    const roomId = normalizeRoomCode(payload?.roomId);
    if (!ROOM_CODE_PATTERN.test(roomId)) return roomError(socket, 'INVALID_CODE', 'รูปแบบรหัสห้องไม่ถูกต้อง');
    const room = rooms.get(roomId);
    if (!room) return roomError(socket, 'ROOM_NOT_FOUND', 'ไม่พบห้องนี้ ตรวจสอบรหัสกับหัวปาร์ตี้อีกครั้ง');
    if (socket.data.roomId && socket.data.roomId !== roomId) return roomError(socket, 'ALREADY_JOINED', 'คุณอยู่ในห้องอื่นแล้ว');
    enterRoom(socket, room, payload, 'joined-room');
  });

  socket.on('player-update', patch => {
    const { room, player } = playerFor(socket);
    if (!player) return;
    if (patch.name) player.name = cleanText(patch.name, 28);
    if (patch.location) player.location = cleanText(patch.location, 24);
    if (patch.iconData) player.iconData = String(patch.iconData).slice(0, 12000);
    emitState(room.id);
  });

  socket.on('player-ready', value => {
    const { room, player } = playerFor(socket);
    if (!player || room.started) return;
    player.ready = Boolean(value);
    emitState(room.id);
  });

  socket.on('add-bot', payload => {
    const { room, player } = playerFor(socket);
    if (!room || !player || room.hostId !== player.id) return socket.emit('action-error', 'เฉพาะหัวปาร์ตี้เท่านั้นที่เพิ่มบอทได้');
    if (room.started) return socket.emit('action-error', 'เพิ่มบอทได้เฉพาะในล็อบบี้');
    if (room.players.size >= MAX_PLAYERS) return socket.emit('action-error', 'ห้องนี้มีสมาชิกครบแล้ว');
    const template = BOT_TEMPLATES[cleanText(payload?.key, 20)] || BOT_TEMPLATES.Lyra;
    if ([...room.players.values()].some(member => member.isBot && member.name === template.name)) return socket.emit('action-error', 'บอทคนนี้อยู่ในปาร์ตี้แล้ว');
    const id = `bot-${crypto.randomUUID()}`;
    room.players.set(id, { id, clientId: id, socketId: null, name: template.name, role: template.role, icon: template.icon, iconData: '', location: cleanText(payload?.location, 24) || player.location, online: true, ready: true, isBot: true, modifier: template.modifier, disconnectedAt: null });
    room.order.push(id);
    io.to(room.id).emit('system-event', { text: `${template.name} · AI เข้าร่วมคณะเดินทาง`, at: Date.now() });
    emitState(room.id);
  });

  socket.on('remove-bot', botId => {
    const { room, player } = playerFor(socket);
    const bot = room?.players.get(cleanText(botId, 80));
    if (!room || !player || room.hostId !== player.id || !bot?.isBot || room.started) return;
    room.players.delete(bot.id);
    room.order = room.order.filter(id => id !== bot.id);
    normalizeTurn(room);
    emitState(room.id);
  });

  socket.on('start-game', () => {
    const { room, player } = playerFor(socket);
    if (!room || !player || room.hostId !== socket.data.playerId) return socket.emit('action-error', 'เฉพาะหัวปาร์ตี้เท่านั้นที่เริ่มเกมได้');
    const players = [...room.players.values()];
    if (!players.length || players.some(player => !player.online || !player.ready)) return socket.emit('action-error', 'ผู้เล่นทุกคนต้องออนไลน์และกดพร้อมก่อน');
    room.started = true;
    room.turnIndex = 0;
    normalizeTurn(room);
    io.to(room.id).emit('game-started', { mode: room.mode, campaign: room.campaign });
    emitState(room.id);
    maybeRunBot(room.id);
  });

  socket.on('roll-request', payload => {
    const { room, player } = playerFor(socket);
    if (!room || !player || !room.started) return socket.emit('action-error', 'เกมยังไม่เริ่ม');
    if (publicRoom(room).currentTurnId !== socket.data.playerId) return socket.emit('action-error', 'ยังไม่ถึงเทิร์นของคุณ');
    const sides = Math.min(100, Math.max(2, Number(payload?.sides) || 20));
    const modifier = Math.min(20, Math.max(-20, Number(payload?.modifier) || 0));
    const raw = crypto.randomInt(1, sides + 1);
    const result = { id: `${Date.now()}-${socket.data.playerId}`, rollerId: socket.data.playerId, rollerName: player.name, iconData: player.iconData, sides, modifier, raw, total: raw + modifier, at: Date.now() };
    room.history.push(result);
    if (room.history.length > 40) room.history.shift();
    io.to(room.id).emit('dice-rolled', result);
  });

  socket.on('end-turn', () => {
    const { room, player } = playerFor(socket);
    if (!room || !player || !room.started) return socket.emit('action-error', 'เกมยังไม่เริ่ม');
    if (publicRoom(room).currentTurnId !== socket.data.playerId) return socket.emit('action-error', 'เฉพาะผู้เล่นในเทิร์นเท่านั้นที่จบเทิร์นได้');
    advanceTurn(room);
    emitState(room.id);
    maybeRunBot(room.id);
  });

  socket.on('chat-send', message => {
    const { room, player } = playerFor(socket);
    const text = cleanText(message, 300);
    if (player && text) io.to(room.id).emit('chat-event', { name: player.name, text, at: Date.now() });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    const room = rooms.get(roomId);
    const player = room?.players.get(playerId);
    if (!room || !player || player.socketId !== socket.id) return;
    player.online = false;
    player.socketId = null;
    player.disconnectedAt = Date.now();
    if (room.started && room.order[room.turnIndex] === playerId) advanceTurn(room);
    io.to(roomId).emit('system-event', { text: `${player.name} การเชื่อมต่อขาดหาย — รอกลับเข้าห้อง`, at: Date.now() });
    emitState(roomId);

    const disconnectedAt = player.disconnectedAt;
    setTimeout(() => {
      const currentRoom = rooms.get(roomId);
      const currentPlayer = currentRoom?.players.get(playerId);
      if (!currentRoom || !currentPlayer || currentPlayer.online || currentPlayer.disconnectedAt !== disconnectedAt) return;
      currentRoom.players.delete(playerId);
      currentRoom.order = currentRoom.order.filter(id => id !== playerId);
      if (currentRoom.hostId === playerId) currentRoom.hostId = currentRoom.order[0] || null;
      normalizeTurn(currentRoom);
      if (!currentRoom.players.size) rooms.delete(roomId);
      else emitState(roomId);
    }, RECONNECT_GRACE_MS);
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => console.log(`Mythweave running at http://localhost:${port}`));
