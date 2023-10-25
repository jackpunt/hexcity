import { stime } from '@thegraid/common-lib';
import { AckPromise, CgBase, CgMessage, DataBuf, GgRefMixin } from "@thegraid/wspbclient";
import { Card, SlotInfo } from "./card";
import { CmClient, CmMessageOpts } from "./cm-client";
import { CmMessage, CmType, KVpair, TypedMsg } from "./cm-message";
import { Player } from "./player";

/**
 * In-browser Referee, sharing TP and Decks with the original GameSetup/Table.
 *
 * Base class for GgRefMixin -> CmReferee
 */
export class CmReferee extends GgRefMixin<CmMessage, typeof CmClient>(CmClient) {
  /** specialized CmClient for Referee. Invoked through CgRefMixin */
  constructor(url?: string, onOpen?: (cmReferee: CmReferee) => void) {
    super(url, onOpen)   //
  }

  override eval_join(message: CmMessage) {
    let client = message.client // wrapper.client_from
    super.eval_join(message)    // set playerId, Ack(roster)

    // send_params(resetMrkt, marketCard()) to new client/player:
    let params = this.marketCards()
    let param_msg = new CmMessage({ type: CmType.cm_param, params, client, name: "resetMrkt" })
    this.send_message(param_msg, { client_id: client }) // with specific client_id nocc implied
  }

  marketCards(): KVpair[] {
    let mkts = this.table.tileMkts.filter(mc => !!mc.name.match(/mkt[1-7]Cont/))
    return mkts.map(mc => new KVpair({name: mc.name, value: new TypedMsg({strValue: mc.bottomCardOfStack().name})}))
  }

