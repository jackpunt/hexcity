import { stime } from '@thegraid/common-lib';
import { DisplayObject, MouseEvent } from '@thegraid/easeljs-module';
import { AckPromise, CgBase, CgMessage, CgMessageOpts, GgClient, WebSocketBase } from '@thegraid/wspbclient';
import { CmMsgBase } from 'src/proto/CmProto';
import { S } from './basic-intfs';
import type { Card, SlotInfo } from './card';
import { CC, CardContainer } from './card-container';
import { CardEvent } from "./card-event";
import { Button, DirKey } from './choose-dir';
import { CmMessage, CmSlot, CmType, KVpair } from './cm-message';
import type { Player } from './player';
import type { Table } from './table';
import { TP } from './table-params';

export type rost = {name: string, client: number, player: number}

/** CmMessage Keys */
type CMMK = keyof ReturnType<CmMsgBase['toObject']>
export type CmMessageOpts = Partial<Pick<CmMessage, CMMK>>

// Extend BaseDriver, doing CmProto things, and feeding a CgBase2
// INNER = CmMessage [OUTER = CgMessage]
export class CmClient extends GgClient<CmMessage> {
  table: Table;
  player: Player;
  //localPlayers: Player[] = []

  /**
   * CmClient stacked on CgBase2 & WebSocketBase2:
   *
   * game-setup invokes via ParamLine: Network="yes"
   */
  constructor(url?: string, onOpen?: (cmClient: CmClient) => void) {
    super(CmMessage, CgBase, WebSocketBase, url, onOpen)
    this.deserialize = (buf: Uint8Array) => { return CmMessage.deserialize(buf) }
  }

  // override deserialize: (buf: Uint8Array) => CmMessage;
  /** mark Player as eligible to use GUI, forwarding events to Ref/Group. */
  attachToPlayer(player: Player): CmClient {
    //this.localPlayers.push(player) // dubious; just make another cmClient [maybe share the Table?]
    this.player = player
    return this
  }
  //get isNetworked(player: Player): boolean { return !!this.wsbase.ws }

  /**  */
  detachGUI(table: Table) {
    CC.dropEvent = S.dropped // maybe also removeEventListener?
  }
  /** interpose to capture click/drop gestures from the GUI.
   * if player is local: forward to Group
   * if player is remote: ignore click/drop
   */
  attachToGUI(table: Table): CmClient {
    this.table = table
    // table.turnButtonClicked and table.undoButtonClicked invoke table.isNetworked()

    // Make all Card Drop actions use S.netDrop and catch that Event from all CardContainer Drag->Drop targets
    // What about mainDebt & PlyrDebt? (and on-card DebtCont?)
    let pconts = table.allPlayers.flatMap(p => [p.plyrPolis, p.plyrProjs])
    let drops: Array<CC> = [table.mainMap, table.discardT, table.auctionP0, table.policySlots, ...table.allMkts, ...pconts];
    drops.forEach(cc => {
      cc.removeEventListener(S.netDrop, cc[S.netDrop])         // remove binding to old cmClient (so it can GC?)
      cc[S.netDrop] = cc.on(S.netDrop, this.netDropCard, this) // invoke method on new cmClient (although cmClient is not otherwise used)
      cc[S.netDrop][S.Aname] = "cmClient.netDropCard"
    });
    CC.dropEvent = S.netDrop
    let stage = table.stage
    stage.removeEventListener(S.dragStart, stage[S.dragStart], true) // remove old capture listener
    stage[S.dragStart] = stage.on(S.dragStart, this.netDrag, this, false, undefined, true) // capture: cmClient.netDrag(ev)
    stage[S.dragStart][S.Aname] = "cmClient.netDrag"

    // this.netClik: capture & convert S.click -> send_clik -> eval_clik -> S.clicked
    // TODO: simplifiy logic in CC.clickOnContainer... ? findts '[.]on(S.click[^e]' src
    // click to draw, click for dist (& move), click for setNextPlayer turn
    let clicks: DisplayObject[] = [table.policyDeck, table.tileDeck, ...table.allPlayers.map(p => p.plyrDist)]
    let buttons = table.chooseDir.buttons
    let chooseButtons = Object.keys(buttons).map(k => buttons[k] as Button);
    clicks = clicks.concat(table.turnButton, table.undoButton, ...chooseButtons) //, plyr.[Polis/Draw/assets]Counter
    clicks.forEach(dispObj => {
      dispObj.removeEventListener(S.click, dispObj[S.click], true) // capture
      dispObj[S.click] = dispObj.on(S.click, this.netClik, this, false, undefined, true) // capture
    })
    console.log(stime(this, ".attachToGUI:"), this)
    return this;
  }

