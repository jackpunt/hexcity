import { EzPromise } from "@thegraid/ezpromise";
import { EventDispatcher, Event } from "@thegraid/easeljs-module";
import { M, S } from "./basic-intfs";
import { Card, HouseToken, SlotInfo } from "./card";
import { CardContainer, CC } from "./card-container";
import { CardEvent } from "./card-event";
import { ChooseDir, DirSpec } from "./choose-dir";
import { DebtStats } from "./Debt";
import { FieldClause, NamedValues } from "./effects";
import { MoveRec, SiteInfo } from "./main-map";
import type { Player } from "./player";
import { Table } from "./table";
import { TP } from "./table-params";
import { stime, findFieldValue } from "@thegraid/common-lib";
import { Notifyable } from "./types"

interface BuildSiteInfo extends SiteInfo {
  EV?: number;
  EVdiff?: number;
  dir?: string
  dist?: number
  adjMetric?: number
}
/** abc: min adjustedBuildCost; residual: avail - (cost + abc) */
type BuildInfo = { card: Card, sites: BuildSiteInfo[], aname?: string, cost?: number, minBuild?: number, minSites?: BuildSiteInfo[], residual?: number, availBld?: number, useSite?: BuildSiteInfo, turn?: number, done?: boolean }
type Notify = {plyr: Player, source: EventDispatcher, eventName: string, dwell: number, aname?: string, roboCall?: ()=>void};

/**
 * Event indicating that the source RoboPlayer is invoking a [GUI] event.
 * Also used by Table/ChooseDir to prod player.robo into action: S.actionEnable
 *
 * Inbound from EventDispatcher: S.actionEnable(Table), S.choose(ChooseDir)
 *
 * Outbound from RoboPlayer: S.click, S.dropped/CC.dropEvent
 */
export class RoboEvent extends Event {
  override type: string;
  source: EventDispatcher | RoboBase;
  stageX: number = 300 // when RoboEvent pretends to be a "mouseevent" CC.parseMouseClick
  stageY: number = 300
  constructor(type: string, source: EventDispatcher | RoboBase) {
    super(type, true, true)
    this.type = type
    this.source = source
  }
}
/**
 * these method names define the RoboEvent names:
 */
interface RoboEventHandler {
  actionEnable(re: RoboEvent): void;
  drawBlocked(re: RoboEvent): void;
  drawDone(re: RoboEvent): void;
  dropDone(re: RoboEvent): void;
  chooseDir(re: RoboEvent): void;
}

