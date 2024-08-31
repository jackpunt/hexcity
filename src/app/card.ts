import { permute, stime } from '@thegraid/common-lib';
import { Bitmap, Container, DisplayObject, Shape, Text } from '@thegraid/easeljs-module';
import type { DebtContainer } from './Debt';
import { C, F, S, WH } from './basic-intfs';
import { CardContainer } from './card-container';
import { CI, CardInfo, CardInfo2, CardMaker, CardType, SubType } from "./card-maker";
import { Player } from './player';
import { Table } from './table';
import { TP } from './table-params';
import { ValueCounter } from "./value-counter";

/** Used in generated *-deck.ts files */
export interface Deck {
  name: string;
  cards: CardInfo2[]; // step,stop,rent: string | number
  stack?: Stack;
}
/** identify where Card is stacked.
 * card.slotInfo = current stack (when dropped/moved)
 * card.origSlot = previous stack (at dragStart)
 */
export interface SlotInfo {
  cont: CardContainer, // main board is a HexMap, others are simple TileSource (row,col = 0,0).
  row: number,
  col: number,
  stack?: Stack,     // beneath CardContainer; Array<Card | Tile>
  aname?: string,    // cont.name
}
/** object associated with a settable SlotInfo: {cont, row, col, stack?, aname?}
 *
 * suitable target for CardContaine.moveAndSetSlotInfo()
 */
export interface HasSlotInfo extends DisplayObject {
  slotInfo: SlotInfo;
  setSlotInfo(slotInfo: SlotInfo): SlotInfo;
}
/** a managed Array\<Card> */
export class Stack extends Array<Card> {
  // added so one could Promise.all(promises).then(continuation)
  // but we just ended up fudging card.width/height with defSlotSize
  // Still: this field now distinguishes Stack from Array<CardInfo>
  // (versus using stack[0].imagePromise !== undefined)
  imagePromises: Promise<HTMLImageElement>[];

  constructor(cards?: Card[]) {
    if (typeof(cards) == 'number') {
      super(cards)
    } else {
      super()
    }
    if (cards instanceof Array) this.push(...cards);
  }

  /**
   * Shuffle all the cards in the given Stacks,
   * returning a single new and newly premuted Stack.
   * @param stacks any number of Stack
   * @return concatenated and premuted Stack
   */
  shuffle(...stacks: Card[][]): Stack {
    const cards = this.concat(...stacks);
    return permute(new Stack(cards)) as Stack;
  }

  /** splice card from stack and slotInfo = undefined
   * @param card
   * @param ndx if you know the index of card within stack, bypass a findIndex() call
   * @return true if card is found/removed; false if card not found
   */
  removeCardFromStack(card: Card, ndx: number = this.indexOf(card)): boolean {
    if (ndx < 0) {
      console.log(stime(this, ".removeCardFromStack: card not on SlotInfo.stack:"), card.name, this)
      return false
    }
    let xcard = this.splice(ndx, 1)[0]
    xcard.slotInfo = undefined
    return true
  }

  /** find 1 card, remove it from Stack (unless keep = true)
   * @param name a string or a find function (card:Card, ndx:number, ary:Card[]):boolean
   * @param keep set true to leave card in this Stack; Default = false: remove the card.
   * Note: CC.addCard() will also removeCardFromStack
   */
  findCard(name: string | ((card: Card, ndx: number, ary: Card[]) => boolean), keep = false): Card {
    let selectFunc = ((typeof name) == "function")
    ? (name as ((card: Card, ndx: number, ary: Card[]) => boolean))
             : ((card: Card, ndx: number, ary: Card[]):boolean => (card.name == (name as string)))
    return this.find((card, ndx, ary): boolean => {
      if (selectFunc(card, ndx, ary)) {
        if (keep != true) {
          this.splice(ndx, 1) // see also: this.removeCardFromStack()
          card.slotInfo = undefined
        }
        return true;
      } else {
        return false;
      }
    })
  }
  /** find in reverse, so splice(ndx,1) does no damage. */
  filterInReverse(ary: Array<any>, predicate: (val: any, ndx: number, array: Array<any>) => boolean): Array<any> {
    let rv = new Stack();
    for (let i = ary.length - 1; i >= 0; i--) {
      let val = ary[i]
      if (predicate(val, i, ary)) {
        rv.push(val);
        this.splice(i, 1)
        val.slotInfo = undefined
      }
    }
    return rv;
  }
  /**
   * filter (or filterInReverse) finding Cards that satisfy selector.
   * @param selector the Card.name or a function to determine match.
   * @param keep indicates whether to keep or remove the matched Card(s) [default=false]
   * @return isaStack */
  findCards(selector: string | ((card: Card, ndx: number, ary: []) => boolean), keep = false): Card[] {
    let name:string = selector as string;
    let matchNameKeep = (card: Card) => (card.name == name);
    let matchNameRemove = (card:Card, ndx:number, arry:Array<any>): boolean => {
      if (card.name === name) {
        this.splice(ndx, 1)
        card.slotInfo = undefined
        return true;
      } else {
        return false;
      }
    };
    //console.log(stime(this, ".findCards: selector="), selector)
    let pred: (card: Card, ndx: number, ary: []) => boolean;
    if (!(typeof(selector) == "string")) {
      pred = selector as ((card: Card, ndx: number, ary: []) => boolean)
      //console.log(stime(this, ".findCards: using predicate="), pred)
    }
    //let pred0 = (name.length == undefined) ? name as ((card: Card, ndx: number, ary: []) => boolean) : undefined
    if (keep == true) {
      return this.filter(pred || matchNameKeep)
    } else {
      return this.filterInReverse(this, pred || matchNameRemove)
    }
  }
}

