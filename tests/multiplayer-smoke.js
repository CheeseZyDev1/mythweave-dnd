const { io } = require('socket.io-client');
const assert = require('node:assert/strict');

const url = process.env.TEST_URL || 'http://localhost:3000';
const roomId = `TEST-${Date.now()}`;
const a = io(url, { forceNew: true });
const b = io(url, { forceNew: true });
let aId;
let bId;
let latestState;

const waitFor = (socket, event) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timeout: ${event}`)), 5000);
  socket.once(event, value => { clearTimeout(timer); resolve(value); });
});

async function run() {
  await Promise.all([waitFor(a, 'connect'), waitFor(b, 'connect')]);
  a.emit('join-room', { roomId, player: { name: 'Aria', location: 'elderwood' } });
  ({ selfId: aId } = await waitFor(a, 'joined-room'));
  b.emit('join-room', { roomId, player: { name: 'Theo', location: 'moonruins' } });
  ({ selfId: bId } = await waitFor(b, 'joined-room'));
  latestState = await waitFor(a, 'room-state');
  assert.equal(latestState.players.length, 2);
  assert.equal(latestState.currentTurnId, aId);

  a.emit('player-ready', true);
  b.emit('player-ready', true);
  await new Promise(resolve => setTimeout(resolve, 80));
  const startedA = waitFor(a, 'game-started');
  const startedB = waitFor(b, 'game-started');
  a.emit('start-game');
  await Promise.all([startedA, startedB]);

  const aRoll = waitFor(a, 'dice-rolled');
  const bRoll = waitFor(b, 'dice-rolled');
  a.emit('roll-request', { sides: 20, modifier: 2 });
  const [seenByA, seenByB] = await Promise.all([aRoll, bRoll]);
  assert.deepEqual(seenByA, seenByB);
  assert.equal(seenByA.total, seenByA.raw + 2);

  const nextTurn = waitFor(b, 'room-state');
  a.emit('end-turn');
  latestState = await nextTurn;
  assert.equal(latestState.currentTurnId, bId);
  console.log(`PASS: two clients saw roll ${seenByA.total}; turn moved Aria -> Theo`);
}

run().finally(() => { a.close(); b.close(); }).catch(error => { console.error(error); process.exitCode = 1; });
