import { WH, XY, S, C } from './basic-intfs';
import { Card, Stack, Flag, HouseToken } from './card';
import { CardContainer, ContainerAt, CCopts, CC } from './card-container';
import { CardEvent, ValueEvent } from "./card-event";
import { ValueCounter } from "./value-counter";
import { Table } from "./table";
import { Container, DisplayObject } from '@thegraid/easeljs-module';
import { Player } from './player';
import { TP } from './table-params';
import { stime } from '@thegraid/common-lib';

export type DebtStats = {payments:number, nvcDebt:number, vcDebt:number, bankDebt:number, bankPay:number, plyrDebt:number, plyrPay:number}

// Card->Table->dft->mainCont, vcPlayer etc (what was static)
// DebtContainer.table = DFT.table
/** Reference entrypoint for Debt system, attached to given Table.
 * Table.constructor { this.dft = new DebtForTable().configDebtContainers(table) }
 */
export class DebtForTable {
  table: Table;
  mainCont: DebtContainer; // central pool of un-spent Debt tokens
  vcPlayer: VCPlayer;
  debtContId: number = 0;  // each Table computes this value in parallel
  /** create DebtContainers & Debt cards for given table */
  configDebtContainers(table: Table): this {
    this.table = table
    let mainMap = table.mainMap

    this.vcPlayer = new VCPlayer(table, C.BLACK, null, null) // BLACK identifies VCPlayer (without type VCPlayer)

    // first find Debt tokens, and put into this.mainCont:
    let debtTokens = Debt.resetDebtCards(table, [])
    let debtSize: WH = Debt.WH(); debtSize.width *= 2; debtSize.height *= 2;
    let marx = mainMap.marginSize.width, mary = mainMap.marginSize.height
    let locXYD: XY = { x: mainMap.leftEdge(marx, 1.25) - debtSize.width / 2, y: mainMap.topEdge(mary, -1.9) }

    let mainCont: DebtContainer = table.makeCardCont(mainMap.parent as ContainerAt, debtTokens,
      {
        clazz: DebtContainer, name: S.MainDebt, x: locXYD.x, y: locXYD.y,
        bg: false, dropOnCard: true, size: debtSize, backCard: false, markColor: DebtContainer.markColor,
        counter: { color: "lightgreen", fontSize: 14, offset: { x: 20, y: undefined } as XY }
      })
    this.mainCont = mainCont
    mainCont.host = mainCont.parent

    /** plyr.plyrDebt */
    table.allPlayers.forEach(plyr => {
      let contName = plyr.name + "-Debt"
      let playersCont = plyr.plyrCnts.parent as ContainerAt
      let debtSize: WH = Debt.WH();
      let slotSize = { width: debtSize.width * 2, height: debtSize.height * 2 };
      let marx = plyr.plyrDist.marginSize.width * 0, mary = plyr.plyrDist.marginSize.height * 0
      let locx = plyr.plyrDist.leftEdge(marx, -.5), locy = plyr.plyrDist.bottomEdge(mary, -.25) - slotSize.height / 2

      let plyrDebt = plyr.plyrDebt = table.makeCardCont(playersCont, Debt.WH(), {
        clazz: DebtContainer, name: contName, x: locx, y: locy, xl: .5,
        bg: false, dropOnCard: true, size: slotSize, backCard: false, markColor: DebtContainer.markColor,
        counter: { color: "lightgreen", fontSize: 14, offset: { x: 20, y: undefined } as XY }
      }) as DebtContainer
      playersCont.setChildIndex(plyrDebt, playersCont.numChildren - 2); // under the overCont, above plyrConts
      plyrDebt.owner = plyr
      plyrDebt.host = plyrDebt.parent
      plyr.plyrDebt[S.DebtType] = S.PlyrDebt   // replaces this.DebtType = this.name
      plyr.plyrProjs[S.DebtType] = S.plyrProj  // isPlyProj(cont) {return allPlayers.map(p=>p.plyrProjs).include(cont)}
      plyr.on(S.income, DebtContainer.tryPayDebt, undefined, undefined, plyr)[S.Aname] = "tryPayDebt"
      plyr.on("calcPayment", mainCont.calcPayment, mainCont, undefined, plyr)[S.Aname] = "calcPayment"  // from table.adjustAllRentAndStats
    })

    table.mainMap[S.DebtType] = S.mainMap
    table.tileMkts.forEach(m => m[S.DebtType] = S.market)
    table.on(S.turn, (ev: ValueEvent) => mainCont.serviceDebt(ev), mainCont)[S.Aname] = "serviceDebt"
    // ALL S.setOwner events dispatch from table.mainMap! (an accessible rendezvous)
    table.mainMap.on(S.setOwner, DebtContainer.setOwnerEvent)[S.Aname] = "DebtContainer"
    return this
  }
  /** borrowing available to Player: limited by (assets or maxDebtOfPlayer) - totalDebt & mainCont.getDebt() */
  availableDebt(player: Player): number {
    return DebtContainer.availableToPlayer(player)
  }
  isVcOwned(card: Card): boolean {
    return !!card && (card.owner instanceof VCPlayer)
  }
}
/** Holds Debt 'cards' and CardCounter showing amount of debt. */
export class DebtContainer extends CardContainer {
  static markColor: string = "rgba(50, 0, 0, .3)"  // translucent dim red
  /** Table holding this DebtContainer */
  table: Table;

