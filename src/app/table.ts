import { Constructor, whileP } from '@thegraid/common-lib';
import { Dragger, findFieldValue, KeyBinder, ParamGUI, ScaleableContainer, ScaleEvent, stime, Undo } from '@thegraid/easeljs-lib';
import { Container, DisplayObject, EventDispatcher, MouseEvent, Point, Shape, Stage, Text } from '@thegraid/easeljs-module';
import { EzPromise } from '@thegraid/ezpromise';
import { KVpair } from '../proto/CmProto';
import { C, F, M, S, WH, XY } from './basic-intfs';
import { Card, HouseToken, SlotInfo, Stack } from './card';
import { CardContainer, CC, CCopts, ContainerAt } from './card-container';
import { CardEvent, ValueEvent } from "./card-event";
import { ChooseDir } from './choose-dir';
import { CmClient } from './cm-client';
import type { DebtForTable } from './Debt';
import { Effects } from './effects';
import type { GamePlay } from './game-play';
import { MainMap } from './main-map';
import { Player } from './player';
import { TP } from './table-params';
import { ValueCounter } from "./value-counter";
import { Hex, Hex2, HexMap } from './hex';
import { Tile } from './tile';

/** MakeCardContainer Options */
export type MCCOpts = {
  clazz?: typeof CardContainer,
  // TableComponent:
  x?: number, y?: number, xl?: number, yt?: number, // align at x: - xl:fullwidth (that is: align left edge at x)
  // CardContainer:
  name?: string, color?: string, slotsX?: number, slotsY?: number, size?: WH, margins?: WH, counter?:{},
  dropOnCard?:boolean | ((ce:CardEvent) => boolean), drag?:boolean,
  markColor?: string, backCard?: boolean, backClick?: boolean, bg?: boolean, bgclick?: ((e:MouseEvent) => void),

  stackRow?: number, stackCol?: number, shuffle?:boolean, // shuffle stack onto [stackRow][stackCol]
}

class TextLog extends Container {
  constructor(public Aname: string, nlines = 6, public size: number = 30, public lead = 3) {
    super()
    this.lines = new Array<Text>(nlines);
    for (let ndx = 0; ndx < nlines; ndx++) this.lines[ndx] = this.newText(`//0:`)
    this.addChild(...this.lines);
  }

  lines: Text[];
  lastLine = '';
  nReps = 0;

  height(n = this.lines.length) {
    return (this.size + this.lead) * n;
  }

  clear() {
    this.lines.forEach(tline => tline.text = '');
    this.stage?.update();
  }

  private newText(line = '') {
    const text = new Text(line, F.fontSpec(this.size));
    text.textAlign = 'left';
    text.mouseEnabled = false;
    return text;
  }

  private spaceLines(cy = 0, lead = this.lead) {
    this.lines.forEach(tline => (tline.y = cy, cy += tline.getMeasuredLineHeight() + lead))
  }

  log(line: string, from = '', toConsole = true) {
    line = line.replace('/\n/g', '-');
    toConsole && console.log(stime(`${from}:`), line);
    if (line === this.lastLine) {
      this.lines[this.lines.length - 1].text = `[${++this.nReps}] ${line}`;
    } else {
      this.removeChild(this.lines.shift());
      this.lines.push(this.addChild(this.newText(line)));
      this.spaceLines();
      this.lastLine = line;
      this.nReps = 0;
    }
    this.stage?.update();
    return line;
  }
}

class TurnButton extends Shape {
  blocked: boolean = false
  radius: number
  constructor(radius: number) {
    super()
    this.radius = radius
  }
  /**
   *
   * @param block true to hide and disable the turnButton
   * @param afterUpdate callback when stage.update is done [none]
   * @param scope thisArg for afterUpdate [this TurnButton]
   */
  block(block: boolean, afterUpdate?: (evt?: Object, ...args: any) => void, scope: any = this) {
    this.blocked = block
    this.visible = this.mouseEnabled = !block
    // using @thegraid/easeljs-module@^1.1.8: on(once=true) will now 'just work'
    afterUpdate && this.stage.on("drawend", afterUpdate, scope, true)
    this.stage.update()
  }
  render(color: string) {
    let radius = this.radius
    this.graphics.clear().beginFill(color).drawEllipse(-radius, -radius, 2 * radius, 2 * radius)
  }
}
export interface Dragable {
  dragFunc0(hex: Hex2, ctx: DragContext): void;
  dropFunc0(hex: Hex2, ctx: DragContext): void;
}

type MinDragInfo = { first?: boolean, event?: MouseEvent };

export interface DragContext {
  targetHex: Hex2;      // last isLegalTarget() or fromHex
  lastShift: boolean;   // true if Shift key is down
  lastCtrl: boolean;    // true if control key is down
  info: MinDragInfo;    // we only use { first, event }
  tile: Tile;           // the DisplayObject being dragged
  nLegal?: number;      // number of legal drop tiles (excluding recycle)
  phase?: string;       // keysof GameState.states
  //gameState?: GameState;// gamePlay.gameState
}

/** Table holds the ScaleableContainer with MainMap and other CardContainers on the main Canvas. */
export class Table extends EventDispatcher {
  constructor(stage: Stage) {
    super();
    stage['table'] = this // backpointer so Containers can find their Table (& curMark)
    this.stage = stage
    this.scaleCont = this.makeScaleCont(!!stage.canvas)
  }
  scaleCont: ScaleableContainer;
  stage: Stage;
  gamePlay: GamePlay;
  dft: DebtForTable;    // the only linkage from Table -> Debt; injected by game-setup
  // these field names are recorded in setThisCardsField
  homeCards: Stack;
  tokenCards: Stack;
  dotsCards: Stack;
  dirCards: Stack;     // game-setup.fieldNameForDeck
  alignCards: Stack;
  tileCards: Stack = new Stack();    // card.isTileStack()  --> tileDeck
  policyCards: Stack = new Stack();  // card.isPoliyStack() --> policyDeck

  alignDeck: CardContainer;
  tileDeck: CardContainer;
  policyDeck: CardContainer;
  /** 2 Slots for Global Policies */
  policySlots: CardContainer;
  //auctionCont: Container;
  /** Temp & 0-cost Policy, Deferred, and Events */
  auctionP0: CardContainer; // Temp & 0-cost Policy, Deferred, and Events are turned to this Stack for Player resolution
  /** Property Tiles, Future Events & Policy-w/Cost */
  auctionTN: CardContainer; // Property Tiles, Future Events & Policy-w/Cost
  /** unsold Gov Propeties -> mainMap */
  discardP: CardContainer; // unsold Gov Propeties -> mainMap
  /** Scrap Heap: invoked Events & Future, revoked Policy, Urban Renewal Property, unsold Auction */
  discardT: CardContainer; // invoked Events & Future, revoked Policy, Urban Renewal Property, unsold Auction
  /** Coin, Industry, S.Housing and Random market Tiles */
  mktConts: CardContainer[]; // the coin*Cont/ind*Cont :CardContainer NON-auction Markets
  /** CardContainers where one can buy a Tile: auctionTN & mktConts - houseMkt */
  tileMkts: CardContainer[]; // concat(mktConts-houses, auctionTN) (suitable for drop-Debt)
  /** All buyable CardContainers */
  allMkts: CardContainer[]; // mktConts+auctionTN (suitable for startBuy/stopBuy)
  /** HouseTokens in slots of this CardContainer */
  houseMkt: HouseMktCont;
  margin: number = 10;
  upscale: number = 1.5;
  mainMap: MainMap;
  hexMap = new HexMap();
  // get hexMap() { return this.mainMap; }
  chooseDir: ChooseDir;
  /** true before chooseStartPlayer. roundNumber == 0 */
  preGame: boolean = true;
  turnNumber: number = 0; // nth turn (turnCircle)
  roundNumber: number = 0; // nth full round of turns
  startPlayerNdx: number = -1; // Player chosen to start
  turnButton: TurnButton
  paramGUI: ParamGUI;
  /** network game client */
  cmClient: CmClient;

  turnLog = new TextLog('turnLog', 2);  // shows the last 2 start of turn lines
  textLog = new TextLog('textLog', TP.textLogLines); // show other interesting log strings.

  logTurn(line: string) {
    this.turnLog.log(line, 'table.logTurn'); // in top two lines
  }
  logText(line: string, from = '') {
    const text = this.textLog.log(`${this.gamePlay.turnNumber}: ${line}`, from || '***'); // scrolling lines below
    this.gamePlay.logWriter.writeLine(`// ${text}`);
    // JSON string, instead of JSON5 comment:
    // const text = this.textLog.log(`${this.gamePlay.turnNumber}: ${line}`, from); // scrolling lines below
    // this.gamePlay.logWriter.writeLine(`"${line}",`);
  }

  get effects(): Effects { return Effects.effects }

  /** Mark showing on this Table */
  curMark: SlotInfo;  //

  /** CardContainer by name for this table */
  ccRegistry: Record<string, CardContainer> = {}

  /** CmClient support: identify CardContainer by name */
  getCCbyName(name: string): CardContainer {
    return this.ccRegistry[name];
  }
  /** Multi-stage/multi-cmClient support: keep registry on Table. */
  registerCC(cc: CardContainer) {
    let name = cc.regName, ccid = cc.id, old = this.ccRegistry[name]
    if (!!this.ccRegistry[name]) console.warn(stime(this, ".registerCC: replace"), name, ccid, old, cc.id)
    this.ccRegistry[cc.regName] = cc
  }

