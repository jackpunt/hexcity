import { Player } from './player';
import { PlayerStats } from './player-stats';

describe('PlayerStats', () => {
  it('should create an instance', () => {
    expect(new PlayerStats(new Player(null,"red",null, null))).toBeTruthy();
  });
});