  /** Player behind this VCDebt */
  owner: Player;
  /** the parent 'collateral': Tile | Policy | plyrDist (or MainDebt.parent) */
  host: Container;
  /** capitalized to display at top in debugger. */
  DebtType: string;
  /** holds reference to the CardCounter */
  counter: ValueCounter
  /** generally construct using Table.makeCardCont(,, opts:{clazz=DebtContainer, ...}) */
  constructor(source: Stack | Card[] | WH, opts?: CCopts) {
    super(source, opts)
    this.DebtType = this.name // this[S.DebtType = this.name]
    this.on(S.dragStart, this.dragStartDropTargets, this )[S.Aname] = "dragStartDropTargets"
  }
  /** inject per-table info after construction */
  override init(table: Table) {
    this.table = table
    this._regName = `${this.name}-${++table.dft.debtContId}`
  }
  get active(): boolean { return !!this.parent }
  set active(x: boolean){ if (x) this.host.addChild(this); else this.host.removeChild(this); }
  _regName: string;
  /** @override CardContainer */
  override get regName(): string { return this._regName }



  /** return card's DebtContainer: reactivate or make a new one if necessary.
   * @param card in Market, plyrProj, mainMap
   * @param name S.VCDebt | S.BankDebt
   */
  static getDebtContOnCard(card: Card, name: string): DebtContainer {
    let curPlayer = card.table.curPlayer, vcPlayer = card.table.dft.vcPlayer
    // ASSERT: card.owner == curPlayer || card.owner == undefined (NOT otherPlayer!)
    if (!!card.owner && card.owner != curPlayer && card.owner != vcPlayer) {
      // allowDrop should prevent this:
      console.warn(stime('DebtContainer', ".getDebtContOnCard:"), "Debt on other Player's card?", {curPlayer: curPlayer, name: card.name, card: card})
      try { alert(`Debt on other Player's card? ${card.owner.name}`) } catch { }
    }
    let debtCont = card.debtCont
    if (!!debtCont && debtCont.active) {
      debtCont.parent.setChildIndex(debtCont, debtCont.parent.numChildren -1)
      return debtCont // nothing to do? debtCont.DebtType = name?
    }

    if (!!debtCont) {
      if (!card.debtCont.active) {          // [re-activate] and use existing DebtContainer
        card.debtCont.DebtType = name       // may be 'repaid|undone' VCDebt|BankDebt; set correctly
        card.debtCont.active = true         // re-enable/display
      }
    } else {
      // make new DebtContainer on card for player: (card.owner == curPlayer) ? S.BankDebt : S.VCDebt
      debtCont = card.table.makeCardCont((card as Container) as ContainerAt, Debt.WH(), {
        clazz: DebtContainer, name: name, x: card.width, xl: 1.0, yt: .1,
        bg: false, dropOnCard: true, size: Debt.WH(), markColor: DebtContainer.markColor,
        counter: { color: "lightgreen", fontSize: 14, offset: { x: 2, y: undefined } as XY }
      })
      debtCont.host = debtCont.parent
      card.debtCont = debtCont
    }
    debtCont.owner = curPlayer
    // Created or re-activeated debtCont: undoRec to deactivate
    card.table.addUndoRec(card.debtCont, "active", false) // deactivate debtCont [presumably: getDebt==0]
    return debtCont
  }