  /** capture phase handler! */
  netClik(ev: MouseEvent) {
    let target = ev.currentTarget  // bubbles from Bitmap to listener on CardContainer
    console.log(stime(this, `.netClik on`), { target, ev })
    let sendClick = (cmClient: CmClient) => {
      if (target instanceof CardContainer) {
        cmClient.send_clik(target.parseMouseClick(ev))
        console.log(stime(this, `.netClik send_clik`), this.ack_promise.message)
      } else if (target === cmClient.table.undoButton) {
        cmClient.send_undo()           // send_undo
      } else if (target === cmClient.table.turnButton) {
        cmClient.turnButtonClicked()   // pregame && sendDistArray; send_next();
      } else if (target instanceof Button) {
        cmClient.send_cdir(target.dir)
      } else {
        console.log(stime(this, `.netClik: ev.target =`), target)
      }
    }
    if (this.table.isNetworked(sendClick)) {
      ev.stopImmediatePropagation()
      return
    }
    // else: let S.click event propagate for 'local' events
  }
  /** putItBack(); show card where it dropped; send_dand() */
  useNetDand(card: Card, dst: SlotInfo = card.slotInfo, src: SlotInfo = card.origSlot) {
      let pt = card.parent.localToGlobal(card.x, card.y)
      card.putItBack()               // let ref do it first: get AutoCards.
      let pt2 = card.parent.globalToLocal(pt.x, pt.y)
      card.x = pt2.x; card.y = pt2.y; card.stage.update() // show card where it dropped!
      this.send_dand(card, dst, src) // eval_dand -> cont.localDragStartAndDrop(S.dropped)
  }
  /** capture phase listener on(S.dragStart) */
  netDrag(ce: CardEvent) {
    if (this.table.isNetworked(null, () => {
      if (!ce.fromNet) {
        this.table.gamePlay.stopDrag()
        ce.stopImmediatePropagation()  // do not configBuildCost()
      }
    })) return
  }

  /** Invoked by S.netDrop: card drops when table.isNetworked()
   * card.origSlot is srcSlot; card.slotInfo is dstSlot
   */
  netDropCard(ce: CardEvent) {
    let {card, row, col, cont } = ce
    if (cont.dropToOrigSlot) { card.putItBack() } // or just return? send dand to clear mark
    if (this.table.isNetworked((cmClient) => {
      cmClient.useNetDand(card)
    }, () => card.putItBack)) return
    // failsafe... not reached: netDropCard [only] used when table.isNetworked()
    // TODO: remove this alert, run all drops through this logic (no attach/detach GUI)
    try { alert('playerDroppedCard: !table.isNetworked ?') } catch {}
    cont.dispatchEvent(new CardEvent(S.dropped, card, row, col, cont))
    return
  }
  undoButtonClicked() {
    this.send_undo(); // group will send/cc to everyone, eval_undo invokes table.undoIt()
  }
  /**
   * send 'next' turn indication to the Referee (preGame: include params = plyrDist)
   * Referee will respond with eval_next: setNextPlayer();
   */
  turnButtonClicked() {
    let table = this.table, cmOpts: CmMessageOpts = {}, cgOpts = { client_id: 0 }
    if (table.preGame) {
      table.curPlayer.distArranger.unload(true)
      let choices = table.curPlayer.distChoice()
      let params = choices.map((sufx, ndx) => new KVpair({ name: sufx, value: ndx }))
      cmOpts = { params }   // send distArrangement to Referee
    }
    this.send_next(cmOpts, cgOpts).then(
      (ack: CgMessage) => {
        if (!ack.success) {
          console.log(stime(this, ".send_next nak="), ack)
          alert(`send_next nak'd: '${ack.cause}' !?`)
          console.log(stime(this, " oh well, try click it again...  ack="), ack)
        }
      },
      (reason: any) => {
        console.log(stime(this, ".send_next rejected reason="), reason)
        alert("send_next rej_on_error: " + reason)
        console.log(stime(this, " Hmm, maybe click it again...?  reason="), reason)
      })
  }

  getSlotInfo(slot: CmSlot): SlotInfo {
    let cont: CardContainer = this.table.getCCbyName(slot.name)
    if (!cont) {
      alert(`no Container for name: ${slot.name}`)
      console.error(stime(this, `.getSlotInfo`), `no getCCbyName: ${slot.name}`)
    }
    return {
      cont: cont,
      row: slot.row,
      col: slot.col,
      stack: cont.getStack(slot.row, slot.col)
    }
  }