export class RoboBase implements RoboEventHandler, Notifyable {
  constructor(table: Table, player: Player) {
    this.table = table
    this.player = player
    if (!!player.robo && !!player.robo["removeDropListeners"]) {
      player.robo["removeDropListeners"]()
    }
    player.robo = this
    this.setDwell(600, 500, 200)
    this.setListeners()
  }
  table: Table
  player: Player
  chooseP: EzPromise<ChooseDir> = undefined; // queue all notify() on chooseP.finally()
  blocked: boolean = false // ignore notify events while blocked
  roboBonusAry: number[] = []
  setBonusAry(): number[] {
    let ary = new Array<number>(TP.bonusNcards+1), d = TP.bonusNcards*(TP.bonusNcards+1)
    // 3->12 [2/12]; 4->20 [2/20, 3/20]; 5->30[2/30, 3/30, 4/30]
    return this.roboBonusAry = ary.fill(0).fill(TP.bonusAmt/d, 2).fill(TP.bonusAmt, TP.bonusNcards)
  }
  bonusAry(card: Card): number[] {
    return (this.roboBonusAry.length == TP.bonusNcards) ? this.roboBonusAry : this.setBonusAry()
  }
  /** @param source undefined -> block; EventDispatcher->notify */
  block(source?: EventDispatcher, eventName = S.actionEnable, dwell?: number) {
    this.blocked = !source;
    console.log(stime(this, ".block:"), this.blocked, source)
    if (!!source) this.notify(source, eventName, dwell)
  }
  setDwell(move, flash, flip) {
    TP.moveDwell = move
    TP.flashDwell = flash
    TP.flipDwell = flip
  }
  /** wait for dwell time, then invoke curPlayer[eventName](roboEvent)
   * @param source {table, chooser} that is waiting for Robo to respond
   * @param eventName method to invoke {S.actionEnable, S.tryFinishBuild, S.choose}
   * @param dwell wait a while before dispatching - msecs
   */
  notify(source: EventDispatcher, eventName: string, dwell: number = 400) {
    if (!!this.chooseP) {
      console.debug(stime(this, ".notify after chooseP="), this.chooseP)
      this.chooseP.finally(() => this.notify(source, eventName, dwell))
      return
    }
    if (source instanceof ChooseDir) { // or (eventName == S.chooseDir)
      this.chooseP = source.rv         // delay event delivery
      console.debug(stime(this, ".notify: set chooseP="), this.chooseP)
      this.chooseP.finally(() => {
        this.chooseP = undefined
        console.debug(stime(this, ".notify: clear chooseP="), this.chooseP)
      }) // disable intercession
    }
    // ASSERT: !this.chooseP || eventName == S.chooseDir

    if (this.blocked) return // no roboCall until unblocked.
    if (this.player.isMoving()) return // wait for [Event] to finish moving
    console.debug(stime(this, ".notify:"), {source, aname: source[S.Aname], eventName})
    let roboEvent = new RoboEvent(eventName, source)
    let plyr = this.player         // for 'chooseDir' may be != table.curPlayer
    let roboFunc: Function = plyr.robo[eventName]; // Auto map from eventName -> method Call
    if (typeof(roboFunc) != "function") {
      console.warn(stime(this, '.notify'), `eventName not defined: ${eventName} => func`)
      return
    }
    let roboCall = () => {
      console.debug(stime(this, ".roboCall on roboEvent:"), roboEvent)
      roboFunc.call(plyr.robo, roboEvent)
    }
    let cardP0 = this.table.auctionP0.bottomCardOfStack()
    if (eventName == S.drawDone && !!cardP0) {
      if (cardP0.type === S.Deferred && this.player.coins >= 0) {
        console.log(stime(this, ".notify: clickP0"), cardP0.name, cardP0)
        setTimeout(() => this.clickP0(), 0.8 * dwell)
      }
      this.waitForP0Dropped( {plyr, source, eventName, dwell, aname: source[S.Aname], roboCall})
    } else {
      setTimeout(roboCall, dwell)
    }
  }
  listenersSet: boolean = false;
  listenersAll: Map<CC, Function> = new Map<CC, Function>() // .on listeners
  setDropListener(cont: CC, handler = this.roboDropHandler) {
    let type = S.dropped, listener = cont.on(type, handler, this)
    listener["aname"] = `${this.player.index}-dropOn-${cont.name}`
    this.listenersAll.set(cont, listener)
  }
  removeDropListeners() {
    this.listenersAll.forEach((v, k) => k.removeEventListener(S.dropped, v))
  }
  /** works with notify() & waitForRoboCallEvent to detect card dropped from P0. */
  setListeners() {
    if (this.listenersSet) return
    this.setDropListener(this.table.policySlots)
    this.setDropListener(this.table.discardT)
    this.table.forEachPlayer(p => {  // maybe only for this.player? (this === this.player.robo)
      this.setDropListener(p.plyrPolis) // P1 drops Policy on P1 or P2 (ok)
    })
    this.setDropListener(this.player.plyrProjs) // P1 drops Tile/Event/Policy on plyrProjs
    this.setDropListener(this.table.mainMap) // gov card from discardP, mostly
    this.listenersSet = true;
  }
  roboCalls: Array<Notify> = [] // maybe only need to be a single instance
  /** wait for event to open roboCall queue; typically wait for P0 Dropped */
  waitForP0Dropped(rc: Notify) {
    if (rc.eventName == S.drawBlocked)  // do not re-send drawBlocked (auctionP0 or discardT[gov])
      rc.eventName = S.actionEnable     // morph into actionEnable
    console.log(stime(this, `.waitForRoboCallEvent: rc=`), rc)
    this.roboCalls.push(rc)
  }

  roboDropHandler(ce: CardEvent) {
    let srcCont = ce.card.origSlot.cont, dstCont = ce.card.slotInfo.cont
    if (srcCont == this.table.auctionP0 || srcCont == this.table.discardP || dstCont == this.player.plyrDebt) {
      let rcl = this.roboCalls.length, rcc = [].concat(this.roboCalls) // copy of this.roboCalls
      this.roboCalls = []
      console.debug(stime(this, `.roboDropHandler:`), `from: ${dstCont.name}, RCL: ${rcl}`)
      //if (rcl > 1) alert(`roboCall.length=${rcl}`) // it's always: drawDone, drawDone?
      rcc.forEach((rc: Notify) => {
        console.debug(stime(this, `.roboDropHandler: rc=`), rc)
        let {plyr, source, eventName, dwell, roboCall} = rc
        plyr.robo.notify(source, eventName, dwell) // make new roboCall if auctionP0 is empty
        //rc.roboCall()
      })
    }
  };