  /**
   * execute code when network is being used:
   *
   * isReferee can return false or true, so application can proceed as networked or standalone.
   *
   * if notCurPlayer === undefined do NOTHING; if === true, use isCurPlayer
   *
   * If isReferee === undefined, treat same as notCurPlayer, return true.
   *
   * @param isCurPlayer invoked if cmClient is running curPlayer
   * @param notCurPlayer invoked if cmClient is NOT running curPlayer [true: use isCurPlayer()]
   * @param isReferee invoked if cmClient is running as Referee ((false | return false) then isNetworked->false)
   * @returns false if Table is running StandAlone (or referee...)
   */
  isNetworked(isCurPlayer?: (cmClient?: CmClient) => void,
    notCurPlayer?: true | ((cmClient?: CmClient) => void),
    isReferee?: false | ((refClient?: CmClient) => boolean)): boolean {
    if (!this.cmClient.wsOpen) return false    // this table running in standalone browser mode
    // if not specified, run referee like other player, but return true
    if (notCurPlayer === true) notCurPlayer = isCurPlayer
    if (isReferee === undefined)
      isReferee = (cmc) => { typeof(notCurPlayer) === 'function' && notCurPlayer(cmc); return true }
    if (this.cmClient.client_id === 0) {
      return (isReferee === false) ? false : isReferee(this.cmClient) // cmClient is running as Referee
    } else if (this.cmClient.player == this.curPlayer) {
      !!isCurPlayer && isCurPlayer(this.cmClient)   // cmClient is running the curPlayer
    } else {
      !!notCurPlayer && notCurPlayer(this.cmClient) // cmClient is not running curPlayer
    }
    return true   // this table isNetworked: has an Open cmClient
  }

  undoButton: DisplayObject;
  undoRecs: Undo = new Undo();
  undoTag: string = undefined;    // indicates that code block wants to hold the undoRec open until it emits matching close
  undoEnable(tag?: string) {
    if (!this.undoTag) this.undoTag = tag;
    this.undoRecs.enableUndo();
  }
  addUndoRec(obj: Object, name: string, value: any | Function = obj[name]) { this.undoRecs.addUndoRec(obj, name, value); }
  /** push undoRec[], open a new one */
  undoClose(tag?: string) {
    if (tag != this.undoTag) return
    this.undoTag = undefined     // or "pop the stack" of tags...
    this.undoRecs.closeUndo();
    if (this.undoRecs.length > 0) {
      this.dispatchEvent(new ValueEvent(S.undo, this.undoRecs.length));
      this.stage.update();
    }
  }
  /** fence: reset/remove all undo records, no new records. */
  undoDisable() {
    this.undoTag = undefined
    this.undoRecs.flushUndo();
    this.undoRecs.disableUndo();
    this.undoButton.visible = false;
    this.stage.update();
  }
  /** undo last undo block */
  undoIt() {
    let undoNdx = this.undoRecs.length -1;
    let popRec = this.undoRecs[undoNdx]
    // must copy undoRecs[] so it is stable in log:
    console.groupCollapsed(`undoIt-${undoNdx}`)
    console.log(stime(this, `.undoIt: undoRec[${undoNdx}] =`), (undoNdx >= 0) ? [].concat(popRec) : []);
    this.undoRecs.pop();
    this.dispatchEvent(new ValueEvent(S.undo, this.undoRecs.length));
    this.adjustAllRentsAndStats() // iff Tile to/from mainMap?
    this.stage.update();
    console.log(stime(this, `.undoIt: after[${undoNdx}] db =`), { db: Array.from(this.effects.dataRecs) });
    console.groupEnd()   // "undoIt-ndx"
  }
  /** @return true if undoIt() is in progress. */
  undoing(): boolean { return this.undoRecs.isUndoing; }
  makeUndoButton(disp: Container, x: number, y: number, fontSize: number = 50): DisplayObject {
    let table = this, text = "Undo ";
    let button = new ValueCounter("undo", text, "GREEN", fontSize);
    let valf = (ve: ValueEvent) => {
      button.parent.setChildIndex(button, button.parent.numChildren -1);
      button.visible = (ve.value as number > 0);
      return text + ve.value;
    };
    button.mouseEnabled = true;
    button.attachToContainer(disp, { x, y }, table, S.undo, valf);
    button.on(S.click, table.undoButtonClicked, table)[S.Aname] = "undoIt";
    table.on(S.turn, table.undoDisable, table)[S.Aname] = "stopUndo";
    return button;
  }

  undoButtonClicked() {
    if (this.isNetworked((cmClient) => {
      cmClient.undoButtonClicked()
    })) return
    //console.log(stime(this,`.undoButton`))
    this.undoIt()
  }
  /** hold the table.on listener for preGameCheck */
  checkDistStacked: Function = () =>{}
  allPlayers: Player[] = [];
  getNumPlayers(): number { return this.allPlayers.length; }
  curPlayerNdx: number = 0;
  curPlayer: Player;
  /** Places you can drop to implement a Policy: table.policySlots.concat(eachPlayer.plyrPolis) */
  allPolicy: CardContainer[] = [];

  /** Make all the Player containers and their contents for each player.
   * wire the auction and market containers to Buy and Build the cards.
   * @param table Table to be used
   * @param playersCont location & container for all the player mats
   * @param numPlayers how many players in total to create.
   */
  makeAllPlayers(table: Table, playersCont: ContainerAt, numPlayers = 2): Player[] {
    table.allPolicy = []
    table.allPlayers = []
    table.curPlayerNdx = 0

    table.allPolicy.push(table.policySlots);
    let mar = table.margin;
    let mainMap = table.mainMap;
    let dirWH = { width: table.dirCards[0].width, height: table.dirCards[0].height };
    let dirCards = table.makeCardCont(playersCont, table.dirCards, // stack the cards
      {
        name: "dirCards", x: 0, xl: 1, y: 0, shuffle: true, backClick: false,
        counter: { color: "lightblue", offset: { x: -dirWH.width / 2 + 20, y: dirWH.height / 2 + mar } }
      });
    let dirDiscard = table.makeCardCont(playersCont, dirCards.cardSize, { name: "dirDiscard", x: dirCards.leftEdge(), y: dirCards.bottomEdge(mar) });
    function makeAndInitPlayer(color: string, ndx: number): Player {
      let player = new Player(table, color, dirCards, dirDiscard);
      return player.initializePlayer(playersCont, ndx);
    }
    let allPlayers = TP.playerColors.slice(0, numPlayers).map(makeAndInitPlayer, table);
    playersCont.setChildIndex(dirDiscard, 0);
    playersCont.setChildIndex(dirCards, 0);
    // Players and plyrConts are made, now wire them up to the Game:

    return allPlayers;
  }
  forEachPlayerInTurn(f: (p:Player) => void) {
    let np = this.allPlayers.length
    for (let n = 0; n < np; n++) {
      let ndx = (n + this.curPlayerNdx) % np
      f(this.allPlayers[ndx])
    }
  }
  forEachPlayer(f: (p:Player, index?: number, players?: Player[]) => void) {
    this.allPlayers.forEach((p, index, players) => f(p, index, players));
  }