  makeCmSlot(slot: SlotInfo): CmSlot {
    let {cont, row, col} = slot
    return new CmSlot({row, col, name: cont.regName})
  }

  override parseEval(message: CmMessage) {
    let type = message.type
    // validate player & srcCont/stack, then:
    // let func = this[`eval_${type}`] as (message: CmMessage) => void
    // if (typeof func === 'function') func.call(this, message)
    switch (type) {
      case CmType.cm_none: { this.eval_none(message); break }
      /** curPlayer request to flip card on src stack */
      case CmType.cm_clik: { this.eval_clik(message); break }
      /** search cont for card, put it on top, emit click-on-stack */
      case CmType.cm_draw: { this.eval_draw(message); break }
      /** dest.moveAndSetSlotInfo(dest.mark, row, col) */
      case CmType.cm_mark: { this.eval_mark(message); break }
      /** dest.dragStartAndDrop(new CardEvent(S.dropped, ce.card, 0, 0, dest), dragCheck) */
      case CmType.cm_dand: { this.eval_dand(message); break }
      case CmType.cm_move: { this.eval_move(message); break }
      case CmType.cm_chat: { this.eval_chat(message); break }
      case CmType.cm_join: { this.eval_join(message); break }
      case CmType.cm_undo: { this.eval_undo(message); break }
      case CmType.cm_next: { this.eval_next(message); break }
      case CmType.cm_param: { this.eval_param(message); break }
      case CmType.cm_cdir: { this.eval_cdir(message); break }
      default: {
       console.warn(stime(this, `.parseEval: unknown CmType`), message); break
      }
    }
    // default ACK for everthing:
    if (!this.message_to_ack.resolved) this.sendCgAck(message.msgType)
  }
  /** initial: just set params as given... */
  eval_param(message: CmMessage) {
    let params = message.params, text = "CmClient"
    if (message.name == "resetMrkt") {
      this.table.resetMarket(message.params)
      this.sendCgAck("resetMrkt") // message.name
      return
    }
    let pg = this.table.paramGUI
    params.forEach((kvpair: KVpair) => {
      let fieldName = kvpair.name
      let value = kvpair.value.value
      let curNdx = pg.selectValue(fieldName, undefined); // get current index
      let newNdx = pg.selectValue(fieldName, value)
      if (curNdx != newNdx) {
        // TODO: change color, so user notices the change
        // popup the "accept changes" button [and a "revert changes"? ]
        // make buttons: Send Params, Accept Params, Revert Params
        // when recieve params with NO changes (signal of Accept), then begin game
      }
    })
    pg?.stage.update()
    this.sendCgAck("params") // message.cmType
  }

  parseNetClik(message: CmMessage): CardEvent {
    let { player, srcSlot } = message
    let origSlot = this.getSlotInfo(srcSlot)
    let { cont, row, col } = origSlot
    // ASSERT send_clik NOT called when stack is Empty (top | back)
    let card = cont.getChildAt(cont.numChildren -1) as Card
    console.log(stime(this, `.parseNetClick: player=${player} srcInfo=`), { cont: cont.name, row, col, card: card && card.name })
    return new CardEvent(S.clicked, card, row, col, cont)
  }
  /**
   * Convert network 'clik' to local -> S.clicked on top Card of srcSlot.
   */
  eval_clik(message: CmMessage) {
    this.extractCardNames(message) // clik->draw of Event may provoke additional Cards
    let ce = this.parseNetClik(message)
    let autoEvent = (this.player === this.table.curPlayer) ? TP.autoEvent : 0 // only curPlayer can use autoEvent
    this.withSavedTP("autoEvent", autoEvent, () => {  // do not autoEvent, wait for client to dand
      // plyrProjClicked, plyrDistClicked, gplay.clickedOnMarket, gplay.eventFromP0, CC.drawOnBackClicked
      ce.cont.dispatchEvent(ce)
    })
  }

  /**
   * click on the indicated choice.
   * @param message.name is the choosen Dir/Button: DirKey { C, N, E, W, S }
   */
  eval_cdir(message: CmMessage) {
    let dir = message.name as DirKey
    this.table.chooseDir.buttonClickDir(dir)
  }