  doAction(action: ()=> void)  {
      action()
  }

  actionEnable(re: RoboEvent) {} // Override to provoke draw & drop
  drawDone(re: RoboEvent) { this.actionEnable(re)}
  dropDone(re: RoboEvent) { this.actionEnable(re)}
  drawBlocked(re: RoboEvent) {
    let plyr = this.player
    let source = re.source as EventDispatcher
    let eventName = re.type
    let dwell = undefined as number
    let aname = S.drawBlocked
    this.waitForP0Dropped({source, eventName, dwell, plyr, aname})
  }

  /** listener for need to pick from ChooseDir */
  chooseDir(re: RoboEvent) {
    let cd = re.source as ChooseDir
    this.chooseP = cd.rv                           // enable intercession
    this.chooseP.finally(this.chooseP = undefined) // disable intercession
    console.log(stime(this, '.chooseDir'), this.player.name, cd.card.name, cd.spec)
    // alert("need robo to chooseDir: "+ this.table.curPlayer.name)
    // expect massive case stmt with calls to click(choice)
  }

  clickChoice(chooser: ChooseDir, dir: keyof DirSpec) {
    //chooser.buttons[dir].shape.dispatchEvent("mousedown", true, true) // propagate to chooser w/target = Shape
    this.doAction(() => chooser.buttonClickDir(dir))
    // TBD, likely will be followed by endOfMove(chooseDir) or flipDone(event-effects)
  }
  clickTurnButton() {
    this.doAction(() => this.table.turnButton.dispatchEvent(new RoboEvent(S.click, this)))
  }
  clickP0() {
    let cardP0 = this.table.auctionP0.bottomCardOfStack()
    if (!cardP0) return
    this.doAction(() => cardP0.bitmap.dispatchEvent(new RoboEvent(S.click, this))) // provoke discard or plyrProj
  }
  clickDrawPolicy() {
    this.doAction(() => this.table.policyDeck.back.bitmap.dispatchEvent(new RoboEvent(S.click, this))) // Player: transferClickToDeck
  }
  clickDrawTile() {
    this.doAction(() => this.table.tileDeck.back.bitmap.dispatchEvent(new RoboEvent(S.click, this)))
  }
  /** initiate new move */
  clickPlyrDist() {
    // assert: there is always a card on top of plyrDist(0,1)
    let row = 0, col = 1, card = this.player.plyrDist.bottomCardOfStack(row, col)
    this.doAction(() => this.player.plyrDist.dispatchCardEvent(S.clicked, card, row, col))
  }
  borrowOne() {
    this.doAction(() => {
      let mainDebt = this.table.dft.mainCont
      let plyrDebt = this.player.plyrDebt
      this.dragCardToSlot(mainDebt.bottomCardOfStack(), {cont: plyrDebt, row: 0, col: 0})
    })
  }
  /** on S.turnOver event, put back debt to clean up history/stats. */
  tryRepayDebt() {
    this.table.dft.mainCont.tryPayPlayerDebt(this.player)
  }
  /**
   * @param card the card to be moved
   * @param dstInfo the {cont, row, col} where card is dropped
   */
  dragCardToSlot(card: Card, dstInfo: SlotInfo) {
    let { row, col, cont } = dstInfo // destination
    this.doAction(() => cont.dragStartAndDrop(new CardEvent(CC.dropEvent, card, row, col, cont)))
  }
  /**
   * buy Tile|Policy|Event placing in plyrProjs
   * @param card
   */
  buyToProj(card: Card) {
    let dest = { cont: this.player.plyrProjs, row: 0, col: 0 }
    this.doAction(() => this.dragCardToSlot(card, dest))
  }
  /**
   * buy Policy card (from auctionP0, auctionTN)
   * @param card srcCont.topOfStack(0, col)
   * @param cont plyrPolis || table.policySlots
   * @param row 0|1 for table.policySlots
   */
  buyToPolicy(card: Card, cont: CardContainer = this.player.plyrPolis, row: number = 0) {
    let dest = { cont: cont, row: row, col: 0 }
    this.doAction(() => this.dragCardToSlot(card, dest))
  }
  /** discard the Card (Policy|Event|Tile) */
  discard(card: Card) {
    let table = this.table, destInfo = {cont: table.discardT, row: 0, col: 0}
    this.doAction(() => this.dragCardToSlot(card, destInfo))
  }

}
/** default RoboPlayer: does nothing. */
export class GUI extends RoboBase {
}

