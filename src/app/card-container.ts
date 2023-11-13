import { DragInfo, Dragger, Dragole, stime } from '@thegraid/easeljs-lib';
import { Container, DisplayObject, MouseEvent, Shape } from '@thegraid/easeljs-module';
import { C, Obj, S, WH, XY } from './basic-intfs';
import { Card, HasSlotInfo, SlotInfo, Stack } from './card';
import { CardEvent } from './card-event';
import { CI } from './card-maker';
import { CmClient } from './cm-client';
import { Table } from './table';
import { TP } from './table-params';

/** CardContainer(s) are generally grouped functionally in a ContainerAt.
 * The overCont is where we put Counters and Markers.
 */
export class ContainerAt extends Container {
  constructor(overCont?:Container) {
    super()
    this.overCont = overCont
  }
  isContainerAt: boolean = true;    // used in ScalableContainer ["isContainerAt"]
  /** the overCont for ContainerAt and it child CardContainer(s) */
  overCont: Container;
}
/** all the optional args for CardContainer constructor. */
export type CCopts = {
  slotsX?: number, slotsY?: number, color?: string, name?: string, size?: WH, margins?: WH,
  dropOnCard?: boolean | ((ce: CardEvent) => boolean), drag?: boolean, markColor?: string,
  backCard?: boolean | Card, backClick?: boolean, bg?: boolean, bgclick?:(e:MouseEvent) => void
}

/** Shape indicating which Slot is selected for Drop. */
class DropMark extends Shape implements HasSlotInfo {
  slotInfo: SlotInfo
  width: number   // perhaps never used...
  height: number
  constructor(color: string, wh: WH, parent: Container) {
    super()
    this.graphics.beginFill(color).drawRect(-wh.width / 2, -wh.height / 2, wh.width, wh.height)
    this.width = wh.width
    this.height = wh.height
    this[S.Aname] = parent.name
    this['Myid'] = this.id
    this['Parid'] = parent.id
  }
  setSlotInfo(info: SlotInfo): SlotInfo { return this.slotInfo = info }
}

// may be a Child on a ScalableContainer
/** Container for Arrays of Stack... */
export class CardContainer extends Container {
  // default constructor for Container
  // addStuff({deck: Deck, slotsX: , slotsW: })
  // exposeNextCard (shows on face of deck-slot) .swapChildren(Child-n, Child-n-1)
  // setChildIndex(child-n, n-1)
  static dragger: Dragger         // used by addCard()
  isCardContainer = true;         // used in ScalableContainer:  parent["isCardContainer"]
  /** name for reference */
  //name: string;
  back: Card; // display as Button on top of dispensing stack, set size
  mark: DropMark; // display as Mark where dragging Card will Drop.
  overCont: Container; // where we put markers and counters... this.overCont = (this.parent.overCont || this)
  targetMark: DisplayObject;       // indicates this Container is a DropTarget
  get regName(): string { return this.name }

  static defMarkColor: string = "rgba(80,80,80,.3)";
  private defMarginSize: WH = {width: 8, height: 8};
  private defCardSize: WH = {width: 525, height: 750};
  marginSize:WH = {} = this.defMarginSize
  slotSize: WH;
  cardSize: WH;

  slotsX:number = 1;
  slotsY:number = 1;
  backWidth:number = this.defCardSize.width;
  backHeight:number =this.defCardSize.height;

  /** true if Card was dropped back into origSlot. */
  dropToOrigSlot:boolean = false;

  // CardContainer is mostly this cardArray; a Stack[][]
  private cardArray: Array<Array<Stack>>;
  private makeRowColStacks(rows:number, cols:number):Array<Array<Stack>> {
    return [...Array<Array<Stack>>(rows)].map(row => [...Array<Stack>(cols)].map(col => new Stack()));
  }
  /** post-constructor initializer; called by Table.makeCardCont(...) */
  init(table: Table) {}

  /**
   * Signal an event on [this] CardContainer/stack.
   * Typically: clicked, flipped, moved, removed, dropped or emptystack.
   * @param cont the event.target: defaults to this CardContainer
   * @returns
   */
  dispatchCardEvent(S_type: string, card: Card, row: number, col: number, cont: CardContainer = this): boolean {
    //console.log(stime(this, ".dispatchCardEvent:"), type, "'"+card.name+"'", this.name , row, col)
    return this.dispatchEvent(new CardEvent(S_type, card, row, col, cont));
  }

  /**
   * Container for a Deck and places to put some of its Cards.
   * Not required to supply a Deck, but something to set the (slotW, slotH)
   *
   * Add a Mark (shadow) DispObj with Shape matching slotSize
   *
   * If Back exists:
   *    Put Back card on Top.
   *    Click on Back exchanges to bring up next from shuffled Deck
   *    Back cannot be Dragged away.
   *
   * Click & Drag on Top Card
   * Dragfunc check for legal drop locations.
   *    Else drops back to Top of stack...
   *
   * @param source determines cardSize () overridden by size:
   * @param opts CCopts { slotsX: , slotsY: , size: , margins: , name:, bg: }
   * @param opts.bg if supplied: make a background shape (of color: ) to catch MouseEvent (click & drag)
   * @param opts.bgclick clickHandler Function. If supplied: bg.on(S.click, bgclick)
   * @param opts.backClick if true, add on(S.clicked, this.backClicked) [flipped a Card]
   * @param opts.dropOnCard set this.allowDropOnCard: Function(CardEvent) or false: disallow drop on card.
   */
  constructor(source: Stack | Card[] | WH, opts: CCopts = {}) {
    super()
    this.tickEnabled = false     // we aren't ticking anything... esp 85 Card children
    this.tickChildren = false    // we aren't ticking anything... esp 85 Card children
    this.name = opts.name || "un-named";
    this["aname"] = this.name         // easier to find in Chrome console debugger
    this.slotsX = opts.slotsX || 1;
    this.slotsY = opts.slotsY || 1;
    this.cardArray = this.makeRowColStacks(this.slotsY, this.slotsX)
    this.marginSize = opts.margins || this.defMarginSize
    //console.log(stime(this, ".constructor0 this="), this.name, opts.size, source, opts)
    // get size (from WH or BackCard & populate stack)
    this.setSizeFromSource(source, opts.size) // uses this.marginSize:WH to get slotSize
    //console.log(stime(this, ".constructor1 this="), this.name, this)

    let background:DisplayObject
    if (opts.bg) {
      background = this.makeBackground(opts.color || "lightgrey") // {slotsX * slotSize.x, slotsY * slotsSize.y}
      this.addChildAt(background, 0)
    }
    if (opts.bgclick) {
      this["bgClick"] = background.on(S.click, opts.bgclick)
      this["bgclick"][S.Aname] = "bgclick"
    }
    this["onClick"] = this.on(S.click, this.mouseClickOnCC, this) // convert MouseEvent.click -> CardEvent.clicked
    this["onClick"][S.Aname] = "mouseClickOnCC"

    this.addMark(0, 0, opts.markColor);  // after setSizeFromSource
    if (opts.backCard && this.back) {
      this.setupBack(this.back || (opts.backCard as Card), opts.backClick);
    }
    this.enableCardDrag = opts.drag
    this.allowDropOnCard = opts.dropOnCard
  }
  /** when allowDropCard, this holds the created on("dropped") Listener,
   * suitable for this.removeListener(this.onDroppedListener)
   * there may also be: this["onDropped"] for user applied "on" listener
   */
  // onDroppedListener: Function;

