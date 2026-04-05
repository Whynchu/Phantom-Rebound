/**
 * Static game data definitions separated for easier iteration and content updates.
 */

import { VERSION } from './version.js';
import { getPlayerColorScheme } from './colorScheme.js';

const C = {
  bg:'#161616', grid:'rgba(255,255,255,0.025)', border:'rgba(255,255,255,0.1)',
  grey:'#888', siphon:'#a78bfa',
  get danger() { return getPlayerColorScheme().dangerHex; },
  get dangerCore() { return `rgba(${this.danger === '#60a5fa' ? '200,230,255' : this.danger === '#f87171' ? '248,113,113' : '255,200,200'},0.9)`; },
  get green() { return getPlayerColorScheme().hex; },
  get ghost() { return getPlayerColorScheme().light; },
  get dark() { return getPlayerColorScheme().dark; },
};

const ROOM_SCRIPTS = [
  { name:'ARRIVAL',   chaos:0,    waves:[ [{t:'chaser',   n:1, d:0}] ] },
  { name:'PATROL',    chaos:0,    waves:[ [{t:'chaser',   n:2, d:0}] ] },
  { name:'RUSH',      chaos:0,    waves:[ [{t:'chaser',   n:1, d:0},{t:'rusher', n:1, d:0}] ] },
  { name:'MARKSMAN',  chaos:0.05, waves:[ [{t:'chaser',   n:2, d:0},{t:'sniper', n:1, d:0}] ] },
  { name:'ZONE',      chaos:0.1,  waves:[ [{t:'chaser',   n:2, d:0},{t:'zoner',  n:1, d:0}] ] },
  { name:'PINCER',    chaos:0.1,  waves:[ [{t:'sniper',   n:2, d:0},{t:'rusher', n:2, d:0}] ] },
  { name:'DRAIN',     chaos:0.15, waves:[ [{t:'chaser',   n:2, d:0},{t:'siphon', n:1, d:0}] ] },
  { name:'STATIC',    chaos:0.15, waves:[ [{t:'chaser',   n:2, d:0},{t:'disruptor',n:1,d:0}] ] },
  { name:'CROSSFIRE', chaos:0.2,  waves:[ [{t:'sniper',   n:1, d:0},{t:'zoner',  n:1, d:0},{t:'rusher',n:1,d:0}] ] },
  { name:'BARRAGE',   chaos:0.25, waves:[ [{t:'disruptor',n:2, d:0},{t:'rusher', n:1, d:0},{t:'siphon',n:1,d:0}] ] },
  { name:'SIEGE',     chaos:0.3,  waves:[ [{t:'chaser',   n:2, d:0},{t:'zoner',  n:1, d:0},{t:'sniper',n:1,d:0},{t:'rusher',n:2,d:0}] ] },
  { name:'VORTEX',    chaos:0.35, waves:[ [{t:'disruptor',n:2, d:0},{t:'sniper', n:1, d:0},{t:'rusher',n:2,d:0},{t:'siphon',n:1,d:0}] ] },
];

const BOSS_ROOMS = {
  9:  { name: 'MEGA ZONER',       bossType: 'zoner',            escortType: 'chaser',        escortCount: 2, chaos: 0.3 },
  19: { name: 'MEGA TRIANGLE',    bossType: 'triangle',         escortType: 'rusher',        escortCount: 2, chaos: 0.4 },
  29: { name: 'MEGA DISRUPTOR',   bossType: 'purple_disruptor', escortType: 'purple_chaser', escortCount: 2, chaos: 0.5 },
  39: { name: 'MEGA ZONER II',    bossType: 'orange_zoner',     escortType: 'sniper',        escortCount: 2, chaos: 0.55 },
};

const DECAY_BASE = 3500;
const M = 18;

export { C, ROOM_SCRIPTS, BOSS_ROOMS, DECAY_BASE, M, VERSION };