/**
 * Emit events to advance a Player's turn.
 */
export class RoboOne extends RoboBase {
  constructor(table: Table, player: Player) {
    super(table, player)
    this.setDwell(300, 200, 100)
    table.on(S.turnOver, this.tryRepayDebt, this)
  }
  findingBuildInfo: boolean = false;
  tryBuildInfo: BuildInfo;

  /** entry point: time to do something on Table. */
  override actionEnable(re: RoboEvent) {
    let table = re.source as Table
    let player = this.player
    let turn = table.turnNumber
    if (table.roundNumber < 1) return     // until we do distArrange and HomePlacement
    if (table.roundNumber < 2 && player.homeCard.slotInfo.cont !== table.mainMap) {
      if (table.turnNumber == 1) {
        this.dragCardToSlot(player.homeCard, {cont: table.mainMap, row: 2, col: 3})
      } else {
        this.dragCardToSlot(player.homeCard, {cont: table.mainMap, row: 3, col: 6})
      }
      return
    }
    if (player != table.curPlayer) return // until/unless we find something for the non-player
    if (this != player.robo) return       // player has a new robo
    if (player.isMoving()) return         // Event in progress (goTo) wait for next actionEnable.
    //if (table.waitingToArrange(player)) (table.roundNumber == 0)
    if (player.moves > 0) { this.clickPlyrDist(); return}
    if (player.draws > 0) {
      let nPolicy = Math.max(5, this.table.policyDeck.getStack().length)
      let nTile = Math.max(5, this.table.tileDeck.getStack().length)
      if (Math.random() * (nTile + nPolicy) * TP.roboDrawTile >= nTile) {
        this.clickDrawPolicy()
      } else {
        this.clickDrawTile()
      }
      return
    }
    if (this.maybeBorrow()) return // Debt dropped should restart...

    if (!!this.tryBuildInfo && this.tryBuildInfo.turn == turn && !this.tryBuildInfo.done) {
      console.log(stime(this, ".actionEnable: tryFinishBuild tryBuildInfo="), this.tryBuildInfo)
      this.tryFinishBuild()   // finish what was started; expect card in plyrProjs?
      return
    }
    // no BuildInfo in progress: (maybe look for new buy/build project)
    if (this.findingBuildInfo) return // presumably will be notified by buildInfP.then(...)

    // QQQQ: should we first findSiteAndBuild(plyrProjs?) OR findTileToBuyBuild(market) ??
    // QQQQ: if we have *only* a BUY? [esp get a deal from auction -2; or mkt.length==1]
    // if build & buy:
    if (player.builds > 0 && player.buys > 0 && !this.findingBuildInfo) {
      console.log(stime(this, ".actionEnable: findTileToBuyBuild"), {buys: player.buys, builds: player.builds, coins: player.coins})
      this.findTileToBuyBuild()    // maybe set: findingBuildInfo = true
      return
    }
    if (this.tryBuildPrjTiles("actionEnable")) return

    // nothing to do: let user click nextTurnButton
    if (this.table.turnButton.blocked) {
      alert("All Done, but turnButton still blocked")
      this.table.turnButton.block(false)
    }
  }
  tryBuildPrjTiles(src: string): boolean {
    let player = this.player
    // if build & plyrProj, and no BuildInfo in progress:
    let tiles: Card[] = player.plyrProjs.getStack().filter(c => c.isTile() || c instanceof HouseToken); // Tiles available to build in plyrProjs
    if (player.builds > 0 && tiles.length > 0) {
      console.log(stime(this, `.tryBuildIfTiles[${src}]: findSiteAndBuild tiles=`), tiles)
      this.findSiteAndBuild(tiles) // maybe set: findingBuildInfo = true
      return true
    }
    return false
  }