  /** establish a few extra Listeners for game/gui features */
  extraStuff() {
    let table = this, mainMap = table.mainMap
    let gplay = table.gamePlay

    /** mainMap.on(S.moved) before mainMapDropped.
     * put S.Housing Card back to bottom of Stack, below any HouseToken
     */
    let fixHousingStack = (ce: CardEvent) => {
      // drop does: cc.addCard(card); including putCardOnStack(): stack.push(card)
      // self-drop (moveCardToOrigSlot) drops S.Housing card on top of stack (cont.addCard)
      // calcHousingRentVp sets Rent/VP on stack[0]
      // so we keep S.Housing at bottom of stack, and bottom of display list
      if (!ce.card || !(ce.card.type == S.house || ce.card.name == S.Housing))
        return; // nothing to do here, move along...
      let {cont, row, col} = ce, stack = cont.getStack(row, col);
      if (stack.length <= 1) return // nothing to rearrange
      // find and move the S.Housing card to stack[0]
      let ndx = stack.findIndex(c => c && c.name == S.Housing);
      let housing = stack[ndx];
      let rmd = stack.splice(ndx, 1); // remove from ndx [probably end of stack]
      stack.unshift(housing);         // shift into stack[0] = housing
      housing.visible = true
      if (!stack[0] || stack[0].name != S.Housing) {
        alert("table.fixHousingStack: stack wrong: " + stack[0])
        console.warn(stime(this, ".fixHousingStack"), "stack[0] = ", stack[0], stack); // OMG... something broken!
      }
      let token = stack.find(c => (c instanceof HouseToken)) as HouseToken // stack[1]
      if (!!token) token.calcHousingRentVp(stack, ce)
      ce.cont.stage.update();
    }

    table.mainMap.on(S.dropped, gplay.payBuildCost, gplay)[S.Aname] = "payBuildCost";
    table.mainMap.on(S.moved, fixHousingStack, this); // when HouseToken is moved onto S.Housing (or self-drop S.Housing)
    table.mainMap.on(S.dragStart, gplay.maybeSellTile, gplay)[S.Aname] = "maybeSellProperty"

    /** un-auctioned Gov card: no buy cost, build direct to mainMap */
    let discardP_checkDrag = (ce: CardEvent) => {
      if (ce.card[S.disc_by] == table.curPlayer) {
        table.discardP.setDropTargets();        // disableBuy
      } else {
        table.discardP.setDropTargets(mainMap); // enableBuy
        table.gamePlay.configBuildGov(ce);
      }
    };
    table.discardP.on(S.dragStart, discardP_checkDrag, table);
  }
  adjustStatsForCard(plyr: Player, card: Card, silent = false) {
    this.effects.pushLogUpdateField(false)
    // update all Card values, to account for new Tile configuration:
    let stepAdjust = this.gamePlay.adjustedStep(card, plyr);
    let stopAdjust = this.gamePlay.adjustedStop(card, plyr);
    let rentAdjust = this.gamePlay.adjustedRent(card, plyr);
    this.effects.popLogUpdateField()
    let negDist = findFieldValue(card, "props" , "onStep", [null, "when", "else"], "dist", "add")
    if (negDist >= 0) negDist = 0 // rare? never? (Roads: {add: 1})
    // ignore [for now] onMove: {dist: {add: -n}} on Tiles & Policy;
    // for Policy: check isSpecificPlayer; add to totalNegDist
    // for Tile: compute ratio of (nCardNegOnMove/totalCards)*negOnMoveDist add to totalNegDist
    // attribute cost (stop/rent/VP) of this Card to each Player:
    plyr.stats.adjustStats(card, stopAdjust, !!card[S.noRent] ? 0 : rentAdjust, negDist);
    if (silent) return
    if (plyr != this.curPlayer) return
    if (stopAdjust != card.stop && !card.noStop && !card.stopCounter) card.makeStopCounter();
    if (!!card.stopCounter) card.stopCounter.setValue(stopAdjust);
    if (!!card.rentCounter) card.rentCounter.setValue(rentAdjust);
    if (!!card.vpCounter) card.vpCounter.setValue(card.vp); // no 'vpAdjust'; totalVP === card.vp
  }
  /**
   * have added/removed ce.card or asserted/removed effects of a Policy
   * (which may change cost, rent, wages, range, etc)
   *
   * reads adjustedRent, adjustedStop, adjustedRange
   *
   * table.mainMap.forAllStacks: update stop, rent, VP
   * for each Player, update player-stats
   */
  adjustAllRentsAndStats(card0?: Card, silent: boolean = false) {
    if (!!card0) {
        // if cardProps has (vp n) OR (vp (set value)) then provide makeVPCounter for numeric value
      if (!card0.vpCounter && !!card0.props && (Object.keys(card0.props).includes("vp")))
        card0.makeVPCounter(C.vpWhite);
      if (!card0.noStop && !card0.rentCounter)
        card0.makeRentCounter();   // all [most] cards subject to rentAdjust
    }
    if (!this.stage.canvas) silent = true             // minor optimization: referee!
    silent || console.groupCollapsed("RentsAndStats") // until console.groupEnd()
    this.forEachPlayer(p => p.stats.initZero())
    this.mainMap.forAllStacks((row, col, stack: Stack) => {
      let card: Card = stack[0]
      if (!!card) {
        // ensure Housing is correctly marked:
        if (card.name == S.Housing && stack[1] instanceof HouseToken) { (stack[1] as HouseToken).calcHousingRentVp(stack) }
        this.forEachPlayer(p => {
          this.adjustStatsForCard(p, card, silent)
          try {
            let onStatsName = !!card.props && card.props["onStats"] // eg: "showAirportStats"
            if (!!onStatsName && !silent) {     // for now assume onStats is for GUI feedback.
              this.effects[onStatsName](card, row, col, stack)
            }
          } catch (err) { silent || console.groupEnd(); console.error(stime(this, " onStats failed:"), err) }
        })
      }
    })
    this.forEachPlayer(p => {
      p.dispatchEvent("calcPayment", false) // provoke DebtContainer to inject debtPayment into p.stats
      p.stats.calcEV();
      let rangeAdjust = this.gamePlay.adjustedRange(p);  // adjust Player range for new configuation
      if (silent) return
      p.stats.show(": Table.rents and")
      // find each counter and update it:
      p.dispatchEvent(new ValueEvent("stats-assets", p.stats.assets))
      p.dispatchEvent(new ValueEvent("stats-range", rangeAdjust))
      p.dispatchEvent(new ValueEvent("stats-own", p.stats.numCards))
      p.dispatchEvent(new ValueEvent("stats-EV", p.stats.EV))
      p.dispatchEvent(new ValueEvent("stats-VP", p.stats.totalVP))
    })
    silent || console.groupEnd()  // "RentsAndStats"
  }

  /** Indicates that plyr is the curPlayer. */
  putButtonOnPlayer(plyr: Player) {
    let color = plyr.rgbColor, turnButton = this.turnButton
    this.isNetworked(() => { }, () => {
      if (!this.preGame || plyr.distArrangerDone) {
        color = "grey"
        plyr.distArranger.unload(false)  // the remote player will do their thing
      }
    })
    turnButton.render(color)
    plyr.putButtonOnPlayer(turnButton)
  }
  /**
   * @param round 0->0 resources; 1->1 Build, 2 -> 1 of each resource
   */
  setResources(player: Player, round: number) {
    let value = (round > 1) ? 1 : 0
    player.builds = (round > 0) ? 1 : 0
    player.moves = player.draws = player.polis = player.buys = value; // updates Counters!
    player.drawN = value; // expect only 1 flip per draw (maybe not used... see drawAnother)
    player.drawn = 0; // - how many drawn so far
    player.rangeAdjustTurn = 0
  }


  /** trigger "untilTurnEnd", removing Until records
   * zero resource counters
   */
  endCurPlayer(player: Player) {
    let recs = this.effects.removeUntilRecords(player, S.untilTurnEnd);
    if (!!recs && recs.length > 0)
      console.log(stime(this, ".endCurPlayer: removed 'turnEnd' records="), recs)
    if (!!player) {
      player.distArranger.unload()
      this.setResources(player, 0); // end-of-turn: resources do not carry over
      player.indicateDebtStatus() // end-of-turn debt status
    }
  }
  /**
   * Finish with curPlayer, advance curPlayer to next Player.
   *
   * set curPlayer = allPlayers[++curPlayerNdx]
   * move button to curPlayer
   *
   * set this.roundNumber based on this.turnNumber++;
   *
   * @param ndx positive to set curPlayerNdx; negative [default] to step modulo allPlayer.length;
   * @return true if preGame && some player is still waitingToArrange
   */
  setNextPlayer(ndx: number = -1): boolean {
    ValueEvent.dispatchValueEvent(this, S.turnOver, this.turnNumber);

    // this.endCurPlayer(this.curPlayer);
    // preGame: startPlayerNdx == -1 (until chooseStartPlayer sets)
    // inGame: curPlayerNdx = (startPlayerNdx + turnNumber) mod nPlayers

    if (ndx < 0) ndx = (this.curPlayer.index + 1) % this.allPlayers.length;
    if (ndx != this.curPlayerNdx) this.endCurPlayer(this.curPlayer)
    this.curPlayerNdx = ndx;
    let curPlayer = this.curPlayer = this.allPlayers[ndx];
    console.log(stime(this, `.setNextPlayer ---------------`), { round: this.roundNumber, turn: this.turnNumber+1, plyr: curPlayer.name }, '-------------------------------------------------', !!this.stage.canvas, this.preGame?"preGame":"");
    this.putButtonOnPlayer(curPlayer);

    let preGameWaiting = this.preGame && this.waitingToArrange(curPlayer)
    if (preGameWaiting) {
      curPlayer.distArranger.load() // Easy reminder to choose distances
    }
    // preGame, roundNumber stays at 0, turnNumber selects each player (until all plyrDistDone)
    // !preGame: roundNumber == 1 is when players place Home card
    // !preGame: roundNumber > 1 is normal play
    this.turnNumber += 1;
    if (!this.preGame) { // when back to starting Player (turnNumber % allPlayers.length)
      this.roundNumber = Math.floor((this.turnNumber - 1) / this.allPlayers.length) + 1
      this.adjustAllRentsAndStats()    // show rents/stops for curPlayer [esp: Policy.isSpecificPlayer]
      this.setResources(curPlayer, this.roundNumber);  // new Turn: get 1 of each resource
      if (curPlayer.homeCard.parent == this.mainMap) {
        this.mainMap.markLegalPlacements(undefined, curPlayer) // show Range, zero buy cost
        this.gamePlay.offerBuyTile(curPlayer.onCard(), curPlayer)   // implicit 'onTurnStart' effect
      }
      this.effects.doEffectsOnCard(S.onTurnStart, null, curPlayer); // Do related effects
    } else {
      this.setResources(curPlayer, 0);          // preGame Turn: depends on Round
    }
    // finally: update round Counter, service debt, stopUndo,
    ValueEvent.dispatchValueEvent(this, S.turn, this.turnNumber);
    this.stage.update();
    curPlayer.robo.notify(this, S.actionEnable) // setNextPlayer
    return preGameWaiting
  }
    /** return true if this table is waiting for player to unload distArranger. */
  waitingToArrange(plyr: Player): boolean {
    // waiting if NOT ready.
    // ready if: plyr.distArrangerDone OR plyr is remote.
    // player is remote if: using network && not controlled by local CmClient:
    return !(plyr.distArrangerDone || (this.isNetworked() && this.cmClient.player != plyr))
  }

  /** turnButtonClicked: indicates end-of-turn for curPlayer: check & then setNextPlayer() */
  turnButtonClicked(event?: Event) {
    if (this.roundNumber == 1 && this.curPlayer.homeCard.parent !== this.mainMap) return
    if (this.turnButton.blocked) return  // redundant?: no mouseevent if blocked
    if (!!this.auctionP0.bottomCardOfStack()) return  // must dispose of P0 before end of turn
    if (this.isNetworked((cmClient) => {
        cmClient.turnButtonClicked()
    })) return
    this.setNextPlayer()
  }