  /** offset to center of [row, col]] */
  slotCenter(row=0, col=0):XY {return { x: (col + .5) * this.slotSize.width , y: (row + .5)* this.slotSize.height}}
  fullWidth(mar = 0, slotsX=0):number { return          (mar + slotsX*this.slotSize.width )+ this.slotsX * this.slotSize.width }
  fullHeight(mar = 0, slotsY=0):number{ return          (mar + slotsY*this.slotSize.height)+ this.slotsY * this.slotSize.height}

  leftEdge(mar = 0, slotsX=0):number  { return this.x - (mar + slotsX*this.slotSize.width )}
  rightEdge(mar = 0, slotsX=0):number { return this.x + (mar + slotsX*this.slotSize.width )+ this.slotsX * this.slotSize.width }
  topEdge(mar = 0, slotsY=0):number   { return this.y - (mar + slotsY*this.slotSize.height)}
  bottomEdge(mar = 0,slotsY=0):number { return this.y + (mar + slotsY*this.slotSize.height)+ this.slotsY * this.slotSize.height}

  /** evaluate slotFunc for each row, col, Stack in this CardContainer.
   * @param slotFunc if returns a true value, terminate the loop: find in all stacks
   * @return undefined OR slotInfo where slotFunc returned true
   */
  forAllStacks(slotFunc: ((row: number, col: number, stack: Stack) => void | boolean)): SlotInfo {
    for (let row = 0; row < this.slotsY; row++) {
      for (let col = 0; col < this.slotsX; col++) {
        // for each mainMap slot: [calc cost/legality of building card in that slot]
        let stack = this.getStack(row, col)
        let rv = slotFunc(row, col, stack)
        if (rv) return {cont: this, row, col, stack}
      }
    }
    return undefined;
  }
  /** make new DropMark(slotSize.WH) at x,y (depth=1) being the bottom or nearly so. */
  addMark(row=0, col=0, markColor = CardContainer.defMarkColor) {
    let mark = this.mark = new DropMark(markColor, this.slotSize, this)
    mark.name = "Mark"
    // breakpoint in dragger can leave DropMark exposed; hide it:
    // hmm: when it Card moved to DragCont?
    let hideNow = () => { this.hideMark('clickToHide'); this.stage.update(); }
    mark.on(S.click, hideNow, this)[S.Aname] = "hideMark"
    this.addChild(mark)
    this.hideMark('addMark')
    this.moveAndSetSlotInfo(mark, row, col)
    //console.log(stime(this, ".addMark: mark="), mark)
  }

  /** At most *one* CardContainer is showing a Mark. */
  get curMark(): SlotInfo { return this.stage && this.stage['table']['curMark'] as SlotInfo}
  set curMark(mrk: SlotInfo) { if (!!this.stage && this.stage['table']) this.stage['table']['curMark'] = mrk }
  /** @return true if this CC's mark is showing. */
  sameMark(row: number = this.mark.slotInfo.row, col: number = this.mark.slotInfo.col): boolean {
    return !!this.curMark && this.curMark.cont == this && this.curMark.row == row && this.curMark.col == col;
  }

  hideMark(source: string = "trace") {
    this.mark.visible = false
    this.setChildIndex(this.mark, 1) // above something...? cont.bg
    this.curMark = undefined
    //console.log(stime(this, `.hideMark --- visible=${this.mark.visible}`), this.fromShow)
    // if (!['const', 'show'].includes(source) ) {
    //   let gid = `hideMark: ${source} ${this.name}`
    //   console.groupCollapsed(gid)
    //   console.log(stime(this, `.hideMark cont=${this.name} Myid=`), this.mark["Myid"], "Parid=", this.mark["Parid"])
    //   console.trace(gid)
    //   console.groupEnd()
    // }
  }
  /** Make mark visible & on top of this CardContainer */
  showMark() {
    if (!!this.curMark && !this.sameMark()) {
      this.curMark.cont.hideMark('show')
    }
    this.mark.visible = true
    this.childToTop(this.mark)
    this.curMark = this.mark.slotInfo;
    this.curMark['Myid'] = this.mark['Myid']
    this.curMark['Parid'] = this.mark['Parid']
    console.debug(stime(this, `.showMark --- visible=${this.mark.visible}`), "curMark=", this.curMark )
  }
  /**
   * For facedown stacks: TileDeck & PolicyDeck
   *
   * put Back at loc[0][0], but NOT a member of cardArray[0][0]
   * on(S.clicked), pop and expose top of stack[row][col] (from below back)
   * @param backClick if true, add on(S.clicked, this.backClicked)
   */
  setupBack(back: Card, backClick?: boolean) {
    if (!back) return
    //console.log(stime(this, ".setupBack back="), back)
    // this.addCard(back, 0, 0, -1) // NO! this would put 'back' on the Stack[0][0]
    this.addChild(back)             // as Top Child
    this.moveCardToSlot(back, 0, 0) // display at Location of slot, but not on Stack.
    if (backClick === true) {
      this.on(S.clicked, this.drawOnBackClicked, this)[S.Aname] = "drawOnBackClicked" // setupBack
    }
  }