// open question if we should deckify as n-instances of Card,
// or maintain & use the nreps.

/** represents [nreps of] a Card.
 * with pointer back to its Deck.
 */
export class Card extends Container implements CardInfo, HasSlotInfo {
  static assetPath = "/assets/main/images/cards/"
  static cardClassName: string = undefined

  static cardMaker: CardMaker;
  static scale = 1;

  /** specifically "Card", not a subclass like Flag, HouseToken or Debt */
  isClassCard(): this is Card { return this.constructor.name === Card.cardClassName; } // === 'Card'
  // CanvasImageSource | String | Object

  ci: CI;
  /** set this.bitmap so it displays the correct image of this Card.
   *
   * originally load a saved image; now: CI is a container of Shapes & Text.
   *
   * PlanC: if info ISA Card, then it has a CI which has a cache/bitmapCache,
   * set this bitmap to use the same bitmap!
   */
  setBaseImage(info: CardInfo, scale = 1.0) {
    // Assume that Card has a legitmate bitmap.image by now (because we waited for all promises)
    // if @param info ISA Card, we try to dup the existing Bitmap:
    // with new (1.0.0) createjs, can pass the actual Image to contstructor
    // if is still a Promise<HTMLImageElement> then need to arrange to find the resulting Image.
    // @see Bitmap.js in createjs.js
    // this.bitmap = (info instanceof Card) ? new Bitmap(info.bitmap.image) : new Bitmap(Card.assetPath + info.path);
    if (!Card.cardMaker) Card.cardMaker = new CardMaker(undefined, scale);
    const ci: CI = this.ci = Card.cardMaker.makeCardImage(info);
    const { x, y, width, height } = ci.getBounds();
    this.width = width * scale; this.height = height * scale; // NOTE: scale is 1 !!!
    // set this.image (with width & height) so setSlotSizeFromSource will work.
    const image = this.image = new Image(this.width, this.height); // fake image to carry(w,h)
    const useCacheDataURL = false; // cacheCanvas takes 3 times longer (to render from dataURL)
    if (useCacheDataURL) {
      const parent = new Container();
      parent.scaleX = parent.scaleY = scale;
      parent.addChild(ci);
      parent.cache(x * scale, y * scale, width * scale, height * scale);
      this.bitmap = new Bitmap(parent.cacheCanvas); //ci.getBitmap();
      const prom = new Promise<HTMLImageElement>((res) => {
        image.onload = () => res(image);
      });
      image.src = parent.getCacheDataURL();
      this.imagePromise = info.imagePromise = prom;
      this.addChild(this.bitmap);
      this.bitmap.x -= this.width / 2;
      this.bitmap.y -= this.height / 2;
    } else {
      // NOTE: ci is a cached DisplayObject, it render without further computation:
      this.bitmap = ci;  // CI is already centered around (0, 0)! so drag will not be offset!
      const prom = new Promise<HTMLImageElement>((res, rej) => { res(image) }); // RESOLVED!
      this.imagePromise = info.imagePromise = prom;
      this.addChild(this.bitmap);
      // this.cache(x * scale, y * scale, width * scale, height * scale);
    }
  }