  isCurPlayer(client_id: number) {
    return this.client_player_id(client_id) === this.table.curPlayerNdx
  }
  notCurPlayer(client_from: number, ident: string = '.notCurPlayer') {
    if (!this.isCurPlayer(client_from)) {
      let player_from = this.client_player_id(client_from)
      let curPlayerNdx = this.table.curPlayerNdx
      console.log(stime(this, `${ident} notCurPlayer`), { client_from, player_from, curPlayerNdx })
      this.sendCgNak(`notCurPlayer: ${player_from} !== ${curPlayerNdx}`, { client_id: client_from })
      return true; // with eval_msg being Nak'd
    }
    return false;
  }
  /** cmPlayer must set {client_id: 0} send ONLY to referee.
   * cmReferee will validate, and send next(ndx) to all of Group.
   */
  override eval_next(message: CmMessage) {
    let client_from = message.client // original client_from
    if (message.client_to !== 0) {
      this.sendCgNak("send next to ref only", { client_id: client_from });
      return;
    }
    let cause = "next"
    if (!this.table.preGame) {
      if (this.notCurPlayer(client_from, `.eval_next:`)) return
      this.table.setNextPlayer()         // advance curPlayerNdx (!? may draw/discard cards onTurn event?)
      this.sendCgAck(cause, {client_id: client_from}) // singular Ack
      this.sendNextPlayer()              // broadcast send_next(ndx) to Group & Self
      return
    }

    // ELSE: handle preGame params and maybe chooseStartPlayer:
    let player_from = this.client_player_id(client_from)
    let player = this.table.allPlayers[player_from]
    let params = message.params
    if (message.has_params && (params.length > 0)) { // was (rn===0)
      cause = "next+distCards"
      player.distArranger.unload()     // setting player.distArrangerDone == true
      let sufxs: string[] = []
      params.slice(0, 4).forEach(kv => { sufxs[kv.value.intValue] = kv.name })
      console.log(stime(this, `.eval_next`), "-?", "-?", "-?", ...sufxs.slice().reverse())
      player.selectTop(...sufxs)       // Top of Ref's copy of plyrDist matches player's plyrDist
      console.log(stime(this, `.eval_next`), ...player.plyrDist.getStack().map(card => card.name.slice(-2)))
    }
    this.sendCgAck(cause, { client_id: client_from })

    let nextWaiting = this.table.allPlayers.find(p => !p.distArrangerDone)
    if (nextWaiting) {
      this.table.setNextPlayer(nextWaiting.index) // wait for another player to send distCards
      this.sendNextPlayer()                       // which will grey out when distArrangerDone
    } else {
      // All player have sent in their distCards:
      // see similar code in table.makeTurnButton.preGameCheck()
      this.chooseStartPlayer().then((ndx) => {
        this.setStartPlayer(ndx)       // preGame = false; setNextPlayer(player)
        //this.autoCardNames = []
        this.sendNextPlayer({ name: "round1" })
      })
    }
  }
  /** when chooseStartPlayer has finished. */
  setStartPlayer(ndx: number) {
    this.table.preGame = false
    this.table.turnNumber = 0; this.table.roundNumber = 1
    let player = this.table.startPlayerNdx = ndx
    console.log(stime(this, `.setStartPlayer:`), {ndx, name: this.table.allPlayers[player].name})
    this.table.setNextPlayer(player)
  }
  sendNextPlayer(opts?: CmMessageOpts) {
    let player = this.table.curPlayerNdx; opts = { ...opts, player } // maybe someday include this.autoCardNames ?
    let ackPromise = super.send_next({ ...opts }, { client_id: CgMessage.GROUP_ID, nocc: true })  // send fresh, new 'next' to Group
    console.log(stime(this, `.eval_next: send_next() to Group; opts=`), opts, this.cgMsgStr(ackPromise.message))
    return ackPromise
  }
  cgMsgStr(msg: CgMessage) {
    return (this.dnstream as CgBase<CmMessage>).innerMessageString(msg)
  }
  /** flip some cards, set table.startPlayerNdx. */
  chooseStartPlayer(): Promise<number> {
    console.log(stime(this, ".chooseStartPlayer ----------------------------------------------------------"))
    // send all the dist flips, then wait for Promise.all(AckPromise)
    let ackPromise: AckPromise; // new AckPromise(undefined).fulfill(null)
    let logObj = {}
    let refNextDist = (plyr: Player): number => {
      // let dist0 = plyr.getNextDistance(undefined, true).value
      plyr.prepareDistance(true) // shuffle & burn as necessary
      let plyrDist = plyr.plyrDist
      //console.log(stime(this, `.eval_next plyr[${plyr.index}]`), ...plyrDist.getStack(0,0).map(card => card.name.slice(-2)))
      //console.log(stime(this, `.eval_next plyr[${plyr.index}]`), ...plyrDist.getStack(0,1).map(card => card.name.slice(-2)))
      let card: Card = plyrDist.bottomCardOfStack(0, 0)
      let dist: number = card.costn
      logObj = { dist, index: plyr.index, name: plyr.name }
      console.log(stime(this, ".chooseStartPlayer.refNextDist"), logObj)
      // tell Group (& self) to draw name on behalf of player: [after previous send_draw is ack'd]
      // TODO: this.process_draw(); this.send_draw() [removing specialized ref.send_draw()]
      ackPromise = this.send_draw(card.name, { cont: plyrDist, row: 0, col: 0 }, { player: plyr.index })
      return dist
    }
    // flipDist -> refNextDist is called for each player before invoking loopP
    // each send_send waits for the previous send_send [to be Ack'd]; here we wait for the last one:
    // the Ack means cgServer has sent message to all clients; but we have yet to recv and parseEval it.
    let loopP = () => {
      console.log(stime(this, `.chooseStartPlayer.loopP`), ackPromise.message || logObj)
      return ackPromise
    }
    // provoke the specific player to reveal the [given/next] card, wait after each round:
    return this.table.chooseStartPlayer(refNextDist, loopP)
  }
  /** Player has initiated a move; do it locally then release to Group */
  // hmm, Ref needs to know when movement & effects have stopped; (for step/stop effects that draw dist/dir)
  // Effects.nextDistance, .moveNextDistance: Taxi, lotto, FlexIten, TransitHub, NewMove/MoveAgain.
  // Include drawn dist/dir in params of Ack?
  override eval_move(message: CmMessage) {
    this.withSavedTP("moveDwell", 1, () => {
      super.eval_move(message, true) // update local table;
      this.sendCardsInAck(message)   // release augmented 'move' message to rest of group
    }, (err) => {
      this.sendCgNak(err)      // but by now we are likely out of sync; TODO: restore state; better undo...
    })
  }
  /**
   * curPlayer send dand to referee, ack enables server to sendToGroup.
   * other clients dragStartAndDrop
   *
   * Note: dand (dropOnDiscard) also activates Events! which may draw dist/dir.
   */
  override eval_dand(message: CmMessage) {
    let { player, client, srcSlot, dstSlot } = message
    if (this.notCurPlayer(client, `.eval_dand:`)) return // after sendCgNak('notCurPlayer')
    console.log(stime(this, `.eval_dand0: autoCards=`), this.autoCardNames)
    if (!this.process_dand(message)) return // after sendCgNak('wrong card')
    console.log(stime(this, `.eval_dand1: autoCards=`), this.autoCardNames)
    // Inject autoCardNames into ack.msg.params: augment orig message with params:
    // turducken: CgAck(success, msg=CgMessage(msg=CmMessage(type:dand, params)))
    // so clients (& orig sender) get a CmMessage(dand, srcSlot, destSlot, params(Card.names)) from Referee
    this.sendCardsInAck(message) // release [augmented] 'dand' message to rest of group
    return
  }
  /** if Cards were drawn, augment message and include it with SendCgAck */
  sendCardsInAck(message: CmMessage) {
    if (this.autoCardNames.length > 0) {
      message.params = this.autoCardNames.map((name, ndx) => new KVpair({ name: name, value: new TypedMsg({intValue: ndx}) }))
      let cmMsg: DataBuf<CmMessage> = message.serializeBinary()
      let cgMessage = this.message_to_ack.message
      cgMessage.msg = cmMsg
      let msg: DataBuf<CgMessage> = cgMessage.serializeBinary()
      this.autoCardNames = []  // reset for next time.x
      let pack = this.sendCgAck(message.msgType, { msg })
      console.log(stime(this, `.sendCardsInAck`), {msgStr: pack.message.msgStr, msg: pack.message.msg })
      return
    }
    this.sendCgAck(message.msgType)
  }