  makeTurnButton(): TurnButton {
    let turnButton = new TurnButton(50)
    CC.dragger.notDragable(turnButton)
    turnButton.name = "turnButton"

    /** when all plyrReady, remove pre-Game Listeners, and run table.chooseStartPlayer() */
    let table = this
    let preGameCheck = () => { // NOT an 'on' listener; do not rely on 'this'
      table.curPlayer.distArranger.unload();  // as if: onPlyrDistClicked (try accelerate the start up)
      if (!table.allPlayers.find(plyr => this.waitingToArrange(plyr))) {
        table.undoDisable()    // pro-forma: end of preGame & distArranger
        turnButton.removeEventListener(S.click, preGameCheck)
        turnButton.on(S.click, table.turnButtonClicked, table)
        if (!this.isNetworked()) {
          table.preGame = false;
          table.turnNumber = 0; table.roundNumber = 1;
          table.chooseStartPlayer().then((ndx) => {
            table.setNextPlayer(table.startPlayerNdx = ndx)
            table.stage.update()
          })
          // Start Game now (preGame==true, to suppress nextDirection)
          return
        } else {
          // fall through: this.turnButtonClicked calls this.cmClient.turnButtonClicked()
          // which will send_next(params) to CmReferee to chooseStartPlayer
          console.log(stime(this, `.makeTurnbutton.preGameCheck`))
        }
      }
      this.turnButtonClicked()
    }
    turnButton.addEventListener(S.click, preGameCheck)
    return turnButton
  }

  /** all the non-map hexes created by newHex2 */
  newHexes: Hex2[] = [];
  newHex2(row = 0, col = 0, name: string, claz: Constructor<Hex2> = Hex2, sy = 0) {
    const hex = new claz(this.hexMap, row, col, name);
    hex.distText.text = name;
    if (row <= 0) {
      hex.y += (sy + row * .5 - .75) * (this.hexMap.radius);
    }
    this.newHexes.push(hex);
    return hex
  }

  initialize() {
    this.preGame = true;
    this.turnNumber = 0; // nth turn (turnCircle)
    this.roundNumber = 0; // nth full round of turns
    this.startPlayerNdx = -1; // Player chosen to start
  }