  /** @return bottom card OR undefined if stack is empty */
  bottomCardOfStack(row: number = 0, col: number = 0, stack: Stack = this.getStack(row, col)): Card | undefined {
    return stack[0]
  }
  /** @return top card OR undefined if stack is empty */
  topCardOfStack(row: number = 0, col: number = 0, stack: Stack = this.getStack(row, col)): Card | undefined {
    return stack.length > 0 ? stack[stack.length-1] : undefined
  }
  /** return topCardOfStack; S.EmptyStack may shuffle TileDeck. */
  prepareNextCard(row: number = 0, col: number = 0): Card | undefined {
    let card: Card, stack = this.getStack(row, col)
    if (stack.length <= 0) {
      this.dispatchCardEvent(S.EmptyStack, undefined, row, col) // reshuffle if TP.recycleCards
      // "EmptyStack" has been dispatched; try again:
    }
    return this.bottomCardOfStack(row, col, stack)
  }
  /** if (e.currentTarget instanceof CC) e.currentTarget.parseMouseClick() */
  parseMouseClick(e: MouseEvent): CardEvent {
    let pxy = this.globalToLocal(e.stageX, e.stageY)
    let row = this.cardSlotRow(pxy.y)
    let col = this.cardSlotCol(pxy.x)
    let obj = (e.target as DisplayObject)    // click on bitmap(Card), or shape(bg), or shape(ValueCounter)
    // ASSERT: the only Bitmap above a CardContainer is on a Card
    let card: Card = (obj instanceof CI) ? obj.parent as Card : undefined;
    return new CardEvent(S.click, card, row, col, this)
  }
  // CC.on(S.click, mouseClickOnCC, this)
  /** convert MouseEvent(S.click,x,y) to CardEvent(S.clicked, card, row, col) */
  // For: Player.distArranger: load/unload
  // For: mainMap.demolishIt, auctionP0, clickOnMkt (accelerate DanD)
  // For: policyDeck, tileDeck: flip & process card
  // Polis/Draw Counters use: -> clickedOnContainer (accelerate 'flip' of policyDeck/tileDeck)
  mouseClickOnCC(e: MouseEvent, slotInfo?: SlotInfo) {
    let { card, row, col } = this.parseMouseClick(e)
    if (!(card instanceof Card)) return // ignore...
    //console.log(stime(this, ".mouseClickOnCC: card="), (card ? card.name : card), row, col, e.currentTarget.name, e.eventPhase, e.timeStamp, e)
    card.setOrigSlot({ cont: this, row: row, col: col } )// equivalent to dragStart -> dragFunc0, so can find srcCont
    // preGame click is for onPlyrDistClicked->distArranger.un/load
    // if (!card.table.preGame && card.table.isNetworked((cmClient) => {
    //   cmClient.send_clik(this, row, col) // comes back as cmClient.eval_clik() [with params = autoCards]
    // })) return  // ignore GUI click when notCurPlayer/ref
    this.dispatchCardEvent(S.clicked, card, row, col, this)
  }

  // setupBack: if (back && backClick) on(S.clicked, e => this.drawOnBackClicked(e), this}
  /**
   * on S.clicked: when user clicks directly on a face-down (Tile/Policy) stack.
   *
   * Including thru cmClient.eval_clik:
   *  S.click -> clickedOnContainer -> [send_clik -> eval_clik] -> S.clicked -> drawOnBackClicked
   *
   * prepareNextCard [maybe shuffle]; dispatchCardEvent(S.flipped)
   */
  drawOnBackClicked(ce: CardEvent) {
    //console.log(stime(this, ".backClicked: e="), e.type, e, "\n   card=",e.card.name, "== back?", (e.card == this.back));
    // TODO: store the "stack" of Cards without doing cc.addCard() [reduce tick/paint overhead]
    // and at this point, do the addCard()
    if (ce.card === undefined || ce.card != this.back) return
    let card = this.prepareNextCard(ce.row, ce.col) // maybe emit S.EmptyStack to reshuffle
    // Hmm, with empty stack, Back card is not visible, should be no 'click' on this stack.
    if (card === undefined) alert(`CC.drawOnBackClicked: empty stack`)
    let useAutoCardName = (cmClient: CmClient) => {
      cmClient.useAutoCard((name: string) => { card = this.flipCardWithName(name, ce.row, ce.col) })
    }
    let setAutoCardName = (cmClient: CmClient) => {
      return cmClient.setAutoCard(card.name, true)// or false... does not matter in this case as rv is not checked
    }
    ce.card.table.isNetworked(useAutoCardName, useAutoCardName, setAutoCardName)
    this.dispatchCardEvent(S.flipped, card, ce.row, ce.col) // -> table.drawFlipped() -> addCard/setDropTargets
    if (ce.cont.stage) ce.cont.stage.update()
  }
  /**
   * CmClient support: Find named card, addToTop, emit S.flipped(card)
   *
   * Follow the referee: flip/shuffle and find the named card
   * @return the named Card or undefined if not found in stack
   */
  flipCardWithName(name: string, row: number, col: number): Card | undefined {
    let stack = this.getStack(row, col)
    this.prepareNextCard(row, col) // maybe reshuffle, maybe hide back
    let c0 = this.bottomCardOfStack(row, col) // prefer 'next' card, esp for plyr.plyrDist
    let card = (c0 && c0.name === name) ? c0 : stack.findCard(name) // as above
    if (!card) return undefined
    this.addCard(card, row, col)  // put back on top of stack...
    this.dispatchCardEvent(S.flipped, card, row, col) // For TileDeck & PolicyDeck
    if (this.stage) this.stage.update()
    return card
  }

  /** get the Stack of Cards at [row][col] */
  getStack(row:number=0, col:number=0):Stack {
    return this.cardArray[row][col];
  }

  static getSlotInfo(card:Card | DisplayObject):SlotInfo {
    if (card instanceof Card) {
      return card.getSlotInfo() as SlotInfo
    } else {
      return card["slotInfo"] as SlotInfo
    }
  }

  /**
   * Set logical membership, adjust image coords, record current location:
   * getStack(row,col).push(card); moveCardToSlot(card,row,col); setSlotInfo(card,row,col)
   *
   * dispatchCardEvent(S.moved, card, row, col) when a Card is moved onto Stack.
   */
  putCardOnStack(card: Card, row: number, col: number) {
    let stack: Stack = this.getStack(row, col)
    stack[0] && (stack[0].visible = false) // hide previous card
    stack.unshift(card);
    card.visible = true
  }

  /** inverse of cont.addCard(card, row, col): remove card from its SlotInfo Stack.
   * set card.origSlot
   * dispatchCardEvent(S.removed, card, row, col)
   *
   * @return true if card was found, removed, and dispatchCardEvent(S.removed)
   */
  removeCardFromSlot(card: Card): boolean {
    let info: SlotInfo = card.getSlotInfo()
    if (!info || !info.stack) {
      return false;               // already removed
    }
    card.setOrigSlot(Obj.fromEntriesOf(card.slotInfo))
    let rv = info.stack.removeCardFromStack(card) // splice as needed, delete slotInfo
    info.cont.dispatchCardEvent(S.removed, card, info.row, info.col)
    if (info.stack.length > 0) {
      info.stack[0].visible = true
    } else if (!!this.back) {
      this.back.visible = false      // disable click on stack. NOTE: this.back implies a single stack in this Container...
    }
    return rv
  }

  /**
   * setChildIndex(child, numChildren -1 + down)
   * @param child
   * @param down 0: Top card, -1: behind Top Card
   */
  childToTop(child: DisplayObject, down:number = 0) {
    // put to top of Children, is -1 needed/correct?
    this.setChildIndex(child, this.numChildren -1 + down);
  }

