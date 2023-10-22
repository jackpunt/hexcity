import { M, Obj, S } from './basic-intfs';
import { Card } from './card';
import { stime } from '@thegraid/common-lib';
import { Player } from './player';
import { TP } from './table-params';

type ReadonlyStats = "assets" | "coins" | "hstat" | "inc" | "pid" | "range" | "round"
type KeyofStats0 = Exclude <keyof PlayerStats , ReadonlyStats>
type KeyofStats = "events" | "totalDist" | "totalMove"
type StatN = "totalDist" | "totalMove"
type StatS = "events"

/** Colletion of stats about Player's economy. */
export class PlayerStats {
  constructor(player: Player) {
    this.player = player;
  }
  player: Player;           // is a Player
  numCards: number;        // owned by this player
  totalCost: number = 0;   // total owned property cost
  totalStep: number = 0;   // income when this player steps on any Tile
  totalStop: number = 0;
  totalNegDist: number = 0;// {dist: {add: -1}} reduces the expected 'step' achieved per move
  totalNegStep: number = 0;// income when other player steps on commercial or other neg-step
  totalRentIn: number = 0;
  totalRentOut: number = 0;
  totalVP: number = 0;
  totalCards: number = 0;    // cards where on can collect or pay rent
  totalRoads: number = 0;
  totalDebt: number = 0;
  totalMort: number = 0;
  mortLimit: number = 0;     // amount bank will lend on mortgage 
  debtPayment: number = 0;
  debtStats: object = {};    // Debt.DebtStats for roboPlayer
  EV: number = 0;            // statistical projection of [step, stop, rent] income/loss
  actualInc: number[] = []   // each element is actualInc for a prior Round
  keepLimit: number = 10;    // max length of actualInc
  lastRound: number = -1;    // put next inc in this slot
  lastInc: number = 0;       // income for latest round
  AV: number = 0;            // average of elements in actualInc: income-per-round
  xcoins: number = 0;        // player.coins when stats calculated: vs debugger late eval of player.coins

  history: any[] = []        // subset of PlayerStats: entry per (Player X Round) == (Turn)
  get hstat() { return {pid: this.pid, round: this.round, turn: this.turn,
    numCard: this.numCards, cost: this.totalCost, VP: this.totalVP, 
    assets: this.assets, range: this.range, debt: this.totalDebt, debtP: this.debtPayment, 
    dist: this.totalDist, move: this.totalMove, EV: this.EV, AV: this.AV, inc: this.lastInc, coins: this.xcoins, events: this.events }}

  _totalDist: number = 0;     // sum of distance at start of each move (what was rolled)
  _totalMove: number = 0;     // sum of distance at end of move (actual movement)
  _events: string = "";       // csl of Event names activated
  statRound: Record<string, number> = { totalDist: -1, totalMove: -1, events: -1 }; // valid turn for each stat
  get totalDist () { return this.getTurnStat('totalDist')}
  get totalMove () { return this.getTurnStat('totalMove')}
  get events () { return this.getTurnStat('events')}

  get pid() { return this.player.index }
  get coins() { return this.player.coins }
  get assets() { return this.totalCost + this.totalVP }
  get round() { return this.player.table.roundNumber }
  get turn() { return this.player.table.turnNumber }
  get range() { return this.player.range } // or rangeRaw?
  get inc() { return this.lastInc} // presumably updated for round()

  hstatCSV(i: number): string {
    let h = this.history[i]
    if (!h) return ``
    return `${h.pid},${h.round},${h.turn},${h.EV},${h.AV},${h.dist},${h.move},${h.inc},${h.coins},${h.debt},${h.debtP},${h.assets},${h.range},${h.numCard},${h.cost},${h.events} \n`
  }
  dump(): string {
    let rv = `\n ID, round, turn, EV, AV, dist, move, inc, coins, debt, debtP, assets, range, nCards, cost, events \n`
    this.history.forEach((h, ndx) => rv += this.hstatCSV(ndx))
    return rv
  }
  oneDecimal(x:number):number {
    return M.decimalRound(x, 1)
  }
  getTurnStat(name: StatS | StatN): number | string {
    return this.player.table.roundNumber == this.statRound[name] ? this[`_${name}`] : " "
  }
  setTurnStat(name: StatS | StatN, val: number | string, v0 = typeof(val)=='number' ? 0 : "", sep = typeof(val) == 'number' ? 0 : ",") {
    let round = this.player.table.roundNumber     // so first round is round==1
    if (round < 1) return                         // ignore pre-game [pro-forma]
    let _name = `_${name}`
    if (this.statRound[name] != round) {
      this.statRound[name] = round
      sep = v0; this[_name] = v0
    }
    this[_name] += (val as string + sep) // js will resolve as number+number or string+string
  }