  /**
   * Container with a CI (containing lots for Shapes & Text & ximage from CardInfo)
   *
   * OR the old-style with a composite Bitmap built by GIMP, referenced by info.path.
   *
   * createjs.Bitmap(imageOrUrl: string | Object
   * | HTMLImageElement | HTMLCanvasElement
   * | HTMLVideoElement): createjs.Bitmap
   * @param info a CardInfo or existing Card
   * @param nrep optional: use info.nreps || 1
   * @param table optional: but final Card must set .table somewhere
   */
  constructor(public info: CardInfo , nrep?: number, table?: Table) {
    //super(Card.assetPath + info.path);
    super() ;
    if (info instanceof Card) info = this.info = info.info; // use the *original* info.
    // Assert: a Card is created before any Debt, Flag, or HouseToken; TODO better detect super() calls
    if (!Card.cardClassName) Card.cardClassName = this.constructor.name;  // "Card" or random optimized
    this.scaleX = this.scaleY = Card.scale;
    this.setBaseImage(info, 1.0); // make image at scale=1, entire Card will be reduced...
    let { nreps, type, name, color, cost, step, stop, rent, vp, path, ext, subtype, text, props = {}, image, imagePromise } = info;
    if (subtype == "Test") {
      let testName = new Text(name, F.fontSpec(32), C.vpWhite)
      this.addChild(testName)
      testName.y = 16
      testName.x = 50
    }

    // Record the semantic info, from CardInfo into this Card:
    /** return 0 or val or props[val] NOT undefined... */
    let valProp = (val:number|string, props:object, key:string):number => {
      return (((typeof val) === "number") ? val : (props ? props[key] || 0 : 0)) as number;
    }

    this.nreps = nrep || nreps || 1;
    this.table = table // may be undefined for proto-Cards, when nreps > 1
    this.type = type;
    this.color = color;
    this.name = this[S.Aname] = name;
    this.cost = valProp(cost, props, "cost");
    this.step = valProp(step, props, "step");
    this.stop = valProp(stop, props, "stop");
    this.rent = valProp(rent, props, "rent");
    this.vp   = valProp(vp, props, "vp");
    this.path = path;
    this.ext = ext;
    this.subtype = subtype;
    this.text = (typeof text === 'string') ? text : text?.[0]; // "text" | ["text", ...extras]
    this.props = props;
    this.image = this.image ?? image; // retain image injected by setBaseImage()
    if (this.type == "Back") {
      //console.log(stime(this, ".constructor: Back info="), info);
      this.width = this.costn
      this.height = this.step
    }
    //console.log(stime(this, ".constuctor: "), name, this.nreps, this);
  }

  _width: number;     // for "Back" card
  _height: number;
  /** implicit creation of this.width: */
  set width(w: number) { this._width = w }
  get width(): number {
    if (this._width) { return this._width }
    else if (this.image) { return this.image.width } // eventually this will succeed
    else { return undefined }
  }
  set height(h: number) { this._height = h }
  get height(): number {
    if (this._height) { return this._height }
    else if (this.image) { return this.image.height }
    else return undefined
  }
  get WH(): WH {
    return { width: this.width, height: this.height }
  }

  // IND:Array<CardInfo> = [{name: "Bar", type: "tile", nreps: 1},{}];
  // CardInfo
  nreps: number;
  type: CardType;
  color: string;
  cost: string | number;
  step: number;
  stop: number;
  rent: number;
  vp: number;
  path: string;
  ext: string | null;
  subtype: SubType | null;
  text: string | null;
  props: object;
  bitmap: DisplayObject;
  image: HTMLImageElement; // or maybe createjs.Bitmap
  imagePromise: Promise<HTMLImageElement>;
  getImagePromise() { return this.imagePromise; }
  /** cost as number */
  get costn(): number { return this.cost as number}
  get sellPrice(): number { return Math.max(this.costn - 2, Math.floor((this.costn + this.rentAdjust)/2))}

  /** Turn Of Build: when card was built. */
  tob: number = 0;            // turn of build (turn when card was built)
  useDropAt: boolean = false; // true if card.allowDropAt() is meaningful
  allowDropAt(dstCont: Container, row: number, col: number):boolean|undefined {return undefined};
  useDropFunc: boolean = false;
  /** return true if drop complete; return false to continue drop procesing. */
  dropFunc(srcCont: Container, dstCont: Container, row: number, col: number): boolean { return false }
  /** addCard to card.origSlot */
  putItBack(slot = this.origSlot) {
    let { cont, row, col } = slot
    cont.addCard(this, row, col) // return to origSlot
  }
  _owner: Player;        // current owner of this Card
  get owner() { return this._owner };
  set owner(p: Player) { this.setOwner(p) }
  ownerFlag: Flag;      // a Flag > Card > Bitmap
  table: Table;         // used in effects to find card.table.curPlayer
  policyPlayer: Player; // defined (as Player) if policy or event effects only ONE player
  debtCont: DebtContainer; // as DebtContainer

  // per-turn effects set these: (reset to zero each turn)
  costAdjust: number = 0;   // used by Effects to adjust cost [generally: adjustedCost == costAdjust]
  buildAdjust: number = 0;  // build cost adjusted by buildAdjust Effects
  stepAdjust: number = 0;   // not used (Nov 2021)
  stopAdjust: number = 0;   // not used (Nov 2021) wages adjusted by stopAdjust Effects & filters
  rentAdjust: number = 0;   // rent adjusted by rentAdjust Effects & filters