  findTileToBuyBuild() {
    if (this.table.turnButton.blocked) return       // prevent second finding (happens sometimes when we 'wait')
    if (!(this.player.builds > 0 && this.player.buys > 0)) return // obsolete queued request: TODO: avoid that!
    let tiles = this.availableCards();
    let player = this.player
    this.findBuildSite(tiles, player.coins, true).then(buildInf => {
      console.log(stime(this, "._findTileToBuyBuild:"), buildInf, !!buildInf && buildInf.useSite, { coins: player.coins, builds: player.builds })
      // assert: noBuildInfo already checked, make a new BuildInfo:
      if (player.coins >= 0 && player.buys > 0 && player.builds > 0 && !!buildInf && buildInf.card) {
        this.tryBuildInfo = buildInf    // with turn & done = false
        this.tryBuyBuild(buildInf.card) // first: buyToProj; dropDone-> actionEnable -> tryFinishBuild
      }
      if (!buildInf) this.tryBuildPrjTiles("findTileToBuyBuild")
    })
  }
  findSiteAndBuild(tiles: Card[]) {
    let player = this.player
    this.findBuildSite(tiles, player.coins, false).then((buildInf) => {
      console.log(stime(this, ".findSiteAndBuild:"), buildInf, !!buildInf && buildInf.useSite, { builds: player.builds, coins: player.coins })
      if (player.coins >= 0 && player.builds > 0 && !!buildInf && buildInf.card) {
        this.tryBuildInfo = buildInf    // with turn & done = false
        this.tryFinishBuild()           // drag to build, unblock
      }
    })
  }
  maybeBorrow(): boolean {
    if (this.table.roundNumber <= 1) return false; // do not borrow when neg coins
    let pstats = this.player.stats, dstats = pstats.debtStats as DebtStats
    let limit = pstats.totalDebt + (!!dstats ? (- dstats.vcDebt + dstats.nvcDebt) : 0)
    let borrow = Math.floor(pstats.EV/2) - limit
    if (borrow > 0) {
      this.borrowOne()
      return true
    }
    return false
  }
  extantHousing(plyr: Player = this.player) {
    let housing: Card[] = []
    this.table.mainMap.forAllStacks((row, col, stack) => {
      let bc = stack[0]
      if (!!bc && (bc.name == S.Housing) && (bc.owner == plyr)) housing.push(stack[0])
    })
    return housing
  }
  placeForToken(token: HouseToken): boolean {
    let extant = this.extantHousing()
    return !!extant.find(tile => HouseToken.onCard(tile).length < 2 || token.upgradeCredit(tile) > 0)
  }
  minCostByAssets(player: Player) {
    let rangeToCost = [0, 1, 1, 2, 3, 3, 4, 4, 5, 5]
    let r = Math.min(this.player.rangeRaw, rangeToCost.length-1) // raw range = assets(=SUM(costn+VP))/TP.rangeDivisor
    let rv = rangeToCost[r]
    //if (this.unImprovedHousing()) return Math.min(rv, TP.minHouseCost) // ok to put HouseToken on TP.Housing
    return rv
  }
  /** tiles available in markets, costing at least minCost (or HousingToken)
   * @param minCost do not invest in card with costn less than minCost
   * @param reqTile true to reject any Policy cards in auctionTN
   */
  availableCards(minCost: number = this.minCostByAssets(this.player), reqTile = true): Card[] {
    let tiles = Array<Card>(), extantHousing = this.extantHousing(), neh = extantHousing.length
    this.table.allMkts.forEach(cont => {
      cont.forAllStacks((row, col, stack) => {
        if (stack.length == 0) return
        let card = stack[stack.length-1]
        if (card instanceof HouseToken && this.placeForToken(card)) {
          tiles.push(card)
          return
        }
        if (reqTile && !card.isTile("Road")) return
        if ((card.costn >= minCost) || (card.name == S.Housing && neh < 2) || card.type == S.Govern) {
          tiles.push(card)
        }
      })
    })
    return tiles
  }
  /** find legal Sites for each [available] card */
  selectBuildableSites(cards: Card[], avail: number, adjForBuy = true): BuildInfo[] {
    let availBld = avail, names: string[] = []
    let rv = new Array<BuildInfo>(); rv["names"] = names
    cards.forEach(card => {
      if (adjForBuy) availBld = avail - this.table.gamePlay.adjustedCost(card) // sets card.adjustedCost
      let sites = this.table.mainMap.markLegalPlacements(card, this.player, availBld);
      if (sites.length <= 0) return
      names.push(card.name)
      let buildInf: BuildInfo = { card, aname: card.name, sites, availBld }
      buildInf["cardSites"] = sites
      rv.push(buildInf)
    })
    return rv
  }
  /** for each card, keep only the cheapest build site[s] */
  selectMinBuildCost(sitesForCard: BuildInfo[]): BuildInfo[] {
    sitesForCard.forEach(buildInf => { // for each Card; {card, sites[]}
      let card: Card = buildInf.card
      let minBuild = 999, minSites: SiteInfo[] = []
      buildInf.sites.forEach(site => {      // find site[s] with min buildCost
        let bc: number = site.cost   // computed buildCost at site (from markLegalPLacements)
        if (bc < minBuild) { minBuild = bc; minSites = new Array<SiteInfo>() }
        if (bc == minBuild) { minSites.push(site) }
      })
      let residual = buildInf.availBld - minBuild, sites = minSites
      let newInfo: BuildInfo = { card, sites, minBuild, residual }
      buildInf["minSites"] = sites
      Object.assign(buildInf, newInfo)
    })
    return sitesForCard   // with 'sites' reduced, and availBld, etc added
  }
  selectMaxAsset(infoAry: BuildInfo[]): BuildInfo[] {
    let asset = (c: Card) => {
      return c.costn + ((typeof(c.vp) == 'number' ) ? c.vp : new NamedValues().nthAirportVP(c, this.player, 1))
    }
    let maxA = Math.max.apply(Math, infoAry.map(info => asset(info.card)))
    return infoAry.filter(inf => asset(inf.card) == maxA)
  }
  selectMinResidual(sinfoC: BuildInfo[]): BuildInfo[] {
    let res0 = Math.min.apply(Math, sinfoC.map(info => info.residual))
    let sinfoD = sinfoC.filter(inf => (inf.residual == res0))
    //console.log(stime(this, ".selectMinResidual"), {player: this.player.name, res0, sinfoD, sinfoC })
    return sinfoD
  }
  buffIfNextStepIsCard(plyr: Player, card: Card, ev0 = plyr.stats.EV): number {
    if (plyr.plyrDist.getStack(0,0).length == 0) return ev0 // will likely draw new direction
    if (!plyr.direction) return ev0                        // round1: no direction set
    let curLoc = plyr.initialStartRec(0)
    curLoc.dir = plyr.moveDir // QQQQ: may be dodgy if/when we have choice of dir...
    let nextStep = this.table.mainMap.findNextCard(curLoc).card
    if (nextStep != card) return ev0
    //plyr.stats.adjustStats(card, 0, 0) // empthasize next Step value (if plyr is aimed at card)
    let adjustEVforOneStep = (plyr: Player, step: number): number => {
      let stats = plyr.stats
      // ev0 = (3*totalStep + totalStop + totalRent)/nc
      // ev1 = (3*totalStep + totalStop + totalRent + step1)/(nc+1)
      // ev1 = (nc*ev0+step1)/(nc+1)
      let nc = stats.totalCards, ev1 = (nc * ev0 + ((plyr == card.owner && step < 0) ? 0 : step)) / (nc + 1)
      return M.decimalRound(ev1,4)
    }
    return adjustEVforOneStep(plyr, card.step)
  }
  /** use adjustAllRentsAndStats to find cards/builds with best EVdiff */
  selectMaxEVdiff(infoAry: BuildInfo[]): BuildSiteInfo[] {
    let table = this.table //, bestSites: SlotInfo[] = [], bestInfoVal: number = -999
    let maxEVdiff = -999, maxSites: BuildSiteInfo[] = [], silent = true, EV = table.allPlayers.map(p => p.stats.EV)
    infoAry.forEach(inf => {
      let card = inf.card, cardMaxDiff = -999 // check all sites for inf.card
      inf.sites.forEach((site: BuildSiteInfo ) => {
        // place tile & effects, calcEV (for each Player), undo;
        let { cont, row, col, stack } = site
        table.undoEnable(".selectMaxEVdiff")
        // NOTE: Tile upgrade needs to remove the underlying card! [payBuidCost does maybeUpgradeHousing...]
        if (!!stack[0] && !(card instanceof HouseToken)) stack[0].moveCardWithUndo(table.discardT, 0, 0) // discard orig Tile from site & DB
        card.moveCardWithUndo(cont, row, col);          // place card on site
        card.owner = this.player                        // another undoRec
        table.effects.addCardPropsWithUndo(card, "temp-build") // assert undoable Effects of Card (buff-effects)
        table.adjustAllRentsAndStats(undefined, silent) // tileChange: compute silently
        let EVdiff = 0, evd = []
        table.forEachPlayer((p, ndx) => {
          let evRaw = p.stats.EV
          let evBuf = this.buffIfNextStepIsCard(p, card, evRaw)
          evd[ndx] = { EV: EV[ndx], evRaw, evBuf, stats: p.stats.clone()}
          EVdiff += (p == this.player ? evBuf : -evBuf) // ev[this.player] - SUM(ev[...otherPlayers])
        })
        EVdiff = M.decimalRound(EVdiff, 4)
        site.EV = M.decimalRound(this.player.stats.EV, 4)
        site.EVdiff = EVdiff;  // if we were doing post-processing... for now we just get max:
        if (EVdiff > cardMaxDiff) { cardMaxDiff = EVdiff}
        if (EVdiff > maxEVdiff) { maxSites = []; maxEVdiff = EVdiff }
        if (EVdiff == maxEVdiff) { maxSites.push(site) }
        table.undoClose(".selectMaxEVdiff")
        let undoRec = table.undoRecs[table.undoRecs.length - 1][0]
        site["BuildInfo"] = inf
        site["aname"] = card.name
        site["logInfo"] = { aname: undoRec.aname, EVdiff, cardMaxDiff, 'evd[0]': evd[0], 'evd[1]': evd[1], evd: evd }
        console.log(stime(this, ".selectMaxEVdiff:"), site["logInfo"])
        table.undoIt()
      })
      inf["cardMaxDiff"] = cardMaxDiff
    })
    console.log(stime(this, ".selectMaxEVdiff"), maxEVdiff, maxSites)
    return maxSites // all have same EVdiff; different sites for different cards
  }
  selectMaxEV(maxSites: BuildSiteInfo[]) {
    let maxEV = Math.max.apply(Math, maxSites.map(site => site.EV))
    return maxSites.filter(site => site.EV == maxEV)
  }
  filterAdjacentOwner(sites: BuildSiteInfo[], player = this.player): BuildSiteInfo[] {
    // for each site, count number of directly adjacent cards owned by player:
    /** @return true if card would be rentAdjusted by card0 */
    let isRentAdjuster = (card: Card, player: Player, card0: Card): boolean => {
      if (findFieldValue(card0, 'props', S.onBuild, S.rentAdjust, 'filter', 'range') != 1) return false
      let rap = findFieldValue(card0, 'props', S.onBuild, S.rentAdjust)  // rent props
      let fc = new FieldClause(null, S.rentAdjust, rap)
      return fc.evalFilters(card, player, card0) // requires card to be mainMap.bottomCardOfStack(row,col)
    }
    let mainMap = this.table.mainMap, adjMax: number[] = []
    sites.forEach(site => {
      let card = site.card, id = card.id, adjMetric: number = 0;  // undefined if no adjacency...
      // check each acard adjacent to site (card):
      let calcAdjMetric = (adj: MoveRec) => {
        let acard = mainMap.getStack(adj.row, adj.col)[0]
        if (!acard) return
        let slotInfo = card.slotInfo; // must set slotInfo for filter: range to work (mainMap.rangeTo)
        card.slotInfo = {cont: site.cont, row: site.row, col: site.col, stack: site.stack}
        mainMap.getStack(site.row, site.col).unshift(card)  // TODO: use markLegalPlacements(... extra?)
        let incv = !acard.owner ? 0 : (acard.owner == player) ? 3 : -1 // primary: max my rent, secondary: min other rent
        if (isRentAdjuster(card, player, acard)) adjMetric += 2     // if site.card is adjusted by acard
        if (isRentAdjuster(acard, player, card)) adjMetric += incv  // if acard is adjusted by site.card
        mainMap.getStack(site.row, site.col).shift()        // TODO: use markLegalPlacements(... extra?)
        card.slotInfo = slotInfo; // restore prior slotInfo (likely: plyrProj(0,0))
      }
      mainMap.forEachAdjacent(site.row, site.col, calcAdjMetric)
      site.adjMetric = adjMetric
      if (adjMax[id] == undefined || adjMax[id] <= adjMetric) adjMax[id] = adjMetric
    })
    sites.forEach(site => site['maxAdj'] = adjMax[site.card.id])
    return sites.filter(site => (adjMax[site.card.id] == undefined) || (site.adjMetric == adjMax[site.card.id]))
  }
  /** uniform random selection from array */
  selectOneOf<T>(ary: Array<T>): T { return ary[Math.floor(Math.random()*ary.length)] }