  /**
   * Stack all (non-Back) cards in the indicated Slot as childToTop.
   *
   * Display "Back" at slot[row][col], but do NOT add back to stack[row][col].
   * @param cards
   * @param row = 0
   * @param col = 0
   * @return the resulting Stack at [row][col]
   */
  stackCards(cards: Card[], row: number = 0, col: number = 0): Stack {
    // stack all the Cards in slot [0][0]
    cards.concat().forEach(card => { // addCard->removeCard: modifies original cards array!
      if (card.type != "Back") {
        this.addCard(card, row, col) // --> putCardOnStack: remove from prior using slotInfo
      }
    });
    if (!!this.back) {
      // move back over slot(row,col) and bring to Top; DO NOT addCard to stack[row][col]
      this.moveCardToSlot(this.back, row, col)
      this.childToTop(this.back)
      this.back.visible = (this.getStack(row, col).length > 0)
    }
    if (this.stage) this.stage.update();
    return this.getStack(row, col);
  }

  /**
   * Set a mouse-hittable background suitable for Dragging.
   * Also shows extent of the Container.
   * @param color
   */
  makeBackground(color:string, wh: WH = this.slotSize): DisplayObject {
    // specify the Area that is Dragable (mouse won't hit "empty" space)
    let wide = this.slotsX * this.slotSize.width
    let high = this.slotsY * this.slotSize.height
    let bg = new Shape()
    bg.graphics.beginFill(color).drawRect(0, 0, wide, high)
    bg.name = this.name + "-background"
    return bg
  }
  /** set slotW, slotH;
   * either supply cardSize:WH, or a source:Card (with width/height) or a Stack with a Back card.
   *
   * If stack is Card[] or Stack then this.stackCards(stack)
   * @param source Stack or Card[] (w/width)
   * @return this.back if it was found.
  */
  private setSizeFromSource(source: Card[] | Stack | Card | WH, cardSize?: WH): Card {
    //console.log(stime(this, ".setSizeFromSource="), source)
    if (!!cardSize) {
      this.setSlotSize(cardSize)
    } else if ((source as Card | WH).width !== undefined) {
      //console.log(stime(this, ".setSizeFromSource Card="), source)
      this.setSlotSize(source as Card | WH)
    } else if (
      (source instanceof Stack) &&
      source[0].image !== undefined) {
      // source has images (or will have); get slotSize from Back
      // console.log(stime(this, ".setSizeFromSource Stack="), source)
      this.setSlotSizeFromBack(source, cardSize)
    }
    if (source instanceof Array) {
      // however the size was determined (cardSize or Back), stack the cards the CardContainer
      this.stackCards(source as Stack)
    }
    return this.back;
  }
  /** Try find a "Back" Card and get size from that.
   * else use the bottom card or else use defSize
   */
  private setSlotSizeFromBack(stack: Card[], defSize:WH= this.defCardSize) {
    this.back = (stack.find(c => c.type == "Back"))
    let wh: WH = this.back
    if (!wh) {
      const card = stack[0];
      wh = card ? { width: card.width * card.scaleX, height: card.height * card.scaleY } : defSize;
    }
    //console.log(stime(this, ".setSlotSizeFromBack="), wh, "this.back=", this.back)
    this.backWidth = wh.width;
    this.backHeight = wh.height;
    this.setSlotSize(wh);
  }
  /**
   * set cardSize [from Card|WH] and slotSize [adding this.marginSize]
   * Use this.defSlotSize if cannot resolve from Card | WH
   * @param card with width, height set (a "Back" card)
   */
  setSlotSize(card: Card | WH) {
    this.cardSize = {
      width:  (card.width  ?? this.defCardSize.width),
      height: (card.height ?? this.defCardSize.height)
    }
    this.slotSize = {
      width:  this.cardSize.width  + this.marginSize.width,
      height: this.cardSize.height + this.marginSize.height
    }
    //console.log(stime(this, ".setSlotSize:  this.slotSize="), this.slotSize)
  }
  private cardSlotRowLimit(row:number) {
    return Math.min(this.slotsY-1, Math.max(0, row));
  }
  private cardSlotColLimit(col:number) {
    return Math.min(this.slotsX-1, Math.max(0, col));
  }

  cardSlotRow(y: number): number {
    let row = Math.floor(y / this.slotSize.height)
    return this.cardSlotRowLimit(row);
  }
  cardSlotCol(x: number): number {
    let col = Math.floor(x / this.slotSize.width)
    return this.cardSlotColLimit(col);
  }

  /** CardContainers that card from this are allowed to drop on. */
  private dropTargets:Array<CardContainer> = Array<CardContainer>(0)
  /**
   * Allow dragging Card from this CardContainer to the given CardContainers.
   * This CardContainer and the targets must share ScaledContainer/dragLayer.
   * @param conts a CardContainer[]
   */
  setDropTargets(... conts: CardContainer[]) {
    this.hideTargetMarks()      // hide and remove previous dropTargets
    this.dropTargets = [];
    if (conts.length > 0) {
      this.dropTargets = conts.concat(this) // if any dropTargets, include 'this' (self-drop)
      // this.dropTargets.push(this) ;
      // this.dropTargets = this.dropTargets.concat(conts)
      this.showTargetMarks()                // if any dropTargest, show them
    }
  }
  addDropTarget(cont: CardContainer) {
    this.dropTargets.push(cont)
  }
  removeDropTarget(cont: CardContainer) {
    let ndx = this.dropTargets.findIndex((c,i,o) => c == cont)
    if (!!ndx) this.dropTargets.splice(ndx, 1)
    cont.hideTargetMark()
  }

  // protected in ValueCounter
  makeBox(color: string, high: number, wide: number): DisplayObject {
    const shape: Shape = new Shape();
    shape.graphics.f(color).de(-wide/2,  -high/2, wide, high); // drawEllipse()
    return shape;
  }
  /** show which containers are selected as DropTargets. */
  makeTargetMark(targetMark: DisplayObject =  this.makeBox(C.targetMark, 60, 60)) {
    targetMark.x = this.slotSize.width/3;
    targetMark.y = this.slotSize.height/3;
    this.targetMark = targetMark;
    this.hideTargetMark()
  }
  showTargetMark(): void {
    if (!this.targetMark) this.makeTargetMark(); // but without scaleCont.addUnscaled(this.targetMark)
    this.addChild(this.targetMark) // put beneath this.overCont OR: addToOverCont!?
    this.targetMark.visible = true
  }
  hideTargetMark() {
    if (this.targetMark) this.targetMark.visible = false
  }
  /** show TargetMark on each DropTarget */
  showTargetMarks() {
    this.dropTargets.forEach(cont => (cont instanceof CardContainer) && cont.showTargetMark())
  }
  /** hide TargetMark on each DropTarget */
  hideTargetMarks() {
    this.dropTargets.forEach(cont => (cont instanceof CardContainer) && cont.hideTargetMark())
  }
  /**
   * See if given Container is on list of this.dropTargets
   * @return cont:CardContainer or undefined
   */
  isDropTarget(cont: CardContainer): boolean {
    //console.log(stime(this, ".isDropTarget: cont="), cont)
    return this.dropTargets.includes(cont);
    //return !!this.dropTargets.find((tcont:CardContainer) => (tcont == cont))
  }