  /** drag Debt 'card' FROM mainDebt to acquire Debt, or TO mainDebt to payoff Debt. */
  dragStartDropTargets(ce: CardEvent) {
    let xdebt = ce.card as Debt, table = xdebt.table
    if (!TP.allowDebtWhileMoving && table.curPlayer.isMoving()) {
      ce.cont.setDropTargets() // no drop targets
      return
    }
    table.undoEnable()   // prepare for undo in dropFunc which will: table.undoClose()
    let srcCont = ce.cont as DebtContainer;
    xdebt.srcCont = srcCont // CC.getSlotInfo(card).cont, card.origSlot.cont, card.srcCont
    let srcType: string = srcCont[S.DebtType]
    let curPlayer = table.curPlayer
    let mainCont = table.dft.mainCont
    let dropTargets: CardContainer[] = [srcCont]
    let avail = DebtContainer.availableToPlayer(curPlayer, xdebt)
    switch (srcType) {
      case S.MainDebt: { // acquire new debt
        if (avail <= 0) break
        if (curPlayer.buys > 0) {
          let mkts = table.tileMkts.filter(cont => Debt.canFinanceCard(cont.bottomCardOfStack())) // 0,0 Conts
          table.auctionTN.forAllStacks((row, col, stack) => { // auctionTN if there's a financable card there:
            if (!mkts.includes(table.auctionTN) && Debt.canFinanceCard(stack[stack.length-1])) mkts.push(table.auctionTN)
          })
          dropTargets = dropTargets.concat(mkts);   // VC to buy Tile from market
        }
        if (Debt.canFinanceCard(curPlayer.plyrProjs.bottomCardOfStack())) {
          table.gamePlay.setBuyCostTargetMark(curPlayer.plyrProjs, 1, C.legalGreen)
          dropTargets.push(curPlayer.plyrProjs);    // VC - cash to build
        }
        dropTargets.push(xdebt.table.mainMap);      // BankDebt - existing Tiles owned by curPlayer (could check AllStacks...)
        dropTargets.push(curPlayer.plyrDebt);       // Shark - just get coins (check avail < maxDebt?)
        break;
      }
      case S.VCDebt:    // payoff debt if owner of srcCont && have a coin
      case S.BankDebt:
      case S.PlyrDebt:
        if (curPlayer == srcCont.owner && curPlayer.coins > 0)
          dropTargets.push(mainCont) // self-drop is automatically included
        break
      case S.market:    // cannot happen; these types only as DEST
      case S.plyrProj:
      case S.mainMap:
      default:
        console.warn(stime(this, ".dropTargets:"), { srcCont: ce.cont, debtType: srcType, curPlayer: curPlayer })
    }
    srcCont.setDropTargets(...dropTargets);
  }
  /** It is always a good idea to pay down plyrDebt ASAP. */
  static tryPayDebt(ve: ValueEvent, player?: Player) {
    if (!TP.applyIncomeToDebt) return
    let income = ve.value as number
    if (income <= 0) return
    let plyrDebt = player.plyrDebt, mainCont = player.table.dft.mainCont
    let debt = plyrDebt.getDebt()
    if (debt > 0) {
      console.log(stime('DebtContainer', ".tryPayDebt:"), { player: player.color, income: income, debt: debt, coins: player.coins })
      mainCont.moveDebt(income, player, plyrDebt); // pay as much as able: min(debt, plyr.coins)
    }
  }
  /** at startOfTurn, prepay if able to reduce debt service. */
  tryPayPlayerDebt(player: Player) {
    if (player.coins <= 0) return
    let mainMap = player.mainMap
    let mainCont = player.table.dft.mainCont
    let pushPlyrDebt = (row: number, col: number, stack: Stack): void => {
      let dc = (stack[0] instanceof Card) && stack[0].debtCont
      if (!!dc && dc.active && dc.DebtType === "BankDebt" && dc.owner === player)
        debts.push(dc)
    }
    let debts: DebtContainer[] = []
    if (TP.tryPayBankDebt) {
      mainMap.forAllStacks(pushPlyrDebt)
      debts.sort((a, b) => a.getDebt() - b.getDebt()) // pay smallest debt first to reduce number of debts
    }
    debts.unshift(player.plyrDebt)  // pay plyrDebt before all others

    debts.forEach((dc) => {
      let debt = dc.getDebt()
      if (debt > 0 && player.coins > 0) {
        console.log(stime(this, ".tryPayPlayerDebt:"), { player: player.color, debt: debt, coins: player.coins, type: dc.DebtType })
        mainCont.moveDebt(debt, player, dc);      // pay as much as able: min(debt, plyr.coins)
      }
    })
    // TODO: search VCDebt that is < player.coins (no point to partial payment)
  }
  /** pay: VCDebt(1), BankDebt(1/10), Shark(1/5)
   * Debt from DebtContainer: player.plyrDebt, Cards in player.plyrProj, Cards in mainMap
   */
  serviceDebt(ev: ValueEvent):boolean {
    let table = this.table
    let player = table.curPlayer, plyrDebtCont = (player.plyrDebt as DebtContainer)
    let mainCont = table.dft.mainCont
    this.tryPayPlayerDebt(player)
    let available = DebtContainer.availableToPlayer(player)
    let {payments, nvcDebt, bankDebt, bankPay, plyrDebt, plyrPay} = mainCont.getDebtStats(player)

    if (payments > 0) player.adjustPlayerCoins(-payments, "serviceDebt", "interest")
    if (player.coins < 0) {
      // borrow (as much as available) to payoff BankDebt & VCDebt
      plyrDebtCont.moveDebt( Math.min(-player.coins, available), player, mainCont)
    }
    if (payments > 0) {
      console.log(stime(this, ".settleDebt:"),
        {player: player.name, nvcDebt: nvcDebt, bankDebt: bankDebt, bankPay: bankPay, plyrDebt: plyrDebt, plyrPay: plyrPay})
    }
    if (player.coins < 0) {
      console.log(stime(this, ".settleDebt"), "Player in Debt: ", {color: player.color, player: player})
      return false
    }
    return true
  }

  /** Invoked to push debtPayment from DebtStats to player.stats
   *  @param player supplied by EventDispatcher.
   */
  calcPayment(e: Event, player?: Player) {
    let dstats = this.getDebtStats(player)
    let {payments} = dstats
    player.stats.debtPayment = payments
    player.stats.debtStats = dstats
  }
  // if Debt were not source-code separated, would be method on Player...
  publishTotalDebt(plyr: Player) {
    if (!this.table.allPlayers.includes(plyr)) return // for vcPlayer
    let debtStats = this.getDebtStats(plyr)
    let totalDebt = debtStats.plyrDebt + debtStats.vcDebt + debtStats.bankDebt
    plyr.stats.totalDebt = totalDebt
    plyr.dispatchEvent(new ValueEvent("stats-debt", totalDebt))
    console.log(stime(this, ".publishTotalDebt:"), plyr.name, totalDebt)
  }

  getDebtStats(player: Player): DebtStats {
    let loanRate = TP.loanRate, bankRate = TP.bankRate
    let plyrDebtCont = (player.plyrDebt as DebtContainer)
    let nvcDebt = 0, bankDebt = 0, plyrDebt = !!plyrDebtCont ? plyrDebtCont.getDebt() : 0;
    let vcDebt = 0;

    let countDebtOnCard = (card: Card): void => {
      if (!card) return
      let debtCont = card.debtCont
      if (!(debtCont && debtCont.active)) return
      let debtType = debtCont[S.DebtType]
      if (!debtType) return
      if (!(player.isReallyOwner(card))) return
      let cardDebt = debtCont.getDebt()
      vcDebt   += (debtType == S.VCDebt) ? cardDebt : 0;
      nvcDebt  += (debtType == S.VCDebt) ? 1 : 0;
      bankDebt += (debtType == S.BankDebt) ? cardDebt : 0;
    }
    //console.log(stime(this, ".debtPayment"), vcDebt, bankDebt, plyrDebt)
    player.plyrProjs.getStack(0).forEach(c => countDebtOnCard(c)) // plyrProj with vcDebt
    let cc = player.mainMap; cc.forAllStacks((row, col, stack) => countDebtOnCard(cc.bottomCardOfStack(row, col, stack)))
    let bankPay = Math.ceil(bankDebt * bankRate)
    let plyrPay = Math.ceil(plyrDebt * loanRate)
    let payments = plyrPay + nvcDebt + bankPay
    return {payments, nvcDebt, vcDebt, bankDebt, bankPay, plyrDebt, plyrPay}
  }