  /** Layout all the CardContainers */
  layoutTable() {
    this.initialize()
    let table = this, gplay = table.gamePlay
    let mar = this.margin
    let scaleC = this.scaleCont
    /** CC.localToLocal(x,y,scaleC) */
    let basePt = (cc: Container, x: number, y: number): Point => cc.localToLocal(x, y, scaleC);
    // tileCont/tileDeck to right of (0,0); policyCont/policyDeck to left of (0,0)
    let tileCont = this.makeContainerAt("tileCont", scaleC, new Point(0, 0));
    let tileDeck = table.tileDeck = this.makeCardCont(tileCont, table.tileCards, { name: "tileDeck", x: 0, y: 0 });
    let policyCont = this.makeContainerAt("policyCont", scaleC, new Point(0, 0));
    let policyDeck = table.policyDeck = this.makeCardCont(policyCont, this.policyCards, { name: "policyDeck", x: -mar, y: 0, xl: 1 });
    // this.showStack(this.policyCards, "policyCards", policyDeck)
    // Using tileDeck & policyDeck to get card WH in portrait & landscape orientation:
    let landscape: WH = policyDeck.cardSize;
    let portrait: WH = tileDeck.cardSize;
    let square: WH = { width: landscape.width, height: landscape.width };
    let landscape_slot: WH = {} = policyDeck.slotSize;
    let portrait_slot: WH = {} = tileDeck.slotSize;
    // policySlots below policyDeck:
    let policySlots = this.policySlots = this.makeCardCont(policyCont, policyDeck.cardSize,
      { name: "policySlots", x: policyDeck.leftEdge(), y: policyDeck.bottomEdge(mar), slotsY: 2,
      color: C.policySlots, counter: false, dropOnCard: true });
    // auctionCont to right of tileDeck:
    this.gamePlay.makeBuyCostTargetMark(policySlots)
    let auctionCont = this.makeContainerAt("auctionCont", scaleC, basePt(tileDeck, tileDeck.rightEdge(mar), 0));
    /** makeCardCont on the auctionCont: auctionP0, auctionTN, discardP, discardT */
    let makeAuction = (name: string, x: number, slotsX: number, opts: {
      color?: string;
      counter?: (boolean | {});
      size?: WH;
      dropOnCard?: boolean | ((ce: CardEvent) => boolean);
    } = {}) => {
      let { color = undefined, counter = false, size = square, dropOnCard = undefined } = opts;
      let bg = !!color;
      return this.makeCardCont(auctionCont, size, { name: name, x: x, y: 0, slotsX: slotsX, color: color, bg: bg, counter: counter, dropOnCard: dropOnCard });
    };
    table.auctionP0 = makeAuction("auctionP0", tileDeck.leftEdge(mar, 5.5), 1, { dropOnCard: true }); // no-cost Policy/Event
    table.auctionTN = makeAuction("auctionTN", 0, TP.auctionSlots, { color: "rgba(180,230,180, .3)" });
    table.discardP = makeAuction("discardP", table.auctionTN.rightEdge(mar), 1);
    table.discardT = makeAuction("discardT", table.auctionTN.rightEdge(mar, 1), 1, { color: "rgba(120,230,120,.6)", counter: { color: "lightblue" }, size: portrait, dropOnCard: true });
    auctionCont.addChildAt(table.auctionTN, table.auctionP0)  // TN below P0
    auctionCont.addChildAt(table.discardT, table.discardP)    // discT below discP
    // discardT is not strongly part of the "auction"
    let colCosts: number[] = [3, 2, 1, 0, -1, -1, -2].slice(7 - TP.auctionSlots); // 7=baseArray.length
    this.attachAuctionPrices(colCosts, { color: C.coinGold, fontSize: 16 });
    let mainCont = this.makeContainerAt("mainCont", scaleC, basePt(tileDeck, tileDeck.leftEdge(), tileDeck.bottomEdge(mar, .25)));
    let mainMap = table.mainMap = this.makeCardCont(mainCont, tileDeck.cardSize, { clazz: MainMap, name: "mainMap", x: 0, y: 0, slotsX: TP.mapCols, slotsY: TP.mapRows, counter: false, dropOnCard: false });
    mainMap.table = this
    let scpt = basePt(tileDeck, tileDeck.leftEdge() + tileDeck.slotSize.width / 2, (tileDeck.bottomEdge() + tileDeck.bottomEdge(mar, .25)) / 2);
    this.makeScaleCounter(scaleC, scpt.x, scpt.y);
    this.chooseDir = new ChooseDir(this)

    // align so mkt0Cont is below policySlots! [down 3 landscapes, up 2 portraits]
    let mx = -3 * (portrait_slot.width + mar);
    let my = -2 * (portrait_slot.height + mar) + policyDeck.bottomEdge(2 * mar, 2);
    let marketCont = this.makeContainerAt("marketCont", scaleC, basePt(policyDeck, mx, my));
    this.makeMarkets(marketCont, tileDeck, portrait);
    scaleC.setChildIndex(auctionCont, scaleC.numChildren -1) // above mainCont & marketCont

    // allMkts includes houseMkt, includes auctionTN
    this.allMkts = this.mktConts.concat(this.auctionTN);
    // tileMkts excludes houseMkt, includes auctionTN
    this.tileMkts = this.allMkts.filter(cont => cont.name != "houseMkt");

    // The Card indicating the wrap/rotation: [ RR RR RR RR ] or [ RL RL RL RL ]
    let aCont = this.mktConts.find((mkt) => mkt.name == "mkt6Cont") // bottom row of market
    let p1 = { x: basePt(mainMap, mainMap.leftEdge(mar * 0), 0).x, y: basePt(aCont, 0, 0).y }
    let alignCont = this.makeContainerAt("alignCont", scaleC, p1);
    this.alignDeck = this.makeCardCont(alignCont, this.alignCards, { x: -mar, xl: 1, name: "alignCont" });
    this.mainMap.nextAlignmentCard(this.alignDeck);
    this.undoButton = this.makeUndoButton(alignCont, -100, 25, 45);

    let np = TP.numPlayers; // counting rows from bottom of mainMap
    // playersCont based at upper-right corner [from bottom-right of mainMap], expands to the left:
    let px = basePt(mainMap, mainMap.leftEdge(mar), 0)   // (mainMap.leftEdge(mar), 0).x
    let py = basePt(aCont, 0, aCont.slotSize.height+mar) // (0, aCont.bottomEdge(mar)).y
    let p0 = {x: px.x, y: py.y}; // room for 'np' Players
    let playersCont = this.makeContainerAt("playersCont", scaleC, p0);
    this.allPlayers = this.makeAllPlayers(this, playersCont, np);
    this.turnButton = this.makeTurnButton()
    this.extraStuff()

    /// ************** All Containers made ******************* ////////

    let locXY0: XY = { x: mainMap.leftEdge(mar, 1.2), y: mainMap.topEdge(mar, -2.48) };
    let locXY1: XY = { x: mainMap.leftEdge(mar, 1.2), y: mainMap.topEdge(mar, -2.75) };
    let roundCounter = new ValueCounter("roundCounter", 0, "lightgreen");
    roundCounter.attachToContainer(this.mainMap.overCont, locXY0, this, S.turn, ((ve: ValueEvent) => table.roundNumber));
    roundCounter.setLabel("round", undefined, 10);
    table.scaleCont.addUnscaled(roundCounter);

    let turnCounter = new ValueCounter("turnCounter", 0, "lightgreen");
    turnCounter.attachToContainer(this.mainMap.overCont, locXY1, this, S.turn, ((ve: ValueEvent) => {
      let plyr = table.curPlayer, turn = ve.value;
      let {name: player, coins, direction: dir, moveDir, playerMarker: pm} = plyr  // for logging turnCounter
      console.log(stime(this, ".turnCounter:"), { turn, player, coins, dir, moveDir }, pm.slotInfo, { db: Array.from(this.effects.dataRecs) });
      return ve.value;
    }));
    turnCounter.setLabel(S.turn, undefined, 10);
    table.scaleCont.addUnscaled(turnCounter);

    /** force some cards to topOfStack */
    let editStack = (deck: CardContainer, toTop: string[]) => {
      let fStack = deck.getStack(), tCards = new Stack()
      toTop.forEach(name => {
        let card = fStack.findCard(name);
        if (!card) {
          console.log(stime(this, ".editStack: did not find Card named:"), name);
        } else {
          tCards.unshift(card) // store in reverse order
        }
      })
      deck.stackCards(tCards) // put selected cards on top
    }

    // Assert: makeMarkets/setMarket put ALL the tileCards in discard!
    this.resetTileDeck() // leaving (any policyDeck cards) in discardT
    editStack(this.tileDeck, TP.topTileNames)
    editStack(this.policyDeck, TP.topPolicyNames)
    //console.log(stime(this, ".pStack:"), {pStack: pStack, policyStack: policyDeck.getStack()} )

    tileDeck.on(S.EmptyStack, (e: CardEvent) => {
      console.log(stime(this, "tileDeck.EmptyStack event="), e);
      this.resetTileDeck(true)
    })[S.Aname] = S.EmptyStack

    policyDeck.on(S.EmptyStack, (e: CardEvent) => {
      console.log(stime(this, "policyDeck.EmptyStack event="), e);
      this.resetTileDeck(false)
    })[S.Aname] = S.EmptyStack

    /** PolicySlots: existing card to discardT. */
    let moveRippleP = (ce: CardEvent) => { ce.cont.moveRipple(ce, table.dragToDiscard, "disc"); }; // replace policy
    /** AuctionTN: ripple card to discardT (unless S.Govern) */
    let moveRippleA = (ce: CardEvent) => { ce.cont.moveRipple(ce, discFunc, "col+"); }; // check for Government
    let discFunc = (card: Card) => {
      if (card.type === S.Govern && !onMainMap(card.name)) {
        card[S.disc_by] = table.curPlayer; // making this Player ineligble to build card from discardP
        table.discardP.addCard(card); // discardP (not actually discarded)
      } else {
        table.dragToDiscard(card); // ripple to discardT
      }
    };
    let onMainMap = (name: string): boolean => {
      return !!this.mainMap.forAllStacks((row, col, stack) => { return stack[0] && stack[0].name == name })
    }

    /** put c3 between c1 and c2 */
    let betweenXY = (c1: CardContainer, c2: CardContainer, c3: CardContainer): Point => {
      let pt1 = c1.parent.localToLocal(c1.rightEdge(), c1.topEdge(), scaleC);
      let pt2 = c2.parent.localToLocal(c2.leftEdge(), c2.bottomEdge(), scaleC);
      let ptC = scaleC.localToLocal((pt1.x + pt2.x) / 2, (pt1.y + pt2.y) / 2, c3.parent);
      c3.x = (ptC.x - (c3.slotSize.width * c3.scaleX / 2));
      c3.y = (ptC.y - (c3.slotSize.height * c3.scaleY / 2));
      return ptC;
    };
    this.scaleUp(table.discardP);
    betweenXY(table.auctionTN, table.discardT, table.discardP); // center *scaled* container

    this.scaleUp(table.auctionP0, 2.0);
    table.auctionP0.on(S.clicked, gplay.eventFromP0, gplay)[S.Aname]="eventFromP0"; // zero-cost action, DnD to likely dest
    table.auctionP0.on(S.dragStart, gplay.configBuyCost, gplay)[S.Aname]="configPlayerBuy"; // zero-cost buy, but must enable droptargets
    table.auctionP0.on(S.moved,   table.auctionP0.shrinkCards, table.auctionP0)[S.Aname] = "shrinkCards"; // iff doing double draw...
    table.auctionP0.on(S.dropped, table.auctionP0.shrinkCards, table.auctionP0)[S.Aname] = "shrinkCards";
    table.auctionP0.on(S.removed, table.auctionP0.shrinkCards, table.auctionP0)[S.Aname] = "shrinkCards";
    table.discardP.on(S.moved, table.discardP.shrinkCards, table.discardP)[S.Aname] = "shrinkCards";
    table.discardP.on(S.moved, (ce) => this.discardP.setDropTargets(mainMap), table.discardP)[S.Aname] = "setDropTarget";
    //this.discardP.setDropTargets(mainMap)       // Government Tiles (must be placed on mainMap, before next draw)

    table.auctionTN.on(S.moved, moveRippleA, table)[S.Aname] = "moveRippleA"; // ripple col+ to the discard
    table.discardT.on(S.moved, table.movedToDiscardT, table)[S.Aname] = "discardEventCard";
    table.discardT.setDropTargets(); // discardT not really dragable: but scaleUp and peek beneath...

    // QQQQ: subtype="Temp Policy" should not discard the overlaid Policy; because it is transient!?
    tileDeck.on(S.flipped, this.drawFlipped, table)[S.Aname] = "drawFlipped";
    policyDeck.on(S.flipped, this.drawFlipped, table)[S.Aname] = "drawFlipped";

    // GamePlay:
    this.allMkts.forEach(mkt => mkt.on(S.clicked, gplay.clickedOnMarket, gplay)[S.Aname] = "clickedOnMarket");
    this.allMkts.forEach(mkt => mkt.on(S.dragStart, gplay.configBuyCost, gplay)[S.Aname] = "configPlayerBuy");
    this.allMkts.forEach(mkt => mkt.on(S.dropped, gplay.clearMktBuyCost, gplay)[S.Aname] = "clearBuyCost");
    this.policySlots.on(S.moved, moveRippleP, table)[S.Aname] = "moveRippleP"; // discard prior card
    this.policySlots.on(S.dropped, gplay.payBuyCost, gplay)[S.Aname] = "payBuyCost";           // pub Policy: configBuyCost from auction
    this.mainMap.on(S.dropped, gplay.checkRoadRotation, gplay)[S.Aname] = "checkRoadRotation"; // rotate Road cards by dropping in place.
  }
  /** to Draw: must have draws>0 and no Card(s) in auctionP0 and discardP */
  drawBlocked(): boolean {
    if (this.curPlayer.draws <= 0) return true;
    // Note: only 1 player can push a [gov] Card onto discardP;
    // another Player must place that card before *anyone* can draw
    if (this.discardP.bottomCardOfStack()) return true
    if (!!this.auctionP0.bottomCardOfStack()) return true; // TODO: consider this wrt "Draw Another" (nDraw)
    return false;
  };
  /**
   * Handle S.flipped event: Draw Policy/Event/Tile from Policy or Tile deck.
   *
   * Event: auctionTN (if cost) OR auctionP0 (if no cost) :: autoEvent -> Discard to activate
   * Policy: auctionP0 ... drag to plyrPolis or policySlots
   * Tile: if Gov/Taxes -> DoPolicyNow, else moveCardToSlot auctionTN (and let it ripple)
   * @param ce CardEvent holding the newly flipped Tile/Policy card
   */
  drawFlipped(ce: CardEvent) { S.flipped; // table.drawFlipped(ce: CardEvent)
    // auto-draw multiple cards on single draw action; distinct from drawN which allows mulitple draw actions
    let drawAnother = (): boolean => {
      let player = this.curPlayer;
      let toDraw = this.gamePlay.adjustedDrawN(player, -player.drawn); // 0, 1, maybe 2!
      if (toDraw > 0)
        return true;
      player.drawn = 0; // reset, will need new click/flip/draw to start again
      return false;
    };
    if (this.drawBlocked()) {
      // UNFLIP (cover with back):
      ce.cont.back.setChildIndex(ce.cont.back, ce.cont.numChildren -1)
      ce.stopImmediatePropagation();
      this.stage.update();
      this.curPlayer.robo.notify(this, S.drawBlocked) // drawFlipped - drawBlocked
      return;
    }
    // if (drawAnother()) {
    //   ce.cont.clickedOnStack() // initiate another flip
    // // ce.cont.topCardOfStack()
    // }
    if (this.curPlayer.isMoving()) {
      // we should not be here, player is ACTIVE, moving...
      let clid = this.cmClient.cgbase ? `cmc=${this.cmClient.client_id}` : `plyr=${this.curPlayer.name}`
      try { alert(`!? S.flipped while moving: ${clid}`)} catch {}
      //this.curPlayer.setMoveRecDone(true)// ASSERT if user is clicking, they are not MOVING
      //return; // time goes by... expect move is done soon?
    }

    // OR: we could undoEnable() and undoClose() during play-testing...
    // "undo" includes all the ripple/discard actions...
    this.undoDisable(); // drawFlipped and all priors are not undoable!
    this.curPlayer.draws -= 1;

    // Drawing a card causes all latent "Deferred" events to be discarded from playerProjs.
    // although the GUI blocks "Counter->Draw" whenever there is a Deferred in playerProjs...
    let discardIfDeferred = (card: Card) => {
      if (card.type == S.Deferred) {
        card.table.dragToDiscard(card) // discardIfDeferred (activateOnDiscard(plyrProj=true))
      }
    };
    if (TP.discardDeferred) this.curPlayer.plyrProjs.getStack().forEach(discardIfDeferred);
    // the only 'onDraw' effect is above: discard any DeferredEvent in plyrProj
    //this.effects.doEffectsOnCard(S.onDraw, ce.card, this.curPlayer);
    //this.effects.doEffectsOnCard(S.onDraw, this.curPlayer.onCard(), this.curPlayer);
    // "Draw Another" mentions 'untilDraws' but has not been tried/tested/fully-implemented
    this.effects.removeUntilRecords(this.curPlayer, S.untilDraws);

    let card = ce.card;
    let type = card.type;
    let cost = card.costn;
    console.log(stime(this, ".drawFlipped:"), { card: card.name, type: card.type }, card);
    // if (cost > 0) type: S.Future_Event, S.Temp_Policy, Tile (Property, Road, Government, etc)
    // place on auctionTN for later Buy
    switch (type) {
      // Event & Future_Event are basically the same; but Event will be auto-discarded
      // the effect happens immediately, and then user can discard it...
      case S.Future_Event:
        // assert: (cost > 0)
        this.auctionTN.addCard(card); // onBuy: move to plyrProjs for storage
        break;
      case S.Event:
        // assert (cost == 0)
        // All player can do is Discard it, and invoke the Effects.
        this.auctionP0.addCard(card);
        this.auctionP0.setDropTargets(this.discardT); // artifical auctionP0.on(S.dragStart)
        // auto Discard Event if TP.autoEvent holds a timeout value
        if ((typeof(TP.autoEvent) == "number" && TP.autoEvent > 0) || TP.autoEvent === true ) {
          let discardIt = (card: Card) => {
            if (!card.getSlotInfo()) return; // user holding card on dragCont
            this.dragToDiscard(ce.card)      // auto-discard and invoke the effects
          }
          if (TP.autoEvent === true) discardIt(card) // do not break the Thread
          else setTimeout(discardIt, TP.autoEvent, card) // ok to break...
          // in either case, robo.notify(S.drawDone) will queue until auctionP0 is empty
        }
        break;
      case S.Deferred:
        // assert (cost == 0)
        // Either move to plyrProjs (activate later with Discard), or move to discardT without effects
        this.auctionP0.addCard(ce.card);
        this.auctionP0.setDropTargets(this.curPlayer.plyrProjs, this.discardT);
        break;
      case S.Temp_Policy:
        // assert (cost == 0)
        this.auctionP0.addCard(card);
        this.auctionP0.setDropTargets(this.curPlayer.plyrPolis, this.policySlots); // AS OVERLAY!, not ripple
        break;
      case S.Policy:
        if (cost > 0) {
          this.auctionTN.addCard(card); // replace a Policy when/if bought
        } else {
          this.auctionP0.addCard(card);
          // should include plyrProjs? (cost a policy action now, and a policy action to enable)
          // targets are recalculated by GamePlay.enableBuy!
          this.auctionP0.setDropTargets(this.curPlayer.plyrPolis, this.policySlots); // choose which Policy to replace.
        }
        break;
      default: // Tile: Property, Road, Government, etc
        //console.log(stime(this, ".flipped: default to auctionTN"), card.name, card)
        this.auctionTN.addCard(card);
    }
    this.curPlayer.robo.notify(this, S.drawDone)  // drawFlipped: auctionTN|auctionP0
    return
  }
  /** make a Container (for CardContainers and Counters) with an overCont.
   * @parent typically the ScaleableContainer
  */
  makeContainerAt(name: string, parent: Container, pt: XY): ContainerAt {
    let contAt = new ContainerAt();
    parent.addChild(contAt);
    contAt.x = pt.x;
    contAt.y = pt.y;
    contAt.name = name;
    // put overCont on Container for CardContainer (so floats above all the CardContainers)
    let overCont = new Container();
    overCont.name = name + ":overCont";
    contAt.addChild(overCont);
    overCont.x = overCont.y = 0;
    contAt.overCont = overCont;         // see also: ContainerAt.constructor; can supply existing overCont...
    //console.log(stime(this, ".makeContainerAt: contAt="), contAt.name, "overCont=", overCont.name)
    return contAt;
  }