  /** for pretty printing in logs (static utility) */
  floorPoint(pt:{x: number,y: number}) {
    pt.x = Math.floor(pt.x); pt.y = Math.floor(pt.y)
    return pt
  }

  /**
   * A point in this.parent local coordinates
   * @param x
   * @param y
   */
  containsPoint(x: number, y: number) {
    return (this.x < x && x < this.rightEdge() && this.y < y && y < this.bottomEdge())
  }
  /**
   * Identify potential dropTarget CardContainers under the Card.
   * Initial cont is SC: (parent of dragLayer) with children that are CC or intermdiate (ContainerAt | Card)
   * from there we drill down through intermediate child-containers to find .containsPoint
   * (like the 'capture' phase in createjs to find 'target')
   * @param card the Card being dragged
   * @param cont ScalableContainer holding dragLayer (recurse w/other Card|CardContainer|ContainerAt)
   * Table: new Dragger(scaleC); // so dragCont is child of ScaleableContainer
   */
  srcCardContainersAtPoint(card: Card, cont: Container): CardContainer[] {
    let tx = card.x, ty = card.y; // note: regX = width/2, regY=height/2
    let pt = card.parent.localToLocal(tx, ty, cont)
    let rv: CardContainer[] = Array<CardContainer>()
    // reduce(map(filter))
    let children:DisplayObject[] = cont.children
    children.forEach((dispObj: DisplayObject | Container) => {
      // display tree is [Scalable]Container->ContainerAt->CardContainer->Card->DebtContainer:CardContainer
      // do not need to descend into ValueCounter or any non-Container
      if (!(dispObj instanceof ContainerAt || dispObj instanceof CardContainer || dispObj instanceof Card)) return
      let pcont = dispObj
      if ((pcont instanceof CardContainer) && pcont.containsPoint(pt.x, pt.y)) {
        rv.push(pcont)  // found a candidate CardContainer
      }
      // look for nested CardContainer children under point:
      let cconts = this.srcCardContainersAtPoint(card, pcont)
      rv = rv.concat(cconts)
    })
    //console.log(stime(this, ".cardContainersAtPoint: card.name="), card.name," cont=", cont, rv.length,"\n   CConts=", rv)
    return rv
  }

  //0-all, 1-respect mouseEnabled/mouseChildren, 2-only mouse opaque objects.
  //* @return {DisplayObject} The top-most display object under the specified coordinates.
  /**
   * Find CardContainer in dropTargets of original dragStart CardContainer.
   * @param card the Card being dragged (child of drag layer)
   * @param src the Card's dragStart container: dragCtx.srcCont, the original parent.
   * @return CardContainer or undefined
   */
  srcDropTargetUnderCard(card: Card): CardContainer {
    // while dragging, card is on dragger.dragCont above all the CardContainers.
    // seeking mouse-hittable, mouse-eventable; so: Card or CardContainer.background
    // either way, obj.parent would be a CardContainer.
    // if that container is in our dropTargets, then we delegate to that one.
    // card.parent.parent == ScaleableContainer (== dragger.dragCont.parent)
    let targets: CardContainer[] = this.srcCardContainersAtPoint(card, card.parent.parent)
    //console.log(stime(this, ".srcDropTargetUnderCard: src="), src.name, /*src, "\n  ", */ "targets=", targets.map(e=>e.name))
    let allowDrop = (ccont: CardContainer, card: Card) => {
      let {row, col} = ccont.calcSlotInfo(card)
      return ccont.allowDropAt(row, col, card)
    }
    let target: CardContainer = targets.find((ccont: CardContainer) => {
      //console.log(stime(this, ".srcDropTargetUnderCard find target: ccont="), ccont.name, ccont, "\n       is drop=", !!src.isDropTarget(ccont))
      return (this.isDropTarget(ccont) && allowDrop(ccont, card))
    })
    return target;
  }
  /** coordinates of center of slot offset by {offx, offy} */
  slotXY(row: number, col: number, offx = 0, offy = 0): XY {
    return { x: (col + 0.5) * this.slotSize.width + offx, y: (row + 0.5) * this.slotSize.height + offy }
  }
  /** coordinate of upper-left of slot offset by {offx, offy} */
  slotXY0(row: number, col: number, offx = 0, offy = 0): XY {
    return { x: (col) * this.slotSize.width + offx, y: (row) * this.slotSize.height + offy }
  }

  /** move slotObj to center of row, col; possibly offset by (xoff, yoff)
   * @param slotObj a Card or Mark [implements HasSlotInfo]
   * @param offx offset from center
   * @param offy offset from center
   * @return SlotInfo
  */
  moveAndSetSlotInfo(slotObj: HasSlotInfo, row:number, col:number, offx=0, offy=0):SlotInfo {
    slotObj.x = (col + 0.5) * this.slotSize.width + offx;
    slotObj.y = (row + 0.5) * this.slotSize.height + offy;
    //console.log(stime(this, ".moveDispObjToSlot"), row, col, offx, dispObj.x, "\n   card=", dispObj)
    let stack: Stack = this.getStack(row, col)
    let slotInfo = { aname: this.name, cont: this, row, col, stack } as SlotInfo
    return slotObj.setSlotInfo(slotInfo)
    // See also: card.fillInfo
  }
  /** display Card in center of slot; rotate to align with slot orientation.
   *
   * setSlotInfo(card, row, col)
   */
  moveCardToSlot(card: Card, row: number, col: number): SlotInfo {
    let cardPort: boolean = (card.width < card.height) // is card normally Portrait mode?
    let slotPort: boolean = (this.cardSize.width < this.cardSize.height)
    let slotSquare: boolean = (this.cardSize.width == this.cardSize.height)
    let cardSquare: boolean = (card.width == card.height)
    if (card.rotation != 180)
      card.rotation = (!card.width || slotSquare || cardSquare || (cardPort == slotPort)) ? 0 : -90
    return this.moveAndSetSlotInfo(card, row, col)
  }

  /**
   * move card to this.mark slot; addCard will dispatch S.moved event.
   * if this == orig Container, set this.dropToOrigSlot=true
   *
   * ASSERT: the only time can drop a card in *new* slot of orig container is distArranger
   * So: although we only check 'dropToOrigCont' that is sufficient. [ anchorToOrigSlot !]
   *
   * NOTE: showMarkIfAllowDrop() enforces
   *     if (anchorToOrigSlot && dropCont == origCont) => (markSlot = origSlot)
   * NOTE:  (anchorToOrigSlot == true) except for distArranger
   * (even if allowDropAt(row, col) says it would be OK)
   *
   * @param card is on this CardContainer, but x,y is not aligned (with row, col)
   * @param srcCont where card was on dragStart
   */
  dropCardInMarkSlot(card: Card, srcCont: CardContainer) {
    this.dropToOrigSlot = (this == srcCont)  // of this (destCont) == srcCont (origSlot.cont)
    let { row, col } = this.mark.slotInfo
    //console.log(stime(this, ".dropCardInMarkSlot: slot="), {row, col}, "\n   card=", card.name, card)
    this.addCard(card, row, col) // moveCardToSlot! S.moved event
  }