  // contain the current value of the parameter: (as adjusted to date) as shown in ValueCounter!
  adjustedCost: number = 0; // buy or build cost adjusted during dragStart->config/Buy/Build/Cost
  //adjustedStep: number = 0; // step + stepAdjust effects
  //adjustedRent: number = 0; // rent + rentAdjust effects
  //adjustedStop: number = 0; // stop + stopAdjust effects

  noStop: boolean = false;    // true if card is not rentable, show no rentMark (Lake, houses)
  rentCounter: ValueCounter; // Container; //
  noVpCounter: boolean = false;
  vpCounter: ValueCounter;    // overlay VP Counter, if card has one. (where card.vp == "*") //Container; //
  stopCounter: ValueCounter; // Container; //
  counters: ValueCounter[]; // ValueCounter(s) to be discarded along with this Card //Container[] = []//
  hasDRinDB: boolean;

  /** add or remove card.owner and Flag.
   * For mainMap (build Tile), policySlots (buy Policy), plyrProj (vcDebt buy)
   * @param player the new owner (or undefined if unowned)
   */
  setOwner(player: Player) {
    if (this.owner == player) return                // nothing to do (or undo...)
    let card = this, table = card.table, origOwner = this.owner
    table.effects.removeNoRentFlag(card)            // incls addUndoRec() [changing owner clears noRent]
    table.addUndoRec(card, "owner")                 // undo back to origOwner
    card._owner = player                            // clear or set card.owner
    Flag.removeOwnerFlag(card)                      // esp if player === undefined
    if (!!player && (card.isClassCard())) {         // QQQQ: what *else* would we set owner on? [Flag]
      Flag.attachFlagToCard(player.ownerCard, card) // not House, Debt, Flag, etc
    };
    if (!card.getSlotInfo()) {
      console.log(stime(this, '.setOwner'), card)   // deContainer the mainMap: card has no slotinfo
    } else {
      let { row, col } = card.getSlotInfo()  // mainMap (build tile) or policySlots (buy policy) or plyrProj (vcBuy)
      card.table.mainMap.dispatchCardEvent(S.setOwner, card, row, col) // DebtContainer.setOwnerEvent(ce: CardEvent)
    }
    card.stage.update()
  }

  /** Stack card is on */
  slotInfo: SlotInfo;
  /** Stack card was on */
  origSlot: SlotInfo;

  getSlotInfo(): SlotInfo {
    return this.slotInfo;
  }
  fillInfo(info: SlotInfo): SlotInfo {
    if (!info.cont) alert("setSlotInfo with no CardContainer")
    if (!info.stack) info.stack = info.cont.getStack(info.row, info.col)
    if (!info.aname) info.aname = info.cont.name
    return info
  }
  /** record the curent stack this card is on. */
  setSlotInfo(info: SlotInfo): SlotInfo {
    if (!!info) this.fillInfo(info)
    return this.slotInfo = info
  }
  setOrigSlot(info?: SlotInfo) {
    if (!info) info = this.slotInfo
    this.origSlot = this.fillInfo(info)
  }
  /** Undo moveCard: add this Card to slotInfo = origSlot. */
  moveCardUndo(os = this.origSlot) {
    let si = this.slotInfo // where card 'is', put card back to 'os'
    // addCard will remove(slotInfo) *then* set slotInfo = row,col
    this.buildAdjust = this.costn         // esp mainMap->proj (Q: will someone reset the rentCounter?)
    os.cont.addCard(this, os.row, os.col) // full dance: setSlotInfo, S.removed, addChild, S.moved

    // undo "Discard": addCardProps usually via payBuyCost [vs S.moved] so we do it here:
    if (si.cont == this.table.discardT && os.cont == this.table.mainMap) {
      // upgrade or demolish: if Player was onCard@[row,col]:
      this.table.effects.addCardProps(this, "undoMove-rebuild") // discard->mainMap (adjustAllRentsAndState will replace Counters)
      this.table.forEachPlayer(p => {
        let {row, col} = p.playerMarker.slotInfo // or p.getLastMoveRec()
        if (row == os.row && col == os.col) p.curCard = this
      })
    }
    if (si.cont == this.table.mainMap) { // undo "Build": back to plyrProjs (or mktCont! from pseudo-buy/build)
      this.table.cleanDiscardedCard(this, true)  // remove Effects & Counters, but leave owner & Flag intact
      if (this instanceof HouseToken) this.calcHousingRentVp(si.stack, si) // clean up Housing [where House was]
    }
    this.origSlot = undefined    // undo indication that card was moved
  }
  /** put card in new {cont, row, col} with undoRecs  */
  moveCardWithUndo(ncont: CardContainer, nrow: number = 0, ncol: number = 0) {
    let card = this
    let {cont: ccont, row: crow, col: ccol} = card.slotInfo   // current location [loc0]
    if (ccont !== ncont || crow !== nrow || ccol !== ncol) {
      // set origSlot=loc0,delete slotInfo; dispatch(S.moved); if (ncont==discardT) moveCardWithUndo(discardT)!
      ncont.addCard(card, nrow, ncol)
    }
    let {cont, row, col} = card.origSlot, os = { cont, row, col} // copy of origSlot (loc0)
    // moveCardWithUndo(discardT) -> discardT.addCard -> S.moved -> movedToDiscard -> moveCardWithUndo(discardT)
    // do NOT issue a second undoRec for this movement.
    let undoName = `${card.name}:${ncont.name}[${nrow},${ncol}]->${cont.name}[${row},${col}]`
    let openRec = this.table.undoRecs.openRec, len = openRec.length
    if (len > 0 && openRec[len-1].aname == undoName) return
    this.table.addUndoRec(card, undoName, () => card.moveCardUndo(os))
  }