  /** Start search for best site[s] for available tiles */
  findBuildSite(tiles: Card[], avail = this.player.coins, adjForBuy = true): EzPromise<BuildInfo> {
    let rv = new EzPromise<BuildInfo>()
    this.findingBuildInfo = true                  // block actions until _findBuildSite finishes
    // after createjs draws the canvas, yield so chrome can repaint; *THEN* run findBuildSite()
    let afterUpdate = () => setTimeout(() => rv.fulfill(this._findBuildSite(tiles, avail, adjForBuy)), 5)
    this.table.turnButton.block(true, afterUpdate, this) // hide turnButton (during intense search)
    return rv
  }
  _findBuildSite(tiles: Card[], avail: number, adjForBuy: boolean): BuildInfo | undefined {
    let canvas = this.table.stage.canvas
    this.table.stage.canvas = undefined
    console.groupCollapsed(`findBuildSite-${this.table.turnButton.visible?'t':'f'}`)
    this.table.effects.pushLogUpdateField(false)
    let buildInf: BuildInfo
    let buildAll = this.selectBuildableSites(tiles, avail, adjForBuy)
    let cardsAll: string[] = buildAll["names"]
    let buildFew = buildAll; //this.selectMinBuildCost(buildAll)
    let cardsFew: String[] = buildFew.map(inf => inf.card.name)
    if (buildFew.length > 0) { // if are Tiles suitable for buy & build
      let infoA = buildFew; //this.selectMaxAsset(infoAry)
      let infoR = infoA; //this.selectMinResidual(infoA)
      let maxSites = this.selectMaxEVdiff(infoR)  // sites with max EVdiff
      let maxEVSites = this.selectMaxEV(maxSites) // sites with maxEV (among maxEVdiff)
      let adjSites = this.filterAdjacentOwner(maxEVSites)
      let useSite = this.selectOneOf(adjSites)
      if (useSite == undefined) {
        alert(`robo-player.findBuildSite useSite == undefined`) // should not happen; maybe manual d&d?
        console.warn(stime(this, `.findBuildSite no useSite! infoA=`), infoA, 'adjSites=', adjSites)
        useSite = maxSites[0] // try pick something with [BuildInfo]
      }
      // TODO: return useSite: BuildSiteInfo and use that upstream instead of BuildInfo!?
      buildInf = useSite["BuildInfo"] as BuildInfo
      buildInf.useSite = useSite;
      buildInf["maxSites"] = maxSites
      buildInf["maxEVSites"] = maxEVSites
      buildInf["adjSites"] = adjSites
      buildInf["cardsAll"] = cardsAll
      buildInf["cardsFew"] = cardsFew
      buildInf["buildAll"] = buildAll
      buildInf["buildFew"] = buildFew
      buildInf.turn = this.table.turnNumber
      buildInf.done = false
    } else {
      buildInf = undefined
      this.findingBuildInfo = false
      this.table.turnButton.block(false)
    }
    this.table.stage.canvas = canvas
    this.table.stage.update()
    this.table.effects.popLogUpdateField()
    console.groupEnd()   // "findBuildSite-"
    return buildInf
  }