  placeDebtInCont(ev: CardEvent, offx:number, offy:number) {
    this.moveAndSetSlotInfo(ev.card, 0, 0, offx, offy)
  }

  /** amount of Debt held by this DebtContainer. */
  getDebt(): number {
    return this.getStack().length
  }

  /**
   * dstDebt.moveDebt(amount, plyr, srcDebt);
   * move some Debt tokens (including xdebt) from srcDebt to [this] dstDebt.
   * @param amount max amount to transfer, may be limited by srcDebt.getDebt() or plyr.coins
   * @param plyr Player providing/receiving the coins to/from mainCont
   * @param xdebt specifies the srcDebt directly or in xdebt.srcCont
   * @return 0
   * @note xfer is limited by [amount, srcDebt.getDebt, plyr.coins] to prevent overrun
   */
  moveDebt(amount: number, plyr: Player, xdebt: Debt | DebtContainer): number {
    let dstDebt: DebtContainer = this
    let srcDebt: DebtContainer = (xdebt instanceof Debt) ? xdebt.srcCont : xdebt
    let mainCont = plyr.table.dft.mainCont
    let coin = (dstDebt == mainCont) ? -1 : ((srcDebt == mainCont) ? 1 : 0) // src=main -> VC/Bank: coin=0, VC->plyr coin=0
    if (xdebt instanceof Debt) srcDebt.addCard(xdebt)            // putItBack()
    let avail = DebtContainer.availableToPlayer(plyr)
    if (srcDebt == mainCont) { amount = Math.min(amount, avail) }
    let xfer = Math.min(amount, srcDebt.getDebt())
    if (coin < 0) { xfer = Math.min(xfer, plyr.coins) }
    if (xfer <= 0) {
      return 0
    }
    if (coin != 0) plyr.table.addUndoRec(plyr, S.coins)
    dstDebt.addUndoMoveDebt(srcDebt, xfer)
    plyr.adjustPlayerCoins(xfer*coin, "Debt", srcDebt.name) // from VC, Mort, Shark: do not use to repay!
    for (let kfer = xfer ; kfer > 0 ; kfer--) {
      dstDebt.addCard(srcDebt.bottomCardOfStack())
    }
    srcDebt.retireDebtIfPaid()                 // may addUndoRec(active = true)
    //this.table.undoClose()                   // close the xfer [& setOwner]
    this.publishTotalDebt(plyr)
    return xfer
  }
  /** return amount Debt cards to srcDebt from this DebtContainer.
   * @param this = original dstDebt; remove Debt from this DebtContainer
   * @param srcDebt original srcDebt; return Debt to this DebtContainer
   */
  addUndoMoveDebt(srcDebt: DebtContainer, amount: number = 1) {
    let dstDebt = this, debtName = srcDebt.name
    let undoMoveDebt = () => {
      srcDebt.DebtType = debtName                     // srcDebt may have been 'reused' (as BankDebt)
      // simplified version of: srcDebt.moveDebt(amount, plyr, this); plyr.coins has its own undoRec
      for (let amt = amount; amt > 0; amt--) srcDebt.addCard(dstDebt.bottomCardOfStack())
      this.publishTotalDebt(srcDebt.owner)
      this.publishTotalDebt(dstDebt.owner)
    }
    let undoName = `undoDebt(${amount})${dstDebt.name}->${srcDebt.name}`
    this.table.addUndoRec(dstDebt, undoName, undoMoveDebt)
  }
  /** borrowing available to Player: limited by (assets or maxDebtOfPlayer) - totalDebt & mainCont.getDebt() */
  static availableToPlayer(plyr: Player, xdebt?: Debt): number {
    let limitByAssets = Math.floor((plyr.stats.assets) * TP.debtLimitOfAssets)
    let creditAvailable = Math.max(0, Math.min(TP.maxDebtOfPlayer, limitByAssets) - plyr.stats.totalDebt)
    let mainCont = plyr.table.dft.mainCont
    let xdebtAvail = (xdebt instanceof Debt && xdebt.srcCont == mainCont ? 1: 0)
    let debtAvailable = plyr.table.dft.mainCont.getDebt() + xdebtAvail
    let available = Math.min(creditAvailable, debtAvailable)
    return available
  }
  /** compute VC financing on card for plyr */
  static vcBorrow(card: Card, plyr: Player, isMarketBuy: boolean, xdebt?: Debt) {
    let gplay = card.table.gamePlay
    let available = DebtContainer.availableToPlayer(plyr, xdebt)
    let buyCost = isMarketBuy ? gplay.adjustedCost(card) : TP.vcFundBaseBuild ? card.costn :
      // card is just been placed/built so price is on stack: !!! plyrProjs may rotate cards !!!
      (card.getSlotInfo().stack[S.buildCost] || 0) // gplay.adjustedBuild(card)

    // max(0, coins) bc: not allowed to payOff coins by getting VCDebt, plyr use shark if necesary...
    let minBorrow = Math.max(0, buyCost - Math.max(0, plyr.coins))
    let maxBorrow = Math.min(buyCost, available)
    if (!isMarketBuy && !(card.debtCont && card.debtCont.active)) {
      // initiate VC funding with $1 [even if buildCost is later == 0!]
      minBorrow = maxBorrow = buyCost = 1
    }
    let borrow = Math.min(available, TP.maximizeVCDebt ? Math.max(minBorrow, maxBorrow) : minBorrow)

    let useCoins = buyCost - borrow // if borrow restricted by available or !TP.maximizeVCDebt
    return { borrow, buyCost, available, useCoins }
  }
  /**
   * try create VCDebt container & transfer funds to Player (and Debt to card)
   * 3 cases: "buy" from market, initiate xdebt funding on plyrProj, "build" funding on mainMap/setOwner
   * @param card a Card in market, on plyrProj, or mainMap (existing vcDebt?)
   * @param xdebt
   * @return the VCDebt DebtContainer
   */
  static vcDebtForCard(card: Card, xdebt?: Debt): DebtContainer | undefined {
    let dbtCont: DebtContainer = undefined
    let table = card.table
    let plyr = table.curPlayer
    let mainCont = table.dft.mainCont
    let srcCont = card.parent as CardContainer
    let isMarketBuy = table.tileMkts.includes(srcCont)
    let { borrow, buyCost, available, useCoins } = DebtContainer.vcBorrow(card, plyr, isMarketBuy, xdebt) // vcBuild

    if (borrow <= 0) {
      !!xdebt && mainCont.addCard(xdebt)     // put it back, can not borrow $0
      console.warn(stime('DebtContainer', ".vcDebtForCard"), "request to borrow $0: no transaction",
      {card: card.name, buyCost: buyCost, useCoins: useCoins, available: available, pCoins: plyr.coins})
    } else if (useCoins > plyr.coins) {
      !!xdebt && mainCont.addCard(xdebt)     // return, do not borrow
      console.warn(stime('DebtContainer', ".vcDebtForCard:"), "cost exceeds available Debt plus plyr Coins:",
      {card: card.name, buyCost: buyCost, useCoins: useCoins, available: available, pCoins: plyr.coins})
    } else {
      // ASSERT: 0 < available < borrow <= buyCost; 0 < maxBorrow <= available <= buyCost; useCoins <= plyr.coins
      dbtCont = DebtContainer.getDebtContOnCard(card, S.VCDebt) // new: market/plyrProj; existing: on mainMap;
      console.log(stime('DebtContainer', ".vcDebtForCard:"), {card: card.name, buyCost: buyCost, borrow: borrow, useCoins: useCoins})
      dbtCont.moveDebt(borrow, plyr, xdebt || mainCont)   // give plyr enough to buy/build card; plyr.coin+=borrow
    }
    return dbtCont
  }

