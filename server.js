const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 });
const rooms = new Map();

app.use(express.static(__dirname, { extensions: ['html'] }));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('*path', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

function cleanText(value, max = 40) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}
function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { players: new Map(), order: [], turnIndex: 0, history: [], hostId: null, mode: 'new', campaign: null, started: false });
  return rooms.get(id);
}
function publicRoom(room) {
  const order = room.order.filter(id => room.players.has(id));
  room.order = order;
  if (room.turnIndex >= order.length) room.turnIndex = 0;
  if (!room.hostId || !room.players.has(room.hostId)) room.hostId = order[0] || null;
  return { players: order.map(id => room.players.get(id)), currentTurnId: order[room.turnIndex] || null, hostId: room.hostId, mode: room.mode, started: room.started };
}
function emitState(roomId) {
  const room = rooms.get(roomId);
  if (room) io.to(roomId).emit('room-state', publicRoom(room));
}

io.on('connection', socket => {
  socket.on('join-room', payload => {
    const roomId = cleanText(payload?.roomId, 24).toUpperCase() || 'MOON-742';
    const room = getRoom(roomId);
    const isFirstPlayer = room.players.size === 0;
    if (isFirstPlayer) {
      room.mode = payload?.mode === 'resume' ? 'resume' : 'new';
      room.campaign = room.mode === 'resume' && payload?.campaign ? payload.campaign : null;
      room.started = false;
    }
    socket.join(roomId);
    socket.data.roomId = roomId;
    const player = {
      id: socket.id,
      clientId: cleanText(payload?.player?.clientId, 60),
      name: cleanText(payload?.player?.name, 28) || 'นักผจญภัย',
      iconData: String(payload?.player?.iconData || '').slice(0, 12000),
      location: cleanText(payload?.player?.location, 24) || 'elderwood',
      online: true,
      ready: false
    };
    room.players.set(socket.id, player);
    room.order.push(socket.id);
    if (isFirstPlayer) room.hostId = socket.id;
    socket.emit('joined-room', { roomId, selfId: socket.id });
    io.to(roomId).emit('system-event', { text: `${player.name} เข้าร่วมห้องแล้ว`, at: Date.now() });
    emitState(roomId);
  });

  socket.on('player-update', patch => {
    const room = rooms.get(socket.data.roomId), player = room?.players.get(socket.id);
    if (!player) return;
    if (patch.name) player.name = cleanText(patch.name, 28);
    if (patch.location) player.location = cleanText(patch.location, 24);
    if (patch.iconData) player.iconData = String(patch.iconData).slice(0, 12000);
    emitState(socket.data.roomId);
  });

  socket.on('player-ready', value => {
    const room = rooms.get(socket.data.roomId), player = room?.players.get(socket.id);
    if (!player || room.started) return;
    player.ready = Boolean(value);
    emitState(socket.data.roomId);
  });

  socket.on('start-game', () => {
    const roomId = socket.data.roomId, room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return socket.emit('action-error', 'เฉพาะโฮสต์เท่านั้นที่เริ่มเกมได้');
    const players = [...room.players.values()];
    if (!players.length || players.some(player => !player.ready)) return socket.emit('action-error', 'ต้องรอให้ผู้เล่นทุกคนพร้อมก่อน');
    room.started = true;
    room.turnIndex = 0;
    io.to(roomId).emit('game-started', { mode: room.mode, campaign: room.campaign });
    emitState(roomId);
  });

  socket.on('roll-request', payload => {
    const roomId = socket.data.roomId, room = rooms.get(roomId);
    if (!room || !room.started) return socket.emit('action-error', 'เกมยังไม่เริ่ม');
    const current = publicRoom(room).currentTurnId;
    if (current !== socket.id) return socket.emit('action-error', 'ยังไม่ถึงเทิร์นของคุณ');
    const sides = Math.min(100, Math.max(2, Number(payload?.sides) || 20));
    const modifier = Math.min(20, Math.max(-20, Number(payload?.modifier) || 0));
    const raw = Math.floor(Math.random() * sides) + 1;
    const player = room.players.get(socket.id);
    const result = { id: `${Date.now()}-${socket.id}`, rollerId: socket.id, rollerName: player.name, iconData: player.iconData, sides, modifier, raw, total: raw + modifier, at: Date.now() };
    room.history.push(result);
    if (room.history.length > 40) room.history.shift();
    io.to(roomId).emit('dice-rolled', result);
  });

  socket.on('end-turn', () => {
    const roomId = socket.data.roomId, room = rooms.get(roomId);
    if (!room || !room.started) return socket.emit('action-error', 'เกมยังไม่เริ่ม');
    if (publicRoom(room).currentTurnId !== socket.id) return socket.emit('action-error', 'เฉพาะผู้เล่นในเทิร์นเท่านั้นที่จบเทิร์นได้');
    room.turnIndex = room.order.length ? (room.turnIndex + 1) % room.order.length : 0;
    emitState(roomId);
  });

  socket.on('chat-send', message => {
    const room = rooms.get(socket.data.roomId), player = room?.players.get(socket.id);
    const text = cleanText(message, 300);
    if (player && text) io.to(socket.data.roomId).emit('chat-event', { name: player.name, text, at: Date.now() });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId, room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.get(socket.id);
    const removedIndex = room.order.indexOf(socket.id);
    room.players.delete(socket.id);
    room.order = room.order.filter(id => id !== socket.id);
    if (removedIndex >= 0 && removedIndex < room.turnIndex) room.turnIndex--;
    if (room.turnIndex >= room.order.length) room.turnIndex = 0;
    if (player) io.to(roomId).emit('system-event', { text: `${player.name} ออกจากห้อง`, at: Date.now() });
    if (!room.players.size) rooms.delete(roomId); else emitState(roomId);
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => console.log(`Mythweave running at http://localhost:${port}`));