  // TODO: phase through game:
  // get (range > 1); assets > TP.rangeThreshold
  // get (assets > 16); to enable large borrow
  // buy/bld Airport(s) or High-Tech (Assets, Rent, VPs)
  // buy/bld an expensive tile (cost >= 8) for large mortgage
  // increase EV (large rents, demolish low rents)
  // buy/bld S.Housing, HouseToken
  // borrow max to build High-Rise, Tower
  tryBuyBuild(card: Card) {
    this.buyToProj(card)
  }
  // dropDone(re: RoboEvent) {
  //   this.tryFinishBuild()
  // }
  /** after waiting for Buy to finish... */
  tryFinishBuild() {
    if (!this.tryBuildInfo || this.tryBuildInfo.done || this.tryBuildInfo.turn < this.table.turnNumber) return
    if (this.tryBuildInfo.card.slotInfo.cont != this.player.plyrProjs) return // already built or undone
    // hmm, dragCardToSlot [on mainMap] should not work if card is *on* mainMap!
    let site = this.tryBuildInfo.useSite
    this.tryBuildInfo.done = true              // no turning back this BuildInfo is/will-be done
    this.dragCardToSlot(this.tryBuildInfo.card, site) // -> S.dropDone
    this.findingBuildInfo = false
    this.table.turnButton.block(false)         // renable findTileToBuyBuild !?
  }

  /** pregame: distArranger */
  round0() {

  }
}