  process_draw(message: CmMessage): boolean {
    let { name, player: plyr_ndx, srcSlot } = message
    let { cont, row, col } = this.getSlotInfo(srcSlot)
    let player = this.table.allPlayers[plyr_ndx] || this.table.curPlayer // preGame has message.player
    // getNextDistance checks shuffle & puts card on plyrDist(0,1)
    let success =
    (cont == player.plyrDist) ? player.getNextDistance(name) != 0 // player.distPromise.fulfill(dist)
    : (cont == player.dirCards) ? player.setDirByName(name)
    : !!cont.flipCardWithName(name, row, col)  // S.flipped -> TileDeck/PolicyDeck
    console.log(stime(this, `.process_draw`), { player: player.name, name, success } )
    return success
  }
  /**
   * Ignore draw message from non-referee clients.
   *
   * process_draw -> cont.flipCardWithName(name, row, col)
   * @param message
   */
  eval_draw(message: CmMessage) {
    if (message.client !== 0) {
      console.log(stime(this, ".eval_draw: ignore draw from non-referee"), message)
      this.sendCgNak("ignore non-referee draw") // should not happen
      return
    }
    let success = this.process_draw(message)
    this.sendCgAck(message.name, { success }) // not clear that a NAK will do anything useful...
  }

  /** names of Cards drawn as result of eval_clik(auto-event, mkt, debt) or eval_move(nextDist/Dir/Move Effects) */
  // cm-ref will push while doing eval_clik, eval_move (and send to cm-client via Ack)
  // cm-client will shift/read and use to resolve nextDistance/nextDirection synchronously.
  // could also work for 'double-draw' effects from Policy/Tile decks...
  autoCardNames: string[] = []
  extractCardNames(message: CmMessage) {
    let params = message.params
    //this.autoCardNames = []; params.forEach(kvp => this.autoCardNames[kvp.value.value as number] = kvp.name)
    params.forEach(kvp => this.autoCardNames.push(kvp.name))
    //this.autoCardNames = params.map(kvp => kvp.name) // extract Card.name
  }
  /**
   * When you know the container, pluck the named card
   * @param accessor determine cont; cont.flipCardWithName(name)
   * @returns
   */
  useAutoCard<T>(accessor: (name: string) => T): T {
    return (this.autoCardNames.length > 0) ? accessor(this.autoCardNames.shift()) : undefined
  }
  /** used by referee. */
  setAutoCard(name: string, rv: boolean): boolean {
    this.autoCardNames.push(name)
    return rv
  }
  /**
   * curPlayer sent dand to referee, ack enables server to sendToGroup.
   * clients dragStartAndDrop
   * @param message possibly augmented with params = autoCardNames.
   */
  eval_dand(message: CmMessage) {
    this.extractCardNames(message)
    this.process_dand(message)
    this.sendCgAck(message.msgType)
    return
  }

  /**
   * Process eval_dand from network (cmClient OR cmReferee)
   * @return false if result was: sendCgNak()
   */
  process_dand(message: CmMessage): boolean {
    let srcSltI = this.getSlotInfo(message.srcSlot) // card.slotInfo
    let dstSltI = this.getSlotInfo(message.dstSlot)
    let { cont, row, col } = srcSltI
    let card = cont.bottomCardOfStack(row, col) // assert: card.slotInfo == srcSltI
    // clik -> draw(name) -> dand; so name must match!
    if (card.name !== message.name) {
      // if non-ref client does this, we are likely dead from loss of sync.
      this.sendCgNak(`wrong card: ${card.name} != ${message.name}`)
      return false
    }
    let { cont: dstCont, row: drow, col: dcol } = dstSltI
    // TODO: "Caller must ensure that dstCont is a valid dropTarget from srcCont."
    // for now: we don't care if this semantically fails... just run the GUI:
    // Network has been informed: now drop on local GUI:
    let ce = new CardEvent(S.dropped, card, drow, dcol, dstCont); ce.fromNet = true
    dstCont.localDragStartAndDrop(ce)
    return true
  }
  /** check for autoCardNames, then start move */
  eval_move(message: CmMessage, asRef: boolean = false) {
    if (!asRef) this.extractCardNames(message)
    let player = this.table.allPlayers[message.player]
    player.playerMove()    // dist = distPromise.value
  }
  /** request to move-show Mark on a new slot. */
  eval_mark(message: CmMessage) {
    let srcInfo = this.getSlotInfo(message.srcSlot)
    let {cont, row, col} = srcInfo
    cont.showMarkAtSlot(row, col) // TODO: does ref need to validate allowDropAt?
    this.sendCgAck("mark")
  }