  /** if false: always call allDropOnCard function */
  useDropCache: boolean = true
  allowDropCacheTrue: SlotInfo;
  allowDropCacheFalse: SlotInfo;

  /**
   * find row, col from card.xy;
   * @param card the card being dragged/dropped
  */
 calcSlotInfo(card: DisplayObject): SlotInfo {
    let obj_pt = card.parent.localToLocal(card.x, card.y, this)
    let row = this.cardSlotRow(obj_pt.y)
    let col = this.cardSlotCol(obj_pt.x)
    return {cont: this, row: row, col: col, stack: this.getStack(row,col)} as SlotInfo
  }

  /** Generally, we don't allow to move Card in its source container. */
  anchorToOrigSlot: boolean = true
  /** if false, do not allow to drop on an occupied slot. card.allowDropAt() overrides */
  allowDropOnCard: boolean | ((ce:CardEvent) => boolean) = true

  /**
   * return true if OK to drop a card on this[row, col].
   * override with card.useDropAt ? card.allDropAt()
   * override with this.allowDropOnCard, which may be a function.
   * @return true if OK to move this.mark (& Card) to this[row, col]
   */
  allowDropAt(row: number, col: number, card: Card): boolean {
    if (card.useDropAt) return card.allowDropAt(this, row, col); // {HouseToken, Debt}.allowDropAt()
    if (this.allowDropOnCard === true) return true;
    if (this.allowDropOnCard === false) return this.getStack(row, col).length < 1;
    if ((typeof this.allowDropOnCard) == "function") {
      //let info = CardContainer.getSlotInfo(card); // dragStart location!
      let info = { cont: this, row: row, col: col, stack: this.getStack(row, col) } as SlotInfo
      if (this.allowDropCache(this.allowDropCacheTrue, info)) return true
      if (this.allowDropCache(this.allowDropCacheFalse, info)) return false
      //console.log(stime(this, ".allowDropAt: test allowDropOnCard"), row, col, this.name);
      let allow = this.allowDropOnCard(new CardEvent("allowDropAt", card, row, col, this)) // not a dispatchable Event...
      if (allow) { this.allowDropCacheTrue = info } else { this.allowDropCacheFalse = info }
      return allow;
    }
    return true;
    //return this.allowDropOnCard || !this.getStack(row, col)[0]
  }
  allowDropCache(cache:SlotInfo, info:SlotInfo):boolean {
    if (!cache || !this.useDropCache) return false
    let {cont, row, col} = cache
    return (info.cont === cont && info.row === row && info.col === col)
  }
  /** drag func for Cards over CardContainer: move this.Mark to loc(card.x,y)
   * @param card is child of SC.dragContainer, but was last 'over' this CardContainer
   * @return true if found a new DropSlot; Mark has updated SlotInfo
  */
  showMarkIfAllowDrop(card: Card):boolean {
    let {row: orow, col: ocol, cont: ocont} = card.origSlot
    let {row, col} = this.calcSlotInfo(card)            // {row,col} if card is in this CardContainer
    let allowDrop: boolean = true
    if (this.anchorToOrigSlot && ocont == this) {
      row = orow; col = ocol   // most containers don't allow moving previously dropped card to new slot
    } else {
      allowDrop = this.allowDropAt(row, col, card)
    }
    if (allowDrop) {
      let sameMrk = this.sameMark(row, col), visMrk = this.mark.visible, mid = this.mark.id
      if (!sameMrk || !visMrk) {
        console.debug(stime(this,".showMarkIfAllowDrop:"), row, col, this.curMark, this.mark.slotInfo, mid, sameMrk, visMrk)
        this.showMarkAtSlot(row, col); // immediately show local table, update mark.slotInfo/visible
        // Only send_mark if there's a on[S.netDrop] listener on container (not for distArranger!)
        if (!!this[S.netDrop])  // has on.S.netDrop listener
          card.table.isNetworked((cmClient) => cmClient.send_mark(this, row, col))   // nocc
        console.debug(stime(this, ".showCardDropSlot: mark.visible="), this.mark.visible, this.mark)
      }
      return true
    }
    return false
  }
  /** show potential move or drop site. */
  showMarkAtSlot(row: number, col: number) {
    if (this.sameMark(row, col) && this.mark.visible) return
    this.moveAndSetSlotInfo(this.mark, row, col) // mark record last legitmate Drop Slot
    this.showMark()
    this.stage.update()
  }
  /** briefly show mark, then hide it. */
  flashMarkAtSlot(row: number, col: number, dwell: number = TP.flashDwell, after = () => {}) {
    this.showMarkAtSlot(row, col)
    setTimeout(() => {this.hideMark('flash'); this.stage.update(); after()}, dwell)
  }

  /**
   * If Card is over a new dragCtx.srcCont.dropTarget,
   * remove mark from prior dropTarget, update dragCtx.lastCont = dropTarget
   * @param card
   * @param dragCtx info about this drag {srcCont: original parent,  etc}
   * @return dragCtx.lastCont (current/new dropTarget)
   */
  srcSetDropContainer(card: Card, dragCtx:DragInfo): CardContainer {
    if (!dragCtx) return undefined // this is a "click" not a "dragdrop"
    let target: CardContainer = this.srcDropTargetUnderCard(card)
    let lastDropTarget = (dragCtx.dropCont as CardContainer)
    if (!!target && (target != lastDropTarget)) {
      // cleanup prior parent:
      lastDropTarget.hideMark('newTarget') // bury mark
      lastDropTarget.allowDropCacheFalse = lastDropTarget.allowDropCacheTrue = undefined
      lastDropTarget = dragCtx.dropCont = target; // called dropCont in createjs-lib@1.3.0
      lastDropTarget.allowDropCacheFalse = lastDropTarget.allowDropCacheTrue = undefined
      //console.log(stime(this, ".srcSetDropContainer: lastCont="), cc.name, cc)
    }
    return lastDropTarget;
  }

