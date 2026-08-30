const { io } = require('socket.io-client');
const assert = require('node:assert/strict');

const url = process.env.TEST_URL || 'http://localhost:3000';
const stamp = Date.now();
const host = io(url, { forceNew: true });
const guest = io(url, { forceNew: true });
const outsider = io(url, { forceNew: true });
let reconnectedGuest;
let checkpoint = 'connecting clients';

const waitFor = (socket, event, timeout = 8000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timeout: ${event} while ${checkpoint}`)), timeout);
  socket.once(event, value => { clearTimeout(timer); resolve(value); });
});

const waitForMatching = (socket, event, predicate, timeout = 10000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, onEvent); reject(new Error(`Timeout: ${event} while ${checkpoint}`)); }, timeout);
  const onEvent = value => {
    if (!predicate(value)) return;
    clearTimeout(timer);
    socket.off(event, onEvent);
    resolve(value);
  };
  socket.on(event, onEvent);
});

async function run() {
  await Promise.all([waitFor(host, 'connect'), waitFor(guest, 'connect'), waitFor(outsider, 'connect')]);

  checkpoint = 'rejecting an unknown room';
  const missingRoomError = waitFor(outsider, 'room-error');
  outsider.emit('join-room', { roomId: 'AAAA-AAAA', player: { clientId: `outsider-${stamp}`, name: 'Stranger' } });
  assert.equal((await missingRoomError).code, 'ROOM_NOT_FOUND');

  checkpoint = 'creating a private room';
  const created = waitFor(host, 'room-created');
  host.emit('create-room', {
    mode: 'new',
    player: { clientId: `host-player-${stamp}`, name: 'Aria', location: 'elderwood' }
  });
  const hostRoom = await created;
  assert.match(hostRoom.roomId, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(hostRoom.selfId, `host-player-${stamp}`);

  checkpoint = 'joining the invited guest';
  const stateWithBoth = waitForMatching(host, 'room-state', state => state.players.length === 2);
  const joined = waitFor(guest, 'joined-room');
  guest.emit('join-room', {
    roomId: hostRoom.roomId,
    player: { clientId: `guest-player-${stamp}`, name: 'Theo', location: 'moonruins' }
  });
  const guestRoom = await joined;
  assert.equal(guestRoom.roomId, hostRoom.roomId);
  let latestState = await stateWithBoth;
  assert.equal(latestState.hostId, hostRoom.selfId);
  assert.equal(latestState.currentTurnId, hostRoom.selfId);

  checkpoint = 'checking host-only start';
  const guestCannotStart = waitFor(guest, 'action-error');
  guest.emit('start-game');
  assert.match(await guestCannotStart, /หัวปาร์ตี้/);

  const guestClientId = `guest-player-${stamp}`;
  checkpoint = 'detecting a disconnected guest';
  const guestWentOffline = waitForMatching(host, 'room-state', state => state.players.some(player => player.id === guestClientId && !player.online));
  guest.close();
  await guestWentOffline;
  checkpoint = 'reconnecting the guest';
  reconnectedGuest = io(url, { forceNew: true });
  await waitFor(reconnectedGuest, 'connect');
  const rejoined = waitFor(reconnectedGuest, 'joined-room');
  reconnectedGuest.emit('join-room', {
    roomId: hostRoom.roomId,
    player: { clientId: guestClientId, name: 'Theo', location: 'moonruins' }
  });
  const reconnectResult = await rejoined;
  assert.equal(reconnectResult.selfId, guestClientId);
  assert.equal(reconnectResult.reconnected, true);
  await waitForMatching(host, 'room-state', state => state.players.length === 2 && state.players.every(player => player.online));

  checkpoint = 'adding a host-controlled bot';
  const stateWithBot = waitForMatching(host, 'room-state', state => state.players.length === 3 && state.players.some(player => player.isBot));
  host.emit('add-bot', { key: 'Lyra', location: 'elderwood' });
  const botState = await stateWithBot;
  const botId = botState.players.find(player => player.isBot).id;
  assert.equal(botState.players.find(player => player.id === botId).ready, true);

  checkpoint = 'readying all players';
  host.emit('player-ready', true);
  reconnectedGuest.emit('player-ready', true);
  await waitForMatching(host, 'room-state', state => state.players.length === 3 && state.players.every(player => player.ready));
  checkpoint = 'starting the game';
  const startedHost = waitFor(host, 'game-started');
  const startedGuest = waitFor(reconnectedGuest, 'game-started');
  host.emit('start-game');
  await Promise.all([startedHost, startedGuest]);

  checkpoint = 'sharing a dice roll';
  const hostRoll = waitFor(host, 'dice-rolled');
  const guestRoll = waitFor(reconnectedGuest, 'dice-rolled');
  host.emit('roll-request', { sides: 20, modifier: 2 });
  const [seenByHost, seenByGuest] = await Promise.all([hostRoll, guestRoll]);
  assert.deepEqual(seenByHost, seenByGuest);
  assert.equal(seenByHost.total, seenByHost.raw + 2);

  checkpoint = 'advancing the turn';
  const nextTurn = waitForMatching(reconnectedGuest, 'room-state', state => state.currentTurnId === guestClientId);
  host.emit('end-turn');
  latestState = await nextTurn;
  assert.equal(latestState.currentTurnId, guestClientId);

  checkpoint = 'running the bot turn';
  const botTurn = waitForMatching(host, 'room-state', state => state.currentTurnId === botId);
  const botRoll = waitFor(host, 'dice-rolled');
  reconnectedGuest.emit('end-turn');
  await botTurn;
  const botResult = await botRoll;
  assert.equal(botResult.rollerId, botId);
  await waitForMatching(host, 'room-state', state => state.currentTurnId === hostRoom.selfId);
  console.log(`PASS: private room ${hostRoom.roomId}; permissions and reconnect passed; synced roll ${seenByHost.total}; bot rolled ${botResult.total}`);
}

run()
  .finally(() => { host.close(); guest.close(); outsider.close(); reconnectedGuest?.close(); })
  .catch(error => { console.error(error); process.exitCode = 1; });