  /** all the 'acard' built from CardInfo2. */
  static cardByName = new Map<string, Card>();

  /** Return Array of each Card specified in infoAry: CardInfo2.
   * All cardinfo is present, nreps=1 (multiple instances), images are Promise'd.
   *
   * @param infoAry a CardInfo2[], for example: HomeDeck.deck
   * @param donefunc function(stack) called when all Images are loaded.
   * @param thisArg call donefunc with 'this'
   * @return a Stack of the Cards; stack.imagePromises: Array\<Promise\<HTMLImageElement>>
   */
  static loadCards(infoAry: CardInfo2[], table?: Table, donefunc?:((stack:Stack) => void), thisArg?: any): Stack {
    const stack: Stack = new Stack()
    const promises: Promise<HTMLImageElement>[] = [];
    //console.log(stime(this, ".loadCards1: stack="), stack, promises)
    stack.imagePromises = promises;

    infoAry.forEach((info: CardInfo, lineno: number) => {
      const acard = new Card(info); // build the Bitmap from image.png [thanks webpack] (or CI)
      Card.cardByName.set(acard.name, acard);
      const nreps = acard.nreps;
      // likely has .imagePromise
      //console.log(stime(this, ".loadCards2"), acard.nreps, acard.name, acard)
      promises.push(acard.imagePromise);
      for (let i: number = 0; i < nreps; i++) {
        stack.push(new Card(acard, 1, table)); // copy card, share image, imagePromise
      }
    })
    //console.log(stime(this, ".loadCards3: stack="), stack, promises)

    //console.log(stime(this, ".loadCards4: promises="), promises)
    if (donefunc)
      Promise.all(promises).then(
        (images: HTMLImageElement[]) => donefunc.call(thisArg, stack));
    return stack;
  }
  /** @return a string with type identifiers, suitable for RegExp matching. */
  isRegExpType(regex: string[]): boolean {
    let regxOf = (key: string, values: string[]): boolean => {
      return !!values.find(s => !!key.match(s));
    }
    let card = this
    let type = card.type
    let subtype = card.subtype
    let orient = (card.width > card.height) ? 'wide' : 'tall'
    let select = orient + ':' + type + '-' + (subtype ? subtype : '')
    return regxOf(select, regex)
  }
  /** Generic include/remove matching. */
  isLike(str: string): boolean {
    return this.name == str || this.type == str || this.subtype == str || this.ext == str
  }
  /** indicates that Transit-adjacency rule applies. */
  isTransit(): boolean {
    return !!this.subtype && this.subtype.startsWith("Transit") // includes: "Transit - Park" (aka Lake)
  }
  isPolicy(): boolean {
    return ['Policy', 'Temp Policy'].includes(this.type)
  }
  isInactivePolicy(player: Player) {
    return this.isPolicy() && (!!this.policyPlayer && this.policyPlayer != player)
  }
  isEvent(): boolean {
    return ['Event', 'Future Event', 'Deferred'].includes(this.type)
  }
  isTax(): boolean {
    return (this.isEvent() && this.subtype == S.Tax) // Property Tax, Wealth Tax, Income Tax
  }
  /** Tile (to MainMap) vs Policy - Event; isClassCard()
   * @param except return false for specified tileTypes.
   */
  isTile(...except: string[]): boolean {
    const tileTypes = ['Residential', 'Financial', 'Industrial', 'Commercial', 'Municipal', 'Government', 'Road']
    return (tileTypes.includes(this.type) && !except.includes(this.type))
  }
  /** Card is stacked on Tile stack. */
  isTileStack(): boolean {
    return (this.isTile() && (!TP.roadsInEvents || this.type != S.Road)) || (TP.taxesInTiles && this.isTax())
  }
  /** Card is stacked on Policy stack. */
  isPolicyStack(): boolean {
    return this.isPolicy() ||
      (this.isEvent() && (!TP.taxesInTiles || !this.isTax())) ||
      (TP.roadsInEvents && this.type == S.Road)
  }
  /** Event */
  isFlipActivated(): boolean {
    return ['Event'].includes(this.type)
  }
  isFromPrjs(): boolean {
    return !!this.origSlot && this.origSlot.cont.name.endsWith(S.Prjs)
  }
  /** Zero-Cost Events, Deferred, and Future Event from plyrProj.
   * @param fromPrj set to true to include Deferred/Future Event
  */
  isDiscardActivated(fromPrj: boolean = false): boolean {
    // not Activated if moveRipple from auctionTN; must be click or drag setting this.origSlot
    return (this.type == "Event") ? this.cost == 0
    : (this.type == "Deferred") ? fromPrj
    : (this.type == "Future Event") ? fromPrj
    : false;
  }