  /**
   * card.setOwner(player) invoked: card.owner and card.ownerFlag have been [re]set.
   * card "buy", "build" or "discard" [card.owner == undefined]
   *
   * [re]set card.owner = VCPlayer and VC card.flag
   */
  static setOwnerEvent(ce: CardEvent) {
    let card = ce.card, vcPlayer = card.table.dft.vcPlayer
    if (card.table.undoing() && card.owner != vcPlayer) return
    let debtCont = card.debtCont
    if (!debtCont || !debtCont.active) return // nothing to do if getDebt()==0
    let plyr = debtCont.owner
    let debt = debtCont.getDebt()
    if (!card.owner && debt > 0) {
      console.log(stime('DebtContainer', ".setOwnerEvent: no Owner for endebted Tile!"), { plyr: plyr, debt: debt })
      plyr.plyrDebt.moveDebt(debt, plyr, debtCont) // no change to plyr.coins VC->plyr (coin = 0) w/undoDebtRec
      // assert: (debtCont.getDebt() == 0); 'resetOwnerIfPaid' not useful: no owner
      // leave debtCont connected to host:Card and owner:Player in case undoMoveDebt
      return
    }
    if (debtCont.DebtType == S.VCDebt && card.owner != vcPlayer) {
      if (card.slotInfo.cont == card.table.mainMap) DebtContainer.vcDebtForCard(card)   // for Build (adjust player coins)
      card._owner = vcPlayer;    // do NOT invoke card.setOwner()
      Flag.attachFlagToCard(vcPlayer.ownerCard, card)
    }
    Flag.attachFlagToCard(plyr.ownerCard, card.ownerFlag);   // Put plyrFlag inside VCFlag:
  }

  /**
   * If this Debt has been paid off (income or D&D) and is Card-hosted:
   * deactivate this DebtContainer [so can recycle VCDebt -> BankDebt]
   * if (card.owner == vcPlayer) { card.owner = this.owner }
   * @return false if Debt remains, else undefined
   */
  retireDebtIfPaid(): boolean {
    if (this.getDebt() != 0) return false;
    if (!(this.host instanceof Card)) return undefined; // for plyrDebt | mainDebt: do nothing
    this.table.addUndoRec(this, "active")    // so undo owner->VC will do Flags
    this.active = false                      // no debt, no Bank/VCPlayer claims or interest
    let card = this.host
    if (card.getSlotInfo().cont == this.table.discardT) return undefined;  // do not restore owner or Flag
    if (card.owner == this.table.dft.vcPlayer) // vs: no owner or self-owned
      { card.owner = this.owner }              // if VCDebt: card.setOwner(origOwner); w/undoRec -> VCPlayer
    card.table.adjustAllRentsAndStats()
    return undefined;
  }