  /**
   * Turn a Dist card from each player, low card goes first.
   * If tie, those players flip another card...
   * When games starts, the Player's FIRST DIST is the last flipped distance card.
   *
   * This is invoked either in standalone GUI, *OR* by the CmReferee, so always uses localNextDistance!

   * @param getNextDist flip and show next distCard of Player (override supplied by CmReferee)
   * @param loopPromise<T> wait for Promise to fullfil before continuing each iteration; default: TP.flipDwell
   * @return Promise\<startPlayerNdx>
   */
  chooseStartPlayer<T>(
    getNextDist: (plyr: Player) => number = (plyr) => plyr.localNextDistance(undefined, true),
    loopPromise?: () => Promise<T>): Promise<number> {
    loopPromise = loopPromise || (() => F.timedPromise<T>(minDistPlyrs.length * TP.flipDwell))
    let minDist: number, minDistPlyrs: Player[] = this.allPlayers, distCards:{}[];
    /** flip and show dist card, do not move. */
    let flipDist = (plyr: Player) => {
      let dist = getNextDist(plyr); // just flip & show; no direction, no move.
      if (dist < minDist) {
        minDistPlyrs = [plyr];        // reset minDistPlyrs
        minDist = dist;
      } else if (dist == minDist) {
        minDistPlyrs.push(plyr);      // extend minDistPlyrs
      }
      distCards.push({plyr: plyr.name, dist: dist})
      return dist
    };
    /** each player still in the auction flips a card */
    let showNextDist = (plyrs: Player[]) => {
      minDist = 7; distCards = []
      plyrs.forEach(plyr => flipDist(plyr));
      console.log(stime(this, ".chooseStartPlayer"), { minDist, plyrs: minDistPlyrs, distCards });
    };

    let pNdx = new EzPromise<number>()
    let doMore = (): boolean => {
      return (minDistPlyrs.length > 1) ? true : (pNdx.fulfill(minDistPlyrs[0].index) && false)
    }
    let actionP = () => {
      showNextDist(minDistPlyrs) // flip(RED); flip(BLUE)
      return loopPromise()       // wait for (BLUE)
    }
    whileP<T>(doMore, actionP)

    // Start Game with Player = minDistPlayrs[0]:
    return pNdx
  }

  /** change cont.scale to given scale value. */
  scaleUp(cont: Container, scale = this.upscale) {
    cont.scaleX = cont.scaleY = scale;
  }
  makeMarkets(marketCont: ContainerAt, tileDeck: CardContainer, cardSize: WH) {
    let makeMkt = (name: string, cards: Card[] | WH, x: number, y: number): CardContainer => {
      return this.makeCardCont(marketCont, cards as Stack, { name: name, backCard: false, x: x, y: y, dropOnCard: true });
    };
    let portrait = cardSize, mar = this.margin;
    let tileStack = tileDeck.getStack();
    let { c1, c2, c3, c4, c5, c6 } = TP.stableCardNames;
    let fin1Cards = tileStack.findCards(c1, true);  // true just to avoid filter in reverse...
    let fin2Cards = tileStack.findCards(c2, true);
    let fin3Cards = tileStack.findCards(c3, true);
    let ind1Cards = tileStack.findCards(c4, true);
    let ind2Cards = tileStack.findCards(c5, true);
    let ind3Cards = tileStack.findCards(c6, true);
    let housing = this.tileCards.findCards(S.Housing, true);
    let fin1Cont = makeMkt("fin1Cont", fin1Cards, 0, 0);
    let fin2Cont = makeMkt("fin2Cont", fin2Cards, fin1Cont.rightEdge(mar), 0);
    let fin3Cont = makeMkt("fin3Cont", fin3Cards, fin2Cont.rightEdge(mar), 0);
    let ind1Cont = makeMkt("ind1Cont", ind1Cards, fin1Cont.x, fin1Cont.bottomEdge(mar));
    let ind2Cont = makeMkt("ind2Cont", ind2Cards, fin2Cont.x, fin2Cont.bottomEdge(mar));
    let ind3Cont = makeMkt("ind3Cont", ind3Cards, fin3Cont.x, fin3Cont.bottomEdge(mar));
    let mkt0Cont = makeMkt("mkt0Cont", housing, ind3Cont.rightEdge(0, .1), ind3Cont.bottomEdge(mar));
    let mkt1Cont = makeMkt("mkt1Cont", portrait, fin1Cont.x, ind1Cont.bottomEdge(mar));
    let mkt2Cont = makeMkt("mkt2Cont", portrait, fin2Cont.x, ind2Cont.bottomEdge(mar));
    let mkt3Cont = makeMkt("mkt3Cont", portrait, fin3Cont.x, ind3Cont.bottomEdge(mar));
    let mkt5Cont = makeMkt("mkt5Cont", portrait, fin1Cont.x, mkt1Cont.bottomEdge(mar));
    let mkt6Cont = makeMkt("mkt6Cont", portrait, fin2Cont.x, mkt2Cont.bottomEdge(mar));
    let mkt7Cont = makeMkt("mkt7Cont", portrait, fin3Cont.x, mkt3Cont.bottomEdge(mar));
    let mktHouse = this.makeHousesCont(marketCont, portrait, mkt0Cont.rightEdge(mar), mkt0Cont.topEdge());
    this.houseMkt = mktHouse
    // filter out the Counters, background, etc:
    this.mktConts = marketCont.children.filter((c: DisplayObject) => c instanceof CardContainer) as CardContainer[];
    this.setMarket(TP.marketTileNames, this.discardT, mkt1Cont, mkt2Cont, mkt3Cont, mkt5Cont, mkt6Cont, mkt7Cont);
    // leavig all the cards in discard!
  }