  /** set to S.netDrop to interpose on all Drag-Drop gestures. */
  static dropEvent: string = S.dropped
  static clicEvent: string = S.clicked
  /**
   * Final action invoked from synth_dand, eval_dand, or actual pressmove->pressup->dropFunc
   * (during drag/pressmove, handle all the allowDrop & mark calculations;
   *  on 'drop' invoke the actual S_dropEvent for state-change actions.)
   *
   * on "pressup" card.parent is set to dragCtx.lastCont
   * Dragger invokes (ctx.scope || obj.parent)dropFunc(obj, ctx)
   *
   * align card in marked slot of this [DropTarget]
   *
   * card.parent is set; {x,y} is approximate
   * @param card has been dropped on this DropTarget destination Container
   * @param dragCtx? not used
   * @param S_dropEvent? the event name to send: S.dropped | S.netDrop
   */
  dropFunc(card: Card, ctx?: DragInfo, S_dropEvent: string = CC.dropEvent) {
    let srcCont = card.origSlot.cont
    this.allowDropCacheFalse = this.allowDropCacheTrue = undefined
    this.hideMark('dropFunc')
    srcCont.hideTargetMarks()

    let { row, col } = this.mark.slotInfo   // { cont: this }
    this.dropToOrigSlot = (this == srcCont) && (this.anchorToOrigSlot || (row == card.origSlot.row && col == card.origSlot.col))
    if (card.useDropFunc) { // if this [Debt] Card has special handling for dropFunc:
      let dst = this.mark.slotInfo
      if (S_dropEvent === S.netDrop &&
        (card.table.isNetworked((cmClient) => cmClient.useNetDand(card, dst), () => card.putItBack()))) {
        return
      } else {  // S.dropped: standalone or eval_dand
        if (card.dropFunc(srcCont, this, row, col)) return
        // return false to fall through to addCard() & dispatchCardEvent()
      }
    }
    this.addCard(card, row, col) // moveCardToSlot! addToSlot(), setSlotInfo, S.moved event,
    this.dispatchCardEvent(S_dropEvent, card, row, col); // declare card is "dropped" (netDrop -> this.dropFunc)
    // S.netDrop -> cmc.netDrop; S.dropped -> plyr:payBuyCost; mainMap:payBuildCost; mkt:clearBuyCost
  }

  /**
   * Synthetic: Drag Card (= ce.card) from srcCont (= card.slotInfo.cont) and drop on this = dstCont(row, col).
   *
   * Invoked by curPlayer as "Click Accelerator" to buy/discard [market, event, Debt]
   *
   * Caller must ensure that dstCont is a valid dropTarget from srcCont.
   * @param ce event (type = CC.dropEvent = S.dropped) {cont: dstCont, row, col, card} where card.slotInfo.cont ==> srcCont
   */
  dragStartAndDrop(ce: CardEvent) {
    let table = ce.card.table // assert: there's a real Card with a real table.
    let netDand = ((cmClient: CmClient) => {  // isNetworked ~= (ce.type === S.netDrop)
      cmClient.send_dand(ce.card, ce, ce.card.slotInfo)        // send_dand->eval_dand->process_dand->localDragAndDropStart(S.dropped)
    })
    if (table.isNetworked(netDand)) return    // TODO: rework with ce.fromNet
    this.localDragStartAndDrop(ce)
  }
  /**
   * cm-client|ref 'eval_dand' (S.dropped) OR Standalone dragStartAndDrop(S.dropped)
   *
   * Dispatch events for: S.dragStart, S.moved, S.dropped (and whatever else)
   *
   * card = ce.card; srcCont = card.slotInfo.cont; dstCont = ce.cont
   *
   * @param ce if (ce.type == S.dropped)
   */
  localDragStartAndDrop(ce: CardEvent) {  // ce.type == S.dropped from cm-clnt|ref.eval_dand -> process_dand(message)
    let card = ce.card
    let dstCont = ce.cont // OR this
    let { cont: srcCont, row, col, stack } = card.getSlotInfo()
    card.setOrigSlot({cont: srcCont, row, col, stack })    // per dragFunc0.first: slotInfo -> origSlot
    srcCont.removeCardFromSlot(card)                       // per dragFunc0.first: dispatch(S.remove)
    let dragStart = new CardEvent(S.dragStart, card, row, col, srcCont, ce.fromNet)
    srcCont.dispatchEvent(dragStart)                       // run dragStart: gamePlay.configBuyCost(), configBuildCost
    // bypass all the drag events... dragFunc, and allowDrop checks!
    if (TP.trapNotDropTarget) {
      if (!srcCont.dropTargets.concat([card.table.discardT]).includes(dstCont)) { // Hmm, why exception for discardT?
        let msg = `dragStart does not allow dropTarget: ${srcCont.name}->${dstCont.name}`
        console.warn(stime(this, ".localDragStartAndDrop:"), msg)
        alert(msg)
      }
      if (!dstCont.allowDropAt(ce.row, ce.col, card)) {
        let msg = `dragStart does not allowDropAt: ${srcCont.name}->${dstCont.name}[${ce.row},${ce.col}]`
        console.warn(stime(this, ".localDragStartAndDrop:"), msg, card)
        alert(msg)
      }
    }
    dstCont.addChild(card)                                 // per CC.dropFunc
    // dodgy way of passing destination: row, col
    dstCont.moveAndSetSlotInfo(dstCont.mark, ce.row, ce.col); // mark the drop slot
    // network has been consulted: now drop for real, updating game-state:
    dstCont.dropFunc(card, undefined, ce.type) // S.dropped -> Buy/Build/Discard/Debt OR S.netDrop -> send_dand()
   }

   /** Shrink and then spread the Cards over the area of this CardContainer */
  shrinkCards(ce: CardEvent, shrink = .9 * Card.scale) {
    if (!!ce.card) ce.card.scaleX = ce.card.scaleY = Card.scale; // reset the card being removed from this Container
    // offset cards in stack
    let stack = this.getStack(ce.row, ce.col), n = stack.length;
    if (n == 0) return;
    if (n == 1) shrink = Card.scale;
    let card = stack[0] // representative card (not if a HouseToken card!)
    let cw = card.width * shrink, dw = this.slotSize.width - cw
    let ch = card.height * shrink, dh = this.slotSize.height - ch
    let cx = (ndx: number) => cw / 2 + ((n > 1) ? (ndx) * dw / (n - 1) : dw / 2)
    let cy = (ndx: number) => ch / 2 + ((n > 1) ? (ndx) * dh / (n - 1) : dh / 2)
    stack.forEach((c, ndx) => {
      c.visible = true
      c.scaleX = c.scaleY = shrink
      cw = c.width * shrink, dw = this.slotSize.width - cw
      ch = c.height * shrink, dh = this.slotSize.height - ch
      c.y = cy(ndx);
      c.x = cx(ndx);
    })
    this.stage.update()
    //console.log(stime(this, ".shrinkCards: ce="), ce.type, ce.card.name, ce)
  }