  /** add under the CardCounter */
  override addCard(card: Card, row?: number, col?: number): Card {
    super.addCard(card, row, col)
    let counter = this.getStack(row, col)[S.cardCounter], end = this.numChildren - 1 // put cardCounter on top:
    counter && this.setChildIndex(counter, end)
    return card
  }
}
/** VCPlayer collects [rental] income and applies it to Debt. */
export class VCPlayer extends Player {
  /** Override Player.coins: no dispatch event */
  override get coins() { return this._coins }; override set coins(n: number) { this._coins = n; }

  override payDamage(value: number, src?: Card, toWhom?: string) {
    // do nothing...
  }
  /**
   * invoked when vcPlayer collects rent; curPlayer has stepped/stopped on vc-owned card
   * @override income to vcPlayer: apply income to debt, returnIfPaid.
   * @param income income to vcPlayer; a positive number
   * @param src string indicating: "step" or "rent"
   * @param otherParty vcPlayer.name = "player1-BLUE" (curPlayer.name)
   */
  override adjustPlayerCoins(income: number, src?: string, otherParty?: string) {
    if (!income || income <= 0) return     // VC never pays: this is reentrant call from moveDebt
    let curPlayer = this.table.curPlayer   // assume rent coming from curPlayer on card
    let mainCont = this.table.dft.mainCont
    let card = curPlayer.onCard()
    let debtCont = card.debtCont
    if (!debtCont || !debtCont.active) {
      try { alert("VCPlayer.adjustPlayerCoins: debtCont is gone: "+card.name) } catch {}
      console.log(stime(this, ".adjustPlayerCoins: debtCont is gone"), {card: card, curPlayer: curPlayer, income: income})
      return
    }
    let owner = debtCont.owner; // Player who owns the Debt; Q: do they pay rent? A: yes, discounted
    let repay = Math.min(income, debtCont.getDebt())
    this.coins = repay; // give vcPlayer the coins so moveDebt can finish it:
    mainCont.moveDebt(repay, this, debtCont) // vcTile -> mainCont;
    let residual = income - repay
    // if debt was repaid, transfer residual income:
    if (!debtCont.active && (residual > 0)) {
      console.log(stime(this, `.adjustPlayerCoins[${src}] to:`), {owner: owner, value: residual})
      owner.adjustPlayerCoins(residual, src, otherParty);  // owner recieves residual from curPlayer/otherParty
    }
    mainCont.publishTotalDebt(owner)
  }
}
/** Debt tokens: borrow or repay loans. */
export class Debt extends Card {
  /** prototypical Debt card. */
  private static debtCard: Debt = undefined;
  /** size of a Debt card. */
  static WH(): WH { return Debt.debtCard.getWH(); }

  constructor(card: Card) {
    super(card, 1, card.table)
  }
  destructor() {
    this.table = this.parent = this.slotInfo = undefined // remove from Table and Display
  }

  static resetDebtCards(table: Table, allDebtCards: Debt[]): Debt[] {
    let tokenCards = table.tokenCards
    if (!(Debt.debtCard instanceof Debt)) {
      Debt.debtCard = tokenCards.find(card => card.type == "Debt") as Debt;
    }
    // restarting, possibly more/fewer Debt cards
    let nCards = allDebtCards.length
    if (nCards < TP.nDebtCards) {
      for (let i = nCards; i < TP.nDebtCards; i++) allDebtCards.push(new Debt(Debt.debtCard))
    } else {
      for (let i = nCards; i > TP.nDebtCards; i--) allDebtCards.pop().destructor()
    }
    allDebtCards.forEach(d => d.init(table))
    return allDebtCards // ASSERT (Debt.allDebtCards.length == TP.nDebtCards)
  }
  init(table: Table) {
    this.table = table;
    this.parent = this.slotInfo = undefined;
    this.addTargetMark()
  }
  /**
   * a DEST cont is a DebtContainer or a CardContainer (when initiating VCDebt or BankDebt)
   * a SOURCE cont is always a DebtContainer; but may be on a Card in S.plyrProj or S.mainMap.
   * @param debtTarget is dropTarget: a CardContainer OR a DebtContainer (Debt.mainCont or Card in market or plyrProj)
   * @return one of: [MainDebt, PlyrDebt, VCDebt, BankDebt, mainMap, market, plyrProj]
  */
  static getDebtType(debtTarget: CardContainer): string {
    let debtType = debtTarget[S.DebtType]
    if (!!debtType) return debtType  // dropTarget: CardContainer or Debt.mainCont
    // ASSERT: (debtTarget instanceof DebtContainer)
    // ASSERT: (debtTarget.parent instanceof Card)
    // ASSERT: (debtTarget.parent.parent instanceof CardContainer) in [market, plyrProj, mainMap]
    return (debtTarget.parent.parent as CardContainer)[S.DebtType]
  }

  srcCont: DebtContainer = ("unset" as unknown as DebtContainer); // whence came the coin being dropped