  /**
   * Click on stack: dispatch(S.clicked):
   * maybe Buy/DanD?, Discard?, Event?
   *
   * If draw Cards, setAutoCardNames [do it all synchronously!]
   *
   * equivalent to CC.mouseClickOnCC()
   *
   * sendCardsInAck to release 'flip' to rest of Group.
   *
   * @param message
   */
  override eval_clik(message: CmMessage) {
    // Ideally, we would synthesize a createjs.Event and dispatch to the Bitmap on stack
    // that would provoke CC.mouseClickOnCC to parse to the Card and dispatchCardEvent
    if (this.notCurPlayer(message.client, `.eval_clik:`)) return  // nak has been sent
    let ce = this.parseNetClik(message)
    if (!(ce.card instanceof Card)) { this.sendCgNak('no card for clik')} // do not propagate clik
    this.withSavedTP("autoEvent", 0, () => {  // do not autoEvent, wait for client to dand
      ce.cont.dispatchEvent(ce)    // event, autoDraw cards... [synchronously!]
      this.sendCardsInAck(message) // release augmented 'flip' message
    })
  }

  /**
   * Sent from referee, during preGame, for chooseStartPlayer.
   * (there are no side-effects, no secondary draw or effects)
   * QQQQ: should we just send_clik? with autoCardNames? (assuming that clik on plyrDist would draw in preGame)
   *
   * {nocc: true} because we invoke process_draw(message) before sending it.
   * @param name Card.name of the Card that was flipped.
   * @param srcSlotI slotInfo where to find Card with name
   * @return Promise\<Ack_of_send>
   */
  override send_draw(name: string, srcSlotI: SlotInfo, cmOpts: CmMessageOpts = {}): AckPromise {
    let srcSlot = this.makeCmSlot(srcSlotI)
    let message = new CmMessage({ ...cmOpts, type: CmType.cm_draw, name, srcSlot })
    this.process_draw(message) // handle per-stack result of this draw: player.getNextDistance(name)
    return this.send_message(message, { client_id: CgMessage.GROUP_ID, nocc: true }) // sendToGroup
  }
}
