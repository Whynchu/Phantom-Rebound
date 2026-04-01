import { ENEMY_TYPES } from './src/entities/enemyTypes.js';

console.log('All enemy types:', Object.keys(ENEMY_TYPES));
console.log('Triangle in ENEMY_TYPES:', 'triangle' in ENEMY_TYPES);
if (ENEMY_TYPES.triangle) {
  console.log('Triangle unlockRoom:', ENEMY_TYPES.triangle.unlockRoom);
  console.log('Triangle ammoPressure:', ENEMY_TYPES.triangle.ammoPressure);
}