  /** reset markets to align with Referee. */
  resetMarket(params: KVpair[]) {
    this.tileDeck.stackCards(this.discardT.getStack().slice())           // tileDeck.addCard(all the discard cards)
    let mkts = params.map(kvp => this.getCCbyName(kvp.name))
    mkts.forEach(mc => this.tileDeck.stackCards(mc.getStack().slice()))  // put prior market Cards on tileDeck
    this.stage.update()       // for step/debug
    let tileNames = params.map(kvp => kvp.value.value as string) // TP.marketTileNames
    this.setMarket(tileNames, this.discardT, ...mkts)
    this.resetTileDeck()
  }
  /** shuffle Tiles from discardT into TileDeck */
  resetTileDeck(doTiles = true, ) {
    if (doTiles ? TP.recycleTiles : TP.recyclePolis) {
      let deck = doTiles ? this.tileDeck : this.policyDeck
      let tiles = this.discardT.getStack().findCards((card: Card) => doTiles ? card.isTileStack() : card.isPolicyStack(), false)
      deck.stackCards(this.tileDeck.getStack().shuffle(tiles))
      this.discardT.dispatchCardEvent(S.removed, null, 0, 0, this.discardT) // update counter
    }
  }
  /**
   * draw cards from TileDeck,
   * placing new/unique ones on next empty market.
   * (or discard if no empty market slot)
   * placing repeats on existing market stack.
   *
   * Then reshuffle the discard back to TileDeck.
   * @param tileNames tiles to be specifically included in Market
   * @param discard where to put the cards not selected for the market(s)
   * @param mktN an array of Market CardContainers, to be filled with Cards from tilesStack
   */
  setMarket(tileNames: string[], discard: CardContainer, ...mktN: CardContainer[]): CardContainer[] {
    let tileStack = this.tileDeck.stackCards(this.tileDeck.getStack().shuffle()); // shuffle for setting Market
    let fullMkt: CardContainer[] = [];
    let emptyMkt: CardContainer[] = []; // use temp copies of each mktN:
    mktN.forEach(m => emptyMkt.push(new CardContainer(m.slotSize, {name: 'a'+m.name})))
    let useMkt: CardContainer;
    let logMkt: boolean = false
    let matchesFieldOfCard = (stack: Stack, field: string, value: string): boolean => {
      return stack[0] && (stack[0][field] == value);
    };
    // move an instance of each named card to head of forceCards
    let mrktCards = tileNames.reverse().map(name => tileStack.findCard(name)).concat(tileStack)
    //let forceNames = Array.from(tileNames || []); // force includes these card names
    logMkt && console.log(stime(this, ".setMarket:"), { mrktCards: mrktCards.map(c => { return { name: c.name, id: c.id } }) })
    // put all the cards on a market, or in discard:

    mrktCards.forEach(card => {
      discard.dropToOrigSlot = true  // suppress movedToDiscard processing!
      if (!card) return; // if a tileNames was not found
      if (TP.nonMarketTypes.includes(card.type) || TP.nonMarketNames.includes(card.name)) {
        logMkt && console.log(stime(this, ".setMarket: nonMarket"), { card: card.name, id: card.id })
        discard.addCard(card); // move card from tileStack to discardT
        return;
      }
      //console.log(stime(this, ".setMarket: card="), card.name)
      let field: string = "name";
      if (card.subtype == S.High_Tech) field = S.subtype // special handling for High_Tech names

      // console.log(stime(this, ".setMarket"), {card: card.name, field: field, match: card[field]})
      // Is there already a Market for this property:
      useMkt = fullMkt.find(cc => matchesFieldOfCard(cc.getStack(), field, card[field]));
      if (useMkt) {
        logMkt && console.log(stime(this, ".setMarket: use"), {useMkt: useMkt.name, card: card.name, id: card.id})
        useMkt.addCard(card);
      } else if (emptyMkt.length > 0) {
        useMkt = emptyMkt.pop();
        logMkt && console.log(stime(this, ".setMarket: new"), {useMkt: useMkt.name, card: card.name, id: card.id})
        fullMkt.push(useMkt);
        useMkt.addCard(card);
      } else {
        logMkt && console.log(stime(this, ".setMarket: discard"), {card: card.name, id: card.id})
        discard.addCard(card);
      }
    })
    // ASSERT: all cards in MktStack have same initial cost
    fullMkt.sort((a,b) => a.bottomCardOfStack().costn - b.bottomCardOfStack().costn) // sort by increasing cost
    fullMkt.forEach((mkt, index) => mktN[index].stackCards(mkt.getStack()))
    logMkt && console.debug("setMarket: ", discard.getStack().map(c=> {return {name: c.name, id: c.id}}))
    return mktN;
  }

  sortMkts(fullMkts: CC[], mktN: CC[]) {
  }

  /** to find makeCardCont via usage of "new CardContainer"; also clazz = CardContainer */
  XmakeCardCont() { new CardContainer({ width: 10, height: 10 }); }
  /**
   * Add new CardContainer to parent (at depth = 0)
   * If loadCard(info) and stack into cardCont.
   * @param parent typically a ContainerAt on the ScalableContainer
   * @param info CardInfo[] or WH specifying Card size (Card.defMarginSize added to get slotSize)
   * @param opts fields for CardContainer
   */
  makeCardCont<T extends CardContainer>(parent: ContainerAt, info: Card[] | WH, opts: MCCOpts = {}): T {
    // table format
    let { clazz = CardContainer, x = 0, y = 0, stackRow = 0, stackCol = 0, xl = 0, yt = 0 } = opts;
    let { counter: counterOpts = { color: "lightblue" } } = opts;
    // ccopts: destructure (with defaults) then restructure:
    let { slotsX = 1, slotsY = 1, size = undefined, color = "lightgrey", name = "no-named",
      markColor = undefined, margins = undefined, backCard = true, backClick = true, bg = true,
      bgclick = undefined, dropOnCard = undefined, drag = true } = opts;
    let ccopts: CCopts = {
      slotsX: slotsX, slotsY: slotsY, size: size, color: color, name: name, markColor: markColor, margins: margins,
      backCard: backCard, backClick: backClick, bg: bg, bgclick: bgclick, dropOnCard: dropOnCard, drag: drag
    };
    let cardCont = new clazz(info, ccopts);
    //console.log(stime(this, ".makeCardCont: cardCont="), cardCont.name, cardCont)
    if (!!parent.overCont) {
      parent.addChildAt(cardCont, parent.getChildIndex(parent.overCont))
    } else {
      parent.addChild(cardCont); // add cardCont at the top... suitable for DebtCont on a Card
    }

    cardCont.x = x;
    cardCont.y = y;
    // xl: and yt: are for *self-referential* negative offset
    // mostly we use: other.leftEdge(mar, slotsX) to get the effect
    cardCont.x -= xl * cardCont.fullWidth();
    cardCont.y -= yt * cardCont.fullHeight();
    cardCont.overCont = (parent.overCont || cardCont); // parent.childAt(parent.numChidren-1)
    if (!!opts.shuffle) {
      cardCont.stackCards(cardCont.getStack().shuffle(), stackRow, stackCol);
    }
    if (!!counterOpts) {
      //console.log(stime(this, ".makeCardCont: attachCounter"), {name: name, info: info, copts: counterOpts, cardCont: cardCont, parent: parent})
      this.attachCardCounters(cardCont, counterOpts);
    }
    cardCont.init(this)   // enable cardCont to embelish [vs include {table: this} in ccOpts...]
    this.registerCC(cardCont)
    return cardCont as T;
  }
  /** @return the last CardCounter created */
  attachAllStacks(cardCont: CardContainer, valf: (ce: CardEvent) => number, opts: {
    offset?: XY;
    fontSize?: number;
    fontName?: string;
    color?: string;
  }): ValueCounter {
    let counter: ValueCounter;
    /** closure over counter, which appears at ce.row, ce.col */
    let updateValue = (ce: CardEvent) => {
      if (!(ce instanceof CardEvent))
        return;
      let value = valf(ce);
      let counter = (ce.cont.getStack(ce.row, ce.col)[S.cardCounter] as ValueCounter);
      counter.updateValue(value);
    };
    let vname = valf.name || valf[S.Aname] || "valf";
    // one listener for all stacks:
    cardCont.on(S.moved, updateValue, cardCont)[S.Aname] = "updateValue:" + vname
    cardCont.on(S.removed, updateValue, cardCont)[S.Aname] = "updateValue:" + vname
    cardCont.forAllStacks((row, col, stack) => {
      let { offset = { x: undefined, y: undefined }, color = "lightgrey" } = opts;
      counter = new ValueCounter(S.cardCounter, 0, color, opts.fontSize, opts.fontName);
      counter.setValue(0);
      stack[S.cardCounter] = counter;
      // in the middle (undefined), mar pixels above the bottom of card (depending on scale...)
      let { x: offx = undefined, y: offy = counter.cardBottomEdge(cardCont, 3) } = offset;
      let offsetXY = { x: offx, y: offy } as XY;
      counter.attachToStack(cardCont, row, col, offsetXY, [], updateValue); // add no listeners!
      this.scaleCont.addUnscaled(counter);
      //console.log(stime(this, ".attachCounter: counter="), counter, "\n  scaleCont=", this.scaleCont)
    });
    return counter;
  }
  /** display number of cards in each [row,col] Stack in cardCont
   * For MainMap, Markets & Align where there may be multiple Cards in a Slot.
   */
  attachCardCounters(cardCont: CardContainer, opts: {
    offset?: XY;
    fontSize?: number;
    fontName?: string;
    color?: string;
  }): ValueCounter {
    /** value function returning cards in cont.stack(row, col) */
    let updateCount = (ce: CardEvent) => {
      return ce.cont.getStack(ce.row, ce.col).length;
    };
    return this.attachAllStacks(cardCont, updateCount, opts);
  }
  /** attach auctionPrice to each stack of auctionTN. */
  attachAuctionPrices(colCosts: number[], opts: {
    color?: string;
    offset?: XY;
    fontSize?: number;
    fontName?: string;
  }) {
    let cont = this.auctionTN;
    cont["colCosts"] = colCosts;
    let auctionPrice = (ce: CardEvent): number => {
      let card0 = cont.bottomCardOfStack(ce.row, ce.col); // a Card has come or gone, see what's left
      let colCost = ce.cont["colCosts"][ce.col]; // colCost[ce.col]
      let cost = !!card0 ? Math.max(0, colCost + card0.costn) : colCost;
      return cost;
    };
    this.attachAllStacks(cont, auctionPrice, opts);
  }
  /** discard with activation of Effects
   *
   * auto-discard flipped Event
   * plyrProjClicked (click on Deferred Event)
   * discard "Deferred" from plyrProj (on Draw action)
   * Ripple from auctionTN ('this' undefined)
   * Ripple from PolicySlots ('this' undefined)
   * @param card drag it to table.discardT and deactivate it.
   */
  dragToDiscard(card: Card) {
    let table = card.table
    let dest = table.discardT    // NOTE: should maybe setDropTarget(discardT) [and pop it...]
    console.log(stime(this, ".dragToDiscard:"), { name: card.name, card: card }, { db: Array.from(table.effects.dataRecs) });
    dest.dragStartAndDrop(new CardEvent(CC.dropEvent, card, 0, 0, dest)); // S.moved -> table.movedToDiscard()
    if(false)table.mainMap.hideLegalMarks(); // dragStart (prj) tends to setLegalMarks;
  }
  /** S.moved handler: discardT.on(S.moved, ...)
   * check for Event types, invoke their Effects,
   * then proceed to discard the Card.
   * @param ce with ce.cont == table.discardT
   */
  movedToDiscardT(ce: CardEvent) {
    if (ce.cont.dropToOrigSlot && !(TP.debugOnDiscard && ce.card.isEvent()))
      return; // only process discard *once* (and never for Deferred Event onDraw)
    let card0 = ce.card, ecard = card0 // ASSERT: ce.cont = this.discardT

    if (card0.isDiscardActivated(card0.isFromPrjs() || TP.debugOnDiscard)) { // override isFromPrjs()
      ecard.policyPlayer = this.curPlayer; // yes: Effects may be specific to the activating Player!
      this.forEachPlayer(p => {
        let state = p.recordPlayerState()
        this.addUndoRec(state, `restorePlayerState(${p.name})`, () => { this.curPlayer.restorePlayerState(state) })
      })
      let rmRecs = this.effects.doEffectsOfEvent(ecard, this.curPlayer); // discardActivated
      this.addUndoRec(rmRecs, "removeUntilRecs", () => { this.effects.removeRecords(rmRecs) })
      this.curPlayer.stats.addEvent(ecard)
      console.log(stime(this, ".discardActivated:"), { eName: ecard.name, ecard }, { db: Array.from(this.effects.dataRecs), rmRecs: rmRecs });
    }

    this.cleanDiscardedCard(card0)       // clear the card (if from mainMap? plyrProjs(vcOwned))
    card0.moveCardWithUndo(ce.cont)      // undoRec: move(discardT->origSlot) hmm: what if Policy?
    this.undoClose();
    // if not from Market or discardP
    this.adjustAllRentsAndStats()        // after discard: effects are removed
  }