  /** invoke table.setNextPlayer(n) */
  override eval_next(message: CmMessage) {
    let player = message.player
    if (message.name == "round1") { // "round1" means: start game with startPlayer; place Home cards
      this.table.preGame = false
      this.table.turnNumber = 0; this.table.roundNumber = 1
      this.table.startPlayerNdx = player
      console.log(stime(this, `.eval_next: round1`), {player})
    }
    this.table.setNextPlayer(player) // ndx OR undefined ==> -1
    this.sendCgAck("next")
  }
  /** invoke table.undo */
  override eval_undo(message: CmMessage) {
    this.table.undoIt()
    this.sendCgAck("undo")
  }

  ///////////////////////////////////////////// send_messages ////////////////////////////////////////////

  /** tell Ref (& Group) to advance to next player */
  send_next(cmOpts: CmMessageOpts = {}, cgOpts: CgMessageOpts = {}): AckPromise {
    let message = new CmMessage({...cmOpts, type: CmType.cm_next}) /* , player: this.table.curPlayer.index */
    return this.send_message(message, cgOpts) // to Group OR Referee
  }

  /**
   * send to referee;
   * .then((ack) => {ref will emit(draw)}, (nak) => {move blocked, no cards?})
   */
  send_clik(ce: CardEvent): AckPromise {
    let { cont, row, col, card } = ce
    let srcInfo = { aname: cont.name, cont: cont, row: row, col: col } as SlotInfo
    let srcSlot = this.makeCmSlot(srcInfo)
    let message = new CmMessage({ type: CmType.cm_clik, srcSlot, player: this.table.curPlayer.index })
    let ackPromise = this.send_message(message, { client_id: CgMessage.GROUP_ID }) // ref will augment and broadcast
    return ackPromise
  }

  send_cdir(dir: string) {
    let message = new CmMessage({type: CmType.cm_cdir, name: dir, player: this.table.curPlayer.index})
    return this.send_message(message, { client_id: CgMessage.GROUP_ID, nocc: false }) // eval_cdir() to process choice.
  }

  /**
   * Sent from referee, in response to curPlayer.flip; {nocc: true}
   * @param name Card.name of the Card that was flipped.
   * @param srcSlotI slotInfo where to find Card with name
   * @return Promise\<Ack_of_send>
   */
  send_draw(name: string, srcSlotI: SlotInfo, cmOpts: CmMessageOpts = {}): AckPromise {
    let srcSlot = this.makeCmSlot(srcSlotI)
    let message = new CmMessage({ ...cmOpts, type: CmType.cm_draw, name, srcSlot})
    return this.send_message(message, { client_id: CgMessage.GROUP_ID, nocc: true }) // sendToGroup; card is prep'd, but still on stack
  }
  /**
   * Sent by client; [netDropCard]
   *
   * From cmClient.netDropCard we expect card.slotInfo and card.origInfo are already set (by Dragger)
   *
   * From synthetic CC.dragStartAndDrop the src & dst are passed in explicitly, without modifying the Card
   * @param card
   * @param dst SlotInfo where card is dropped (card.slotInfo or mark.slotInfo)
   * @param src SlotInfo where card originated (card.origSlot)
   * @returns
   */
  send_dand(card: Card, dst?: SlotInfo, src?: SlotInfo): AckPromise { // Note: ref will eval, augment, and then release send_dand to Group
    let dstSlot = this.makeCmSlot(dst || card.slotInfo)
    let srcSlot = this.makeCmSlot(src || card.origSlot)
    // assert: this.player.index === table.curPlayer.index
    let message = new CmMessage({type: CmType.cm_dand, srcSlot, dstSlot, name: card.name, player: this.table.curPlayer.index})
    return this.send_message(message, { client_id: CgMessage.GROUP_ID, nocc: false}); // sendToGroup (cc: me)
  }
  /** provoked by CC.showMark InSlot */
  send_mark(cont: CC, row: number, col: number): AckPromise {
    let srcSlot = this.makeCmSlot({cont, row, col})
    let message = new CmMessage({type: CmType.cm_mark, srcSlot})
    return this.send_message(message, { client_id: CgMessage.GROUP_ID, nocc: true }) // sendToGroup
  }

  send_undo(): AckPromise { // appears to be { nocc: false }
    return this.send_message(new CmMessage({ type: CmType.cm_undo }), { client_id: CgMessage.GROUP_ID })
  }

  withSavedTP<T>(fieldName: string, value: any, proc: () => T, onCatch: (err?: any) => void = () => {}): T {
    let orig = TP[fieldName]; TP[fieldName] = value
    try { return proc() } catch (err) { onCatch(err) } finally { TP[fieldName] = orig; return undefined; }
  }
}
