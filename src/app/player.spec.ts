import { Player } from './player';
import { Table } from './table';

let table = new Table(null)
describe('Player', () => {
  it('should create an instance', () => {
    expect(new Player(table, "red", null, null)).toBeTruthy();
  });
});