  /**
   * Remove decorations and assocations from this Card
   *
   * removeEffectsOfCard
   * setOwner(undefined); (& remove noRent)
   * remove counters;
   * undefine all the fields (in case Card is reshuffled into stock pile)
   *
   * @param card
   * @param keepOwner (default: false)
   */
  cleanDiscardedCard(card: Card, keepOwner = false) {
    this.forEachPlayer(p => {
      if (p.curCard == card) {
        let { row, col } = p.playerMarker.slotInfo
        p.curCard = this.mainMap.getStack(row, col)[0] // other card or undefined; || p.homeCard
      } })
    // expect Events do not have "card.hasDRinDB"
    if (card.hasDRinDB) this.effects.removeDRsOfCard(card);
    keepOwner || (card.owner = undefined);     // invoke setOwner(undefined) move Debt, remove S.noRent
    // remove associated Counters: [Is this necessary? useful?]
    card.removeCounters()
    // clean fields [QQQQ: what are these fields on Card??]
    card.policyPlayer = card[S.buys] = card[S.builds] = card[S.polis] = undefined;
  }

  scaleParams = { initScale: .125, scale0: .1, scaleMax: 6, steps: 30, zscale: .20,  };
  /** makeScaleableBack and setup scaleParams */
  makeScaleCont(bindKeys: boolean): ScaleableContainer {
    let scale = this.scaleParams.initScale = 0.324; // .125 if full-size cards
    /** scaleCont: makeScalableBack ground */
    let scaleC = this.scaleCont = this.makeScaleableBack(TP.bgColor);
    if (bindKeys) {
      this.bindKeysToScale("z")
    }
    return scaleC
  }
  bindKeysToScale(char = "z", cw: number = 262, ch: number = 374) {
    const scaleC = this.scaleCont
    const m = this.margin
    const pg = this.paramGUI, pgb = pg && pg.getBounds()
    // Offset based on layout to right side of mainMap:
    let minX = pgb ? (cw + 4*ch + 5*m + pgb.width) : (2*cw + 3*ch + 5*m) // ~width of playerCont
    let minY = m
    let ptZ = { x: -minX, y: -minY }
    let ptA = { x: -minX, y: -minY + (pg ? pg.y : 0) }

    // setup Keybindings to reset Scale:
    const setScaleXY = (si: number = scaleC.initIndex, xy: XY = ptZ, sxy?: XY) => {
      // scaleC.setScaleXY & update()
      let ns = scaleC.setScaleXY(si, xy, sxy)
      this.stage.update()
    }
    const resetScale0 = () => setScaleXY(); // 10
    const resetScale1 = () => setScaleXY(7);
    const resetScaleA = () => setScaleXY(14, ptA);

    // Scale-setting keystrokes:
    KeyBinder.keyBinder.setKey("x", { thisArg: this, func: resetScale0 });
    KeyBinder.keyBinder.setKey("z", { thisArg: this, func: resetScale1 });
    KeyBinder.keyBinder.setKey("a", { thisArg: this, func: resetScaleA });
    KeyBinder.keyBinder.dispatchChar(char)
  }
  /**
   * Put new background ScalableContainer at (x0,y0) on this.stage.
   *
   * Add a child Container (8000x5000) so the SC has a dragable target.
   *
   * @param bgColor
   */
  makeScaleableBack(bgColor: string = TP.bgColor): ScaleableContainer {
    let scaleC = new ScaleableContainer(this.stage, this.scaleParams);
    if (!!scaleC.stage.canvas) {
      CardContainer.dragger = new Dragger(scaleC)
      // Special case of makeDragable; drag the parent of Dragger!
      CC.dragger.makeDragable(scaleC, scaleC, undefined, undefined, true); // THE case for NOT useDragCont
      this.scaleUp(CC.dragger.dragCont, 1.7); // Items being dragged appear larger!
    }
    if (!!bgColor) {
      // specify an Area that is Dragable (mouse won't hit "empty" space)
      let background = new Shape(), { x, y, w, h } = TP.bgRect
      background.graphics.beginFill(bgColor).drawRect(x, y, w, h);
      scaleC.addChildAt(background, 0);
      //console.log(stime(this, ".makeScalableBack: background="), background);
    }
    //console.log(stime(this, ".makeScalableBack: backboard="), scaleC);
    return scaleC;
  }
  /** ValueCounter showing current scale of backboard. */
  makeScaleCounter(scaledCont: ScaleableContainer, x0: number, y0: number) {
    let scale = M.decimalRound(scaledCont.getScale(), 3);
    let counter = new ValueCounter("scaleCounter", scale, "pink", 16);
    //counter.attachToSlot(backboard)
    scaledCont.addChild(counter);
    scaledCont.addUnscaled(counter);
    counter.x = x0;
    counter.y = y0;
    scaledCont.on(S.scaled, (e: ScaleEvent) => counter.setValue(M.decimalRound(e.scale, 3)))[S.Aname] = "scaleCounter";
    //counter.attachToDispatcher("scaled", backboard, backboard, counter, (e:Event) => (round((e as ScaleEvent).scale)))
  }


  /** CardContainer holding the HouseToken 'cards'. */
  makeHousesCont(contAt: ContainerAt, size: WH, x: number, y: number) {
    let table = this;
    // convert (card.type == S.house) Card to specialized HouseToken:
    let houseCards = table.tokenCards.findCards((c) => c.type == S.house, true)
    houseCards.sort((a, b) => a.costn - b.costn)          // sort cards in ascending order of cost
    let houses = houseCards.map(c => new HouseToken(c));  // clone houses in ascending order
    let names: string[] = [];    // entry for each HouseToken.name: ["House", "Triplex", "Apt", "High", "Tower"]
    houses.forEach((c: Card) => names.includes(c.name) || names.push(c.name))

    let sizes: WH = { width: TP.houseSize, height: TP.houseSize };
    let margins: WH = { width: 15, height: 2 };
    let offset: XY = { x: -20, y: undefined };
    let counterOpts = { color: "lightgreen", fontSize: 10, offset: offset };
    let housesCont = table.makeCardCont<HouseMktCont>(contAt, sizes, { clazz: HouseMktCont,
      name: "houseMkt", slotsY: names.length, margins: margins, backCard: false, x: x, y: y, dropOnCard: true,
      counter: counterOpts
    });
    housesCont.names = names
    // Each House.name in its own row of the housesCont:
    houses.forEach((c: HouseToken) => housesCont.addHouse(c))
    return housesCont;
  }
}
/** CardContainer that knows where to stack HouseTokens (by name) */
class HouseMktCont extends CardContainer {
  names: string[]      // index in names -> row in HouseMktCont
  houseMktRow(c: HouseToken) { return this.names.indexOf(c.name) }
  /** Add HouseToken to appropriate row of HouseMktCont. */
  addHouse(c: HouseToken) {
    this.addCard(c, this.houseMktRow(c), 0)
  }
  /** return instance of HouseToken if there is one available in market. */
  getHouse(name: string): HouseToken {
    return this.bottomCardOfStack(this.names.indexOf(name), 0) as HouseToken
  }
}