  /** When card is moved to [row,col] and another card is already there
   * then move the lower card to the next slot (row+ OR col+) or discard (per disFunc(Card))
   * @param dir default to "col+", "disc" to force discard (of underlying card)
   * @param discFunc invoked if card ripples off end OR if dir == "disc"
   * @return true if card was rippled to the discFunc
   */
  moveRipple(ce: CardEvent, discFunc: (c: Card) => void, dir="col+"): boolean {
    let {row, col} = ce, card = this.getStack(row, col)[1]
    if (!card) return false   // if no collision, then do nothing; else find place for card
    let rowp = (dir == "row+" ? 1 : (dir == "disc") ? this.slotsY : 0)
    let colp = (dir == "col+" ? 1 : (dir == "disc") ? this.slotsX : 0)
    //console.log(stime(this, ".moveRipple: this="), this.name, row, col, stack.length, card.name, ce)
    if (row + rowp < this.slotsY && col + colp < this.slotsX) {
      this.addCard(card, row + rowp, col + colp)    // addCard will: removeCardFromStack -> addCardToSlot
      return false;
    } else {
      discFunc(card)
      return true
    }
  }

  /** if false: do not make Cards dragable (cards may be dropped from other containers) */
  enableCardDrag: boolean = true

  /**
   * Add card to this Container: putCardOnStack(card); moveCardToSlot(); dispatchEvent(S.moved)
   *
   *
   * If this.enableCardDrag, then assign dragFunc.
   *
   * Move card to designated Slot: putCardOnStack() and dispatch S.moved event.
   *
   * Note: all Stacks on this CardContainer share a display list.
   * Target of Drag is on top[n-1] of Display list, shadowCard is next [n-2]
   * Mat (background Rectangle) is bottom[0]

   * @param card a Card to add to this container (removing from prior parent)
   * @param row the slot
   * @param col the slot
   * @param depth add at top of display list [-1]. (addChild)
   * @returns the given card
   */
  addCard(card: Card, row: number = 0, col: number = 0): Card {
    row = this.cardSlotRowLimit(row);
    col = this.cardSlotColLimit(col);
    let dragger = CC.dragger
    if (!card) {
      let msg = `CC.addCard FAILED: no card! CC=${this.name}, row=${row}, col=${col} `
      try { alert(msg) } catch {}
      console.log(stime(this, ".addCard FAILED: card="), card, row, col)
      if (!!msg) throw new Error(msg) // to get stack trace
      return undefined;    // clear msg to return vs throw
    }
    this.removeCardFromSlot(card) // to addCard: S.removed, set origSlot, delete slotInfo
    dragger.stopDragable(card);   // remove Listeners bound to old parent
    this.addChild(card)           // remove from old parent, add to this
    let df0 = (card: Card, dragCtx: DragInfo) => this.dragFunc0(card, dragCtx, row, col)
    //console.log(stime(this, ".addCard: this="), this.name, parent.name, card.parent.name, card.name, row, col)
    if (this.enableCardDrag) {
      // NOTE: (scope === undefined) so dragFunc.call(dstCont, card, dragCtx)
      dragger.makeDragable(card as Card, undefined, df0, this.dropFunc); // in addCard()
    }
    // card is now/still a Child of this Container; set Depth:
    // let depth = -1
    // this.setChildIndex(card, (depth >= 0) ? depth : this.numChildren + depth)
    // ASSERT: card.nreps = 1, card.parent== (this | null)
    this.putCardOnStack(card, row, col)
    this.moveCardToSlot(card, row, col)   // moveAndSetSlotInfo
    this.dispatchCardEvent(S.moved, card, row, col)
    //console.log(stime(this, ".addCard:"), card.name)
    if (this.stage) this.stage.update()
    return card;
  }
  dragFunc0 (card: Card, dragCtx: DragInfo, row: number, col: number) {
      let cont = dragCtx.srcCont as CardContainer  // should be 'this' == card.parent
      if (!card.slotInfo) {
        // recover from breakpoint (no pressup/dropFunc) without further events.
        // versus: this.dropFunc(card), this.addCard(card,r,c), this.putCardOnStack(r,c,s)
        let { cont, row, col, stack } = card.origSlot
        card.setSlotInfo({ cont, row, col, stack }); // copy of origSlot
        //cont.addCard(card, row, col)
        stack.push(card)
      }
      // Diagnostic, try to fix mouse glitch!
      if (!(cont instanceof CardContainer)) {
        let cont2 = card.slotInfo.cont
        Dragole.log(Dragole.logRate, "CC.dragfunc0: srcCont is not CardContainer!! srcCont=", cont, Obj.fromEntriesOf(dragCtx), " set to cont:", cont2) // if drag from overCont...
        dragCtx.srcCont = cont2
        cont = cont2
        try { alert("CC.dragFunc0: srcCont is not CardContainer") } catch {}
        //return
      }
      // detect *first* drag event, emit S.dragStart
      //console.log(stime(this, ".addCard.dragFunc0: this="), this.name, parent.name, "lastCont:"+dragCtx.lastCont.name, "srcCont:"+dragCtx.srcCont.name, cont.name, card.name, row, col)
      if (dragCtx.first) {
        card.x -= (dragCtx.dxy.x * card.scaleX - dragCtx.dxy.x); dragCtx.dxy.x *= card.scaleX; // TODO: fix dragger.ts
        card.y -= (dragCtx.dxy.y * card.scaleY - dragCtx.dxy.y); dragCtx.dxy.y *= card.scaleY;
        cont.allowDropCacheFalse = cont.allowDropCacheTrue = undefined;
        // dragStart assumes Card is still where it was this addCard!
        card.setOrigSlot({ cont, row, col, stack: card.slotInfo.stack } as SlotInfo) // save origSlot (isDiscardActivated)
        cont.removeCardFromSlot(card)                       // dispatch(S.removed) [after that: slotInfo is undefined]
        cont.dispatchCardEvent(S.dragStart, card, row, col) // configBuy/BuildCost, [un]scale, dropTargets
        cont.showTargetMarks()
      }
      // invoke the *real* CardContainer.dragFunc:
      cont.dragFunc(card, dragCtx)
    }
  /** manage dragCtx.lastCont showing cont.Mark in latest DropTarget
   * card.parent == scaleC.dragCont
   * card.origSlot = {cont: dragCtx.srcCont, row:, col:}
   */
  dragFunc(card: Card, dragCtx: DragInfo) {
    // 'this' (the orig srcCont) runs dragFunc, staticSDC updates & return lastDropTarget
    let target: CardContainer = this.srcSetDropContainer(card, dragCtx)
    if (!target) {
      Dragole.log(20, "CC.dragFunc: CLICK! no dragCtx, no cont; no removeCardFromSlot()", {card: card})
      return
    }
    // now target = dragCtx.lastCont: a dropTarget
    // console.log(stime(this, ".dragfunc: target="), target.name, target, "\n       card=", card.name, card)
    target.showMarkIfAllowDrop(card) // cont.mark has SlotInfo
    target.stage.update()
  }
}
/** abbreviation for static functions. */
export class CC extends CardContainer {}