  /**
   * return bonus due to owner for a step on this Card.
   * @param bonusAry may supply array to get more/less credit... (length > TP.bonusNcards)
   * @returns
   */
  getFranchiseBonus(bonusAry = TP.stdBonusAry): number {
    let card = this, owner = card.owner, subtype = card.subtype, mainMap = this.table.mainMap
    if (!owner || !subtype) return 0
    if (TP.bonusAmt <= 0) return 0
    if (!!card[S.noRent]) return 0
    // Note: subtype: Com-Transit != subtype: Transit
    // bonus for N of same subtype; extra bonus for N of same name:
    let ownerTiles = mainMap.filterTiles(c => c.owner == owner)
    let bonusTiles = ownerTiles.filter(c => c.subtype == subtype)
    let nsubt = Math.min(TP.bonusNcards, bonusTiles.length)
    let bonus = bonusAry[nsubt]
    bonusTiles.forEach(c => (nsubt >= TP.bonusNcards) ? c.makeBonusMark() : c.removeBonusMark())
    return bonus
  }

  /** overlay a ValueCounter on card, to show the current rent, stop, VP
   *
   * rentCounter, stopCounter, vpCounter, stepRange, bonusMark, [effect]Counter; put on card.
   *
   * See also: CI.setPriceBar()
   *
   * @param name identify the Counter for debut
   * @param cx offset from center of card to center of counter
   * @param cy offset from center of card to center of counter
   * @param color color for the ellipse showing the count
   */
  makeCounter(name: string, initVal: number | string = "0", cx = 0, cy = 0, color: string = "lightgrey", fontSize: number = 37): ValueCounter {
    let card = this, fontName = Card.cardMaker.textFont;
    let counter = new CoinCounter(name, initVal, color, fontSize, fontName); // use CoinCounter to get font offsets, etc
    counter.name = name;
    card.addChild(counter);
    counter.x = cx;
    counter.y = cy;
    if (!card.counters) card.counters = []; // Array<ValueCounter>
    if (name.endsWith("TokenCounter")) // Temp Policy & High-Tech
      card.counters.push(counter);     // enumerate them so we can delete when discard
    return counter;
  }
  removeCounters() {
    let card = this
    if (!!card.counters) {      // remove any Counters! CAN THIS BE UNDONE?
      card.counters.forEach((c: ValueCounter) => {
        card[c.name] = undefined // stepCounter, stopCounter, rentCounter
        c.parent.removeChild(c)
      });
      card.counters = [];
    }
    card.removeBonusMark()
  }

  makeRentCounter(color: string = C.coinGold) {
    const cx = this.width / 2 - Card.cardMaker.edge - Card.cardMaker.coinSize;;
    const cy = this.ci.ty + this.ci.priceBarSize / 2 - this.height / 2;
    this.rentCounter = this.makeCounter("rentCounter", this.rent, cx, cy, color)
  }
  makeStopCounter(color: string = C.coinGold) {
    const cx = 0; // center
    const cy = this.ci.ty + this.ci.priceBarSize / 2 - this.height / 2;
    this.stopCounter = this.makeCounter("stopCounter", this.stop, cx, cy, color)
  }
  makeVPCounter(color?: string) {
    const cx = this.width / 2 - Card.cardMaker.edge - Card.cardMaker.coinSize;
    const cy = this.height / 2 - Card.cardMaker.edge - Card.cardMaker.coinSize;
    this.vpCounter = this.makeCounter("vpCounter", this.vp as number, cx, cy, color)
  }
  /** mark Policy & Event with 'range' (== card.step) required to purchase (or use?) */
  makeStepRange(color: string = C.white) {
    if (!(this.isPolicy() || this.isEvent())) return
    const cx = this.width / 2 - Card.cardMaker.edge - Card.cardMaker.coinSize;;
    const cy = this.ci.ty + this.ci.priceBarSize / 2 - this.height / 2;
    this.stepRange = this.makeCounter('stepRange', this.step, -cx, cy, color) // not a "Counter"
  }
  stepRange: ValueCounter;