  makeTargetMark(mark?: DisplayObject) {
    // run CardContainer.makeTargetMark on this Debt container
    this.table.mainMap.makeTargetMark.call(this, mark)
  }
  hideTargetMark() {
    this.table.mainMap.hideTargetMark.call(this)
  }
  showTargetMark() {
      this.table.mainMap.showTargetMark.call(this)
  }
  addTargetMark() {
    this["slotSize"] = this.getWH()
    this.table.gamePlay.makeBuyCostTargetMark(this as any as CardContainer)
  }
  showXfer(xfer: number, show = xfer > 0): boolean {
    // like GamePlay.setBuyCostTargetMark...
    // all we have to do is create Debt.targetMark
    // and setBuyCostTargetMark will do the rest.
    // happily, GamePlay.makeBuyCostTargetMark(cont) will do all that.
    if (show) {
      this.table.gamePlay.setBuyCostTargetMark(this as any as CardContainer, xfer, C.coinGold)
      this.showTargetMark()
    } else {
      this.hideTargetMark()
    }
    return show
  }
  /**
   * @return true if card is an un-financed Tile.
   * Disallow Tiles that produce no income: {Road, Lake}
   */
  static canFinanceCard(card: Card) {
    return !!card && card.isTile("Road") && (card.name != "Lake") && !(card.debtCont && card.debtCont.active)
  }
  override useDropAt: boolean = true
  /**
   * While dragging: true if can borrow or repay at the indicated slot.
   * @param dstCont dropTarget CardContainer
   * @param row
   * @param col
   * @return true if allow Debt Card to drop in the given slot.
  */
  override allowDropAt(dstCont: CardContainer, row: number, col: number): boolean {
    this.hideTargetMark()
    let plyr = this.table.curPlayer
    //let gplay = this.table.gamePlay
    //let avail = DebtContainer.availableToPlayer(plyr, this)
    let plyrCoins = plyr.coins
    let card = dstCont.bottomCardOfStack(row, col) ; // is there a card/debt on destCont?
    let owner = (dstCont instanceof DebtContainer) ? dstCont.owner : !!card && card.owner // or undefined
    let srcCont = this.origSlot.cont as DebtContainer
    let srcType = Debt.getDebtType(srcCont)
    let dstType = Debt.getDebtType(dstCont)
    let inflight = (srcCont.getStack(this.origSlot.row,this.origSlot.col).includes(this) ? 0 : 1)
    switch (srcType) {
      case S.MainDebt:      // new Debt: assert (avail > 0) from setDropTargets
        switch (dstType) {
          case S.MainDebt:  // self-drop: put it back (1 Debt)
            return true;
          case S.market: {    // attempt to buy; srcCont == mainCont [create VCDebt]
            if (!Debt.canFinanceCard(card)) return this.showXfer(0)
            // Must have enough purchasing power to complete the Buy:
            let { borrow: xfer, useCoins} = DebtContainer.vcBorrow(card, plyr, true, this) // market drop
            return this.showXfer(xfer, useCoins <= plyr.coins)
          }
          case S.plyrProj: { // create VCDebt on buildable Tile; must have *some* credit available:
            if (!Debt.canFinanceCard(card)) return this.showXfer(0)
            let { borrow: xfer, useCoins} = DebtContainer.vcBorrow(card, plyr, false, this) // plyrProj drop
            return this.showXfer(xfer, useCoins <= plyr.coins)
          }
          case S.PlyrDebt: { // increase shark debt
            let avail = DebtContainer.availableToPlayer(plyr, this)
            return this.showXfer(avail)
          }
          case S.BankDebt:  // try increase mortgage
          case S.mainMap:   // create BankDebt: may generate zero coins... (dropFunc will compute)
            if (!card || owner != plyr) return this.showXfer(0)
            let avail = DebtContainer.availableToPlayer(plyr, this)
            let amount = this.refiCashOut(card, avail)
            return this.showXfer(amount)
          case S.VCDebt:
            return this.showXfer(0);   // NOT allowed to increase VCDebt
          default:
            return this.showXfer(0)    // ???
        }

      // repay debt -> mainCont (all or 1)
      case S.plyrProj:   // unlikely; but for UNDO? -> mainCont
      case S.BankDebt:
      case S.VCDebt:   {
        let debt = srcCont.getDebt() + inflight
        let amount = plyrCoins > 0 ? (plyrCoins >= debt ? debt : 1) : 0
        return this.showXfer(amount)
      }
      case S.PlyrDebt:   { // repay VC -> mainCont [filer on dragstart to ensure (plyr == owner)]
        //console.log(stime(this, ".allowDropAt:"), {card: card, dstCont: dstCont})
        let debt = srcCont.getDebt() + inflight
        let amount = plyrCoins > 0 ? (plyrCoins >= debt ? debt : plyrCoins) : 0
        return this.showXfer(amount)
      }
      // never happens:
      case S.mainMap:   // cannot actually SOURCE a Debt token from mainMap (vs DebtCont on Card on mainMap)
      case S.market:    // cannot actually SOURCE a Debt token from market
      default:
        return false
    }
  }
  curMortgage(card: Card): number {
    return (!card.debtCont || !card.debtCont.active) ? 0 : DebtContainer.getDebtContOnCard(card, S.BankDebt).getDebt()
  }
  /** @return [add'l] amount that can be borrowed on given card */
  refiCashOut(card: Card, avail: number): number {
    // Note: a "second mortgage" may generate zero coins... (limit to costn+rent)
    let credit = Math.floor(Math.max(0, card.costn + card.rent - this.curMortgage(card)))
    return Math.min(credit, avail)
  }
  override useDropFunc: boolean = true;
  /** Card.dropFunc: implement effects of dropping Debt: coins, VC: buy
   *
   * @param srcCont from this.origSlot.cont in dropFunc0; also: DragStartDropTargets sets this.srcCont
   * @param dstCont target Container in pressup event (last 'mark') may be a DebtContainer
   * @param row in dstCont
   * @param col in dstCont
   * @return true to disable container.dropFunc
   */
  override dropFunc(srcCont: DebtContainer, dstCont: CardContainer, row: number, col: number): boolean {
    this.hideTargetMark()
    let xdebt = this;
    let card = dstCont.bottomCardOfStack(row, col)  // peek at card (esp of mkt), if stack has one
    if (card instanceof HouseToken) card = dstCont.bottomCardOfStack(row, col) // on mainMap
    // dstDebt is one of: MainCont, PlyrCont OR a Card in market, mainMap, plyrProj (replace with getDebtContOnCard(card))
    let dstDebt: DebtContainer = dstCont as DebtContainer;
    let plyr = this.table.curPlayer
    let plyrDebt = plyr.plyrDebt as DebtContainer
    let stage = this.table.stage
    let avail = DebtContainer.availableToPlayer(plyr, xdebt)
    // anticipating moveDebt(xdebt)->putItBack()
    let inflight = (srcCont.getStack(this.origSlot.row,this.origSlot.col).includes(this) ? 0 : 1)

    let srcType = Debt.getDebtType(srcCont)
    let destType = Debt.getDebtType(dstCont)
    // since cmClient, 'drop' does a putItBack() before we get here!
    let putItBack = () => srcCont.addCard(xdebt)   // equiv to: xdebt.putItBack(), but we know srcCont & row=col=0
    switch (srcType) {
      case S.MainDebt:    // new Debt (per allowDropAt: avail > 0)
        switch (destType) {
          case S.MainDebt:
            putItBack(); break;
          case S.market:                             // get VC funding to buy Tile
            if (!Debt.canFinanceCard(card)) {       // already tested in allowDropAt...
              putItBack(); break;
            };
            if (plyr.buys <= 0) { putItBack(); break}
            dstDebt = DebtContainer.vcDebtForCard(card, xdebt) // Buy with vcDebt; coins->curPlayer
            if (!dstDebt) { putItBack(); break };    // funding rejected!
            // synthesize drag & drop, move, curPlayer.payPlayerBuyCost, setOwner(); card.parent is srcCont
            let dst = plyr.plyrProjs
            dst.dragStartAndDrop(new CardEvent(CC.dropEvent, card, 0, 0, dst)) // S.dropped -> payPlayerBuyCost() -> setOwner
            dstDebt.publishTotalDebt(plyr)
            break;
          case S.plyrProj:                           // get $1 VC funding for future build
            if (!Debt.canFinanceCard(card)) {
              putItBack();                           // not fundable OR already funded
            } else {
              dstDebt = DebtContainer.vcDebtForCard(card, xdebt) // move $1 to indicate VC ownership
              card.setOwner(card.table.dft.vcPlayer) // Debt.setOwnerEvent() to paint Flag(s)
            }
            break;
          case S.PlyrDebt:
            plyrDebt.moveDebt(1, plyr, xdebt)         // src=main -> dst=plyr; coin +1
            break;
          case S.VCDebt:
            putItBack();                              // can not increase VCDebt
            break;
          case S.mainMap: // new BankDebt on Card
            // fail if not plyr's card or if active VCDebt on card:
            if (card.owner !== plyr || (!!card.debtCont && card.debtCont.active && card.debtCont.DebtType !== S.BankDebt)) {
              console.log(stime(this, ".dropFunc: Oops! should not drop here:"), {plyr: plyr, cardnam: card.name, card: card})
              putItBack();
              break;
            }
            let amount = this.refiCashOut(card, avail) // may be zero
            if (amount > 0) {
              dstDebt = DebtContainer.getDebtContOnCard(card, S.BankDebt)
              dstDebt.moveDebt(amount, plyr, xdebt) // src = mainCont -> Bank; coin = 1
            }
            break;
        } // end of destType switch of S.mainMap
        break;
      case S.BankDebt:  // repay Bank -> mainCont
      case S.VCDebt:    // repay VC -> mainCont [filer on dragstart to ensure (plyr == owner)]
        if (destType == S.MainDebt && srcCont.owner == plyr) {
          let debt = srcCont.getDebt() + inflight      // +1 for this/xdebt being dragged
          let amount = (plyr.coins >= debt ? debt : 1) // if possible: pay it all
          dstDebt.moveDebt(amount, plyr, xdebt);   // payoff remaining Debt in srcCont: VC/Bank -> mainCont, coin = -1
        } else {
          putItBack();
        }
        break;
      case S.PlyrDebt:  // repay debt -> mainCont
        if (destType == S.MainDebt && srcCont.owner == plyr) {
          dstDebt.moveDebt(srcCont.getDebt(), plyr, xdebt); // srcCont=plyr -> mainCont : coin = -1
        } else {
          putItBack()   // should be blocked by allowDrop...
        }
        break;
      case S.plyrProj:  // cannot actually SOURCE a Debt token from S.plyrProj
      case S.mainMap:   // cannot actually SOURCE a Debt token from S.mainMap
      default:
        putItBack();
        console.log(stime(this, ".dropFunc: unexpected drop:"), { srcCont: srcCont, cont: dstCont, row: row, col: col })
        break;         // even so.. do not process as a card drop.
    }
    this.table.undoClose()
    plyr.robo.notify(this.table, S.dropDone, 2) // borrow Done: Debt Dropped -> S.dropDone -> actionEnable
    stage.update()
    return true; // prevent addCard() in the default dropFunc
  }
}
