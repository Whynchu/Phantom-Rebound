function shouldExpireOutputBullet(bullet, ts) {
  return bullet?.state === 'output' && Boolean(bullet.expireAt) && ts >= bullet.expireAt;
}

function shouldRemoveBulletOutOfBounds(bullet, width, height, padding = 10) {
  return bullet.x < -padding || bullet.x > width + padding || bullet.y < -padding || bullet.y > height + padding;
}

function resolveDangerBounceState(bullet, ts) {
  if(bullet.eliteStage !== undefined && bullet.bounceStages !== undefined && bullet.bounceStages > 0) {
    return { kind: 'elite-stage', nextEliteStage: (bullet.eliteStage || 0) + 1 };
  }
  if(bullet.isTriangle) {
    bullet.wallBounces = (bullet.wallBounces || 0) + 1;
    if(bullet.wallBounces >= 1) return { kind: 'triangle-burst', removeBullet: true };
    return { kind: 'triangle-continue' };
  }
  if((bullet.dangerBounceBudget || 0) > 0) {
    bullet.dangerBounceBudget--;
    bullet.state = 'grey';
    bullet.decayStart = ts;
    return { kind: 'convert-grey' };
  }
  if(bullet.doubleBounce) {
    bullet.bounceCount = (bullet.bounceCount || 0) + 1;
    if(bullet.bounceCount >= 2) {
      bullet.state = 'grey';
      bullet.decayStart = ts;
      return { kind: 'convert-grey' };
    }
    return { kind: 'double-bounce-continue' };
  }
  bullet.state = 'grey';
  bullet.decayStart = ts;
  return { kind: 'convert-grey' };
}

function resolveOutputBounceState(bullet, { splitShot = false, splitShotEvolved = false } = {}) {
  if((bullet.bounceLeft || 0) > 0) {
    bullet.bounceLeft--;
    if(splitShot && !bullet.hasSplit) {
      bullet.hasSplit = true;
      return {
        kind: 'split',
        splitDeltas: splitShotEvolved ? [-0.42, 0, 0.42] : [-0.35, 0.35],
        splitDamageFactor: splitShotEvolved ? 0.85 : 0.8,
      };
    }
    return { kind: 'continue' };
  }
  return { kind: 'remove', removeBullet: true };
}

export {
  shouldExpireOutputBullet,
  shouldRemoveBulletOutOfBounds,
  resolveDangerBounceState,
  resolveOutputBounceState,
};