  bonusMark: ValueCounter; // for Franchise Bonus
  /** Franchise bonus */
  makeBonusMark(color: string = C.coinGold, text: string | number = '+' ) {
    if (!!this.bonusMark) return
    const cx = this.width / 2 - 3 * Card.cardMaker.edge - Card.cardMaker.coinSize;
    const cy = this.height / 2 - Card.cardMaker.edge - Card.cardMaker.coinSize;
    this.bonusMark = this.makeCounter("bonusMark", text, cx, cy, color, 28) // not a "Counter"
  }
  removeBonusMark() {
    const bm = this.bonusMark;
    if (!!bm) {
      bm.parent.removeChild(bm)
      this.bonusMark = undefined
    }
  }
}

/** used by Card.makeCounter; uses CardMaker makeCoin. */
class CoinCounter extends ValueCounter {
  constructor(name: string, initValue?: string | number, color?: string, fontSize?: number, fontName?: string, textColor?: string) {
    super(name, initValue, color ?? C.coinGold, fontSize ?? Card.cardMaker.fontSizeForCoin(), fontName ?? Card.cardMaker.coinFont, textColor);
    // default boxSize() for Ellipse: high = text.MeasuredLineHeight() * 1.2; wide = ~1.3 * text.MeasuredWidth()
    // (fontSize = 45) --> high = 50--55; rad = 25--27;;  Coin(fs=37) --> rad = 23.17
  }

  protected override setBoxWithValue(value: string | number): void {
    // coin to (0, 0) on ValueCounter, which will be set/attached to Card
    // text offset/adjustments computed by makeCoin.
    const coin = Card.cardMaker.makeCoin(value, undefined, 0, 0, ); // makeCoin will adjust offsets & scaleX
    const [disk, text] = coin.children as [Shape, Text];
    this.box = disk;
    this.text.text = text.text
    this.text.x = text.x;
    this.text.y = text.y;
    this.text.font = text.font;
    // this.text.scaleX = text.scaleX; // for 'narrow' or 'compact' style
    // this.text.rotation = text.rotation;   // coins may rotate, but the counters do not.
    this.addChild(disk, this.text);
  }

}
export class Flag extends Card {
  static flagScale = .1      // display ownerCard as tiny
  static ownerFlagName(row:number, col:number):string { return "OWNER-FLAG" + row + ":" + col}

  /**
   * scale to a small square, and displace to upper-left corner (of given portait card)
   * @param card an "Owner" card from HOME-DECK
   * @param targetCard? displace to upper-left of targetCard
   * @param scale? override scale/size of generated Flag
   */
  // card is either a full-size Owner card, OR a Flag!
  constructor(ownerCard: Card, scale: number = Flag.flagScale) {
    super(ownerCard, 1, ownerCard.table)  // all the CardInfo fields [OwnerFlag cards are pretty simple]
    this.mouseEnabled = false
    this.scaleX = scale * this.height / this.width; // scaleX = scale * 1.5 = .15 [make it Square!]
    this.scaleY = scale;
    return
  }
  /**
   * set owner Flag on the target Card.
   * @param ownerCard full-size Owner card to shrink
   * @param targetCard attach the generated Flag to this Card
   * @param scale? override scale/size of generated Flag
   * @return the generated Flag ( == targetCard.ownerFlag)
   */
  static attachFlagToCard(ownerCard: Card, targetCard: Card, scale?: number): Flag {
    if (!!targetCard.ownerFlag) Flag.removeOwnerFlag(targetCard) // only 1 Flag per card!

    let flag = new Flag(ownerCard, scale) // new copy of ownerFlag
    if (targetCard instanceof Flag) {
      flag.scaleX = .6     // inner Flag is smaller
      flag.scaleY = .6     // inner Flag is smaller
      flag.x = flag.y = 45 // offset farther
    }
    const edge = Card.cardMaker.safe;
    flag.x = -targetCard.width / 2 + edge + flag.scaleX * flag.width / 2; // upper-left corner
    flag.y = -targetCard.height / 2 + edge + flag.scaleY * flag.height / 2;
    targetCard.ownerFlag = flag;                      // so removeFlag can find it
    targetCard.addChild(flag)
    targetCard.stage.update()
    return flag;
  }

  /** remove the ownerFlag from Card */
  static removeOwnerFlag(card: Card): Flag {
    let rem = card.removeChild(card.ownerFlag)
    delete card.ownerFlag
    return card.ownerFlag
  }
}

/** HouseTokens: house, triplex, apartment, high-rise, tower */
export class HouseToken extends Card {
  constructor(card: Card) {
    super(card, 1, card.table)  // all the CardInfo fields [OwnerFlag cards are pretty simple]
  }
  /** HouseTokens on tile, in ascending order of costn. */
  static onCard(tile: Card): HouseToken[] {
    let tokens = tile.slotInfo.stack.filter(dispObj => (dispObj instanceof HouseToken)) as HouseToken[]
    tokens.sort((a, b) => (a.costn - b.costn))
    return tokens
  }