  /** list of Events activated this turn */
  addEvent(event: Card) { this.setTurnStat("events", `${event.name}(${event.step})`) }

  /** initial move distance, as rolled, before policy and tile effects. */
  distance(dist: number) { this.setTurnStat("totalDist", dist) }

  /** actual move distance, steps taken. */
  moveDist(dist: number) { this.setTurnStat("totalMove", dist) }

  addActualIncome(inc: number) {
    let round = this.player.table.roundNumber - 1 // so first round is round==0
    round = round - 1;        // so first round is round==0
    if (round < 0) return;    // ignore pre-game
    if (round != this.lastRound) {
      this.actualInc[round % this.keepLimit ] = 0;
      // backfill any missing rounds (if no roll, or no payments)
      for ( ; ++this.lastRound < round; ) {
        this.actualInc[this.lastRound-1 % this.keepLimit] = 0
      }
    // lastRound == round
    }
    this.actualInc[round % this.keepLimit] += inc
    this.lastInc = this.actualInc[round % this.keepLimit]
    this.AV = this.oneDecimal(this.actualInc.reduce((c,n) => c+n, 0) / this.actualInc.length);
    return
  }
  initZero() {
    this.numCards = this.totalCards = this.totalRoads = this.totalStep = this.totalNegStep = this.totalNegDist = 0;
    this.totalCost = this.totalStop = this.totalRentIn = this.totalRentOut = this.totalVP = 0;
    this.xcoins = this.player.coins
  }
  /** for mainMap.allStacks(forEachPlayer(p.adjustStats(card, card.stop, card.rent))) */
  adjustStats(card: Card, cardStop: number, cardRent: number, negDist: number = 0) {
    if (!card.noStop) {
      this.totalCards += 1    // total cards where player can stop/rent [vs Road, Airport, Taxi, Lake]
    }
    this.totalStep += card.step // sum all the plus or minus step values
    this.totalStop += cardStop
    this.totalRentOut += cardRent;
    this.totalNegDist += negDist;  // add up all: {dist: {add: -n}}
    if (this.player.isReallyOwner(card)) {
      this.numCards += 1;
      if (this.player == card.owner) {
        this.totalVP += card.vp as number;
        this.totalCost += card.costn;
        let bonus = card.getFranchiseBonus(this.player.robo.bonusAry(card)) // artifical bonus for 3-of-kind
        this.totalStep += bonus     // bonus when player step on this card/franchise
        this.totalNegStep += bonus  // bonus when others step on this card/franchise
      }
      this.totalRentIn += cardRent;
      this.totalRentOut -= cardRent;  // rent paid to (owner == self) does not count [vcOwnerDiscount!]
      if (card.type == S.Road) this.totalRoads += 1; // Roads owned by this player
      if (card.step < 0) {
        this.totalNegStep -= card.step
      }
    }
    // Debt.publichPlayerDebt will set stats.totalDebt
  }
  /**
   * 
   * @param debts debtPayment per turn
   */
  calcEV(): number {
    let np = TP.numPlayers;
    // this.player.table.allPlayers.map(p=>p.stats.numCards).reduce((prev_nc, cur_nc, ) => (prev_nc + cur_nc))
    let nsteps = (this.player.mainMap.filterTiles(c => true, S.Road).length || 1) // number of step-able cards
    let estep = 3 * (1 - this.totalNegDist/nsteps) // fewer onStep effects from {dist: -1}
    // if there are N step-able cards, and we roll "3*N", we expect to touch 3*(N-tNegDist) of the cards
    // expect plyr to roll a 3, each plyr will likely step on: 3*(N-tNegDist)/N == 3 * (1- tNegDist/N)
    // for a total payment of: steps * 3 * (1 - tNegDist/N)
    let debts = this.debtPayment // expected debtService payment
    let steps = this.totalStep + this.totalNegStep*(np-1) // coins recv'd from onStep
    let stops = this.totalStop
    let rents = this.totalRentIn * (np-1) - this.totalRentOut;
    let EV = this.EV = this.oneDecimal(-debts * 0 + (steps * estep + stops + rents) / (this.totalCards || 1));
    this.history[this.round] = this.hstat
    return EV;  // Expected Value of Income, per ROUND
  }
  clone(): this { return Obj.fromEntriesOf(this) }
  /** update display of stats */
  show(prefix: string) {
    console.log(stime(this, prefix), "EV:", this.EV, "stats:", this.clone(), this.player.name);
  }

}