  override useDropAt: boolean = true; // true if card.allowDropAt() is meaningful
  /** a HouseToken can drop in its origSlot (on srcCont) or on mainMap on a player's S.Housing tile */
  override allowDropAt(dstCont: CardContainer, row: number, col: number):boolean {
    // ASSERT: (this.type == S.house), srcCont is likely Table.mktHouse
    if (!!this.origSlot && dstCont == this.origSlot.cont) {
      let stk0 = dstCont.getStack(row, col)[0]
      if (dstCont.name == "mainMap" && (!stk0 || stk0.name != S.Housing)) {
        alert(`drop HouseToken should fail! mainMap[${row},${col}]`)
        console.warn(stime(this, ".allowDropAt:"), `drop HouseToken should fail! mainMap[${row},${col}]`, this)
        return false
      }
      return true // this.anchorToOrigSlot == true
    }
    if (dstCont.name != "mainMap") return true; // plyrProj: drop on container
    // mainMap: only on S.Housing of curPlayer && is room or upgrade capable
    let stack = dstCont.getStack(row, col)
    if (stack.length < 1) return false; // no [S.Housing] card at {row, col}

    let card = stack[0]
    if (card.name != S.Housing) return false  // card at {row, col} is not S.Housing
    // Hmm: cannot put HouseToken on S.Housing that is VCPlayer owned!
    // S.Housing mortgage is 1 or 2; so pay that off first
    // (although building a house would pay it off faster)
    if (!(TP.allowHouseOnVC ? card.table.curPlayer.isReallyOwner(card) : card.table.curPlayer == card.owner)) return false
    // do not drop a new house if it would displace a larger house:
    let houses = HouseToken.onCard(card), len = houses.length // assert: (length <= 2)
    return (len < TP.maxHousesOnCard || houses[0].costn < this.costn)
  }
  /** correct any overbuilding on the given [S.Housing] Tile */
  maybeUpgradeHousing(tile: Card) {
    let houses = HouseToken.onCard(tile)  // include 'this' in list of houses
    while (houses.length > TP.maxHousesOnCard) { // expect only ONCE through the loop
      let token = houses.shift(), mkt = tile.table.houseMkt // the cheapest token
      token.moveCardWithUndo(mkt, mkt.houseMktRow(token))   // UpgradeHousing: undo
      token.origSlot = undefined    // else HouseToken.allowDropAt() gets confused during robo-placements
    }
  }
  /** invoked during markLegalPlacements; 'this' IS on tile, but maybe NOT the cheapest card! */
  upgradeCredit(tile: Card): number {
    let tokens = HouseToken.onCard(tile), tok0 = tokens[0], tcost = (!!tok0 ? tok0.costn : 0)
    return ((tokens.length > TP.maxHousesOnCard) && (this.costn > tcost)) ? Math.floor(tok0.costn / 2) : 0
  }
  /** replace with smaller building (or nothing) */
  downgrade(): Card {
    let token = this, rtoken: Card
    let {cont, row, col, stack} = token.slotInfo // mainMap, row, col
    let mkt = token.table.houseMkt
    let ndx = mkt.names.findIndex(v => v == token.name)
    mkt.addHouse(token)    // put card back in market (remove from card & cont)
    // try replace with [successively] cheaper building:
    while (--ndx >= 0) {
      let rcard = mkt.bottomCardOfStack(ndx) // see if there's a rcard in the mkt
      if (rcard) {
        cont.addCard(rcard, row, col)   // should not affect limitHousing, nor fixHousingStack
        break
      }
    }
    token.calcHousingRentVp(stack)
    return rtoken; // or undefined if no cheaper Token available
  }
  private offsets = [
    { x: -1.1, y: 4 },
    { x: 1.1, y: 4 },
  ];
  /** Position Houses, then calc rent&vp AND childToTop each HouseToken card. */
  calcHousingRentVp(stack: Stack, si: SlotInfo = this.slotInfo) {
    // NOTE: houses are on the Stack: NOT children of the Card
    /** set rent/vp per housing: */
    const setOffsetRentVP = (house: HouseToken, ndx: number) => {
      const ofHouse = (offs: number) => offs * .5 * house.width * Card.scale;
      const offs = this.offsets[ndx];
      const offx = ofHouse(offs.x);
      const offy = ofHouse(offs.y) + (tile.ci.top - tile.height / 2) * Card.scale;
      const { cont, row, col } = si;  // for undo: ensure HouseToken is [back] on S.Housing tile...
      cont.moveAndSetSlotInfo(house, row, col, offx, offy);
      cont.addChild(house); // to top, above Housing tile
      rent += house.rent;
      vp += house.vp;
    }
    let rent: number = 0, vp: number = 0, tile = stack[0];
    stack.filter(c => c instanceof HouseToken).forEach(setOffsetRentVP);
    tile.rent = rent;
    tile.vp = vp;
  }
}


