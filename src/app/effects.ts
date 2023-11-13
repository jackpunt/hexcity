import { findFieldValue, stime } from '@thegraid/common-lib'
import { DisplayObject, Text } from '@thegraid/easeljs-module'
import { C, F, Obj, S } from './basic-intfs'
import { Card, Flag, HouseToken, Stack } from './card'
import { CardEvent, ValueEvent } from "./card-event"
import { ChooseDir, DirSpec } from './choose-dir'
import { MoveRec } from './main-map'
import { Player } from './player'
import { Table } from "./table"
import { TP } from './table-params'
import { ValueCounter } from "./value-counter"

/** extreme form of JSON-minification */
function json(obj: object): string {
  return JSON.stringify(obj).replace(/"/g, '')
}
interface Action {
  target: object
  field:string
  verb:string // {set, add}(number) {include, exclude}(direction)
  value:number
}

// SCOPE:
// Discard terminates/removes onBuild records of a Card
// if (card.hasDRinDB) this.effects.removeDRsOfCard(card);

// The main/only use is to compute buildCost from Cards with Range filters?
// Also rent: (onBuilt (rent (add 2)) (range 2) (filter (subtype "Industrial")))
// Also cost: dynaCost for High Tech

// So: rent computer [card.rent ==> get rent() {...} ]
// looks for Records matching subject=card; [and its type/subtype/row-col/etc]
// applying any filter as supplied


// onThings: [find & evaluate when doing the associated action]
// (on (move, draw, buy, turnStart )), onStep, onStop, onMove, onGetDist, onBuild

// value things: [find and adjust value when computing]
// buys, builds, moves, draws (direct effect, "one shot"; no search?)
// rent[Adjust], cost[Adjust], dist[Adjust], distChoose,  rangeAdjust, buildAdjust, stopAdjust (wages)
// turnBuys, turnBuilds, turnMoves, turnDraws (long-term Policy effects)
//
// special routines: [direct action, maybe action of "on" clause]
// chooseDir, blockedDir (include/remove), drawMore, mayRejectDist, distMoved (count steps?)
// offerChoice, [payOwner]

// find/evaluate all the (onStop ..) before assessing Wages & Rent


// when a card is dragged from plyrProjs, we run all the buildAdjust methods
// and makeLegalMark for each [row,col] showing the adjusted buildCost.
// then dragSetNewSlot looks at the legalMark to decide isDropTarget(slot)

// data-record == {subject:(Player|Card), untilKey:string, trigger:string, responses:(field-clause|special-action)[] }

// card-prop      ::== {untilKey: trigger-clause} | trigger-clause
// Tile  : {untilKey: resp-clause}
// Policy: {untilDiscard: {onStep: field-clause}}
// trigger-clause ::== {trigger: resp-clause } | resp-clause
// trigger        ::== [ onStep, onStop, onMove, onTurnStart, onGetDist]
// resp-clause    ::== [field-clause | special-action]*

// special-action ::== [when, chooseDir, chooseDist ]

// field-clause ::== { field-name: action-clause* filters? }
// field-name ::== [field1, field2, field3]
// field1  ::== [ buys, builds, draws, moves, dist,]           // player-field
// field2  ::== [ drawMore, rangeAdjust, buildAdjust]          // player-field
// field3  ::== [ costAdjust, stopAdjust, rentAdjust]          // card-field

// action-clause  ::== { [add, set, min, max, include, remove] : value:number|vector }
// filters        ::== 'filter' : { filter-clause | { not: clause-clause } }*
// filter-clause  ::== { range?:number, type?:string, subtype?:string }

// RespClause: FieldClause | SpecialClause
// FieldClause: {fieldName, ActionClause[], Filter} => { eval (if (filter field) (progn () (action0 f) (action1 f) (action2 f) ...)) }
// SpecialClause: {SpecialName, SpecialValue} => { eval (specName specVal) }
// evalSpecial: (specialHandlers(specName) specVal)

/** {not?:FilterSpec, range?:number, type?:string|string[], subtype?:string|string[], name?:string|string[]}
 * Better: {test: value} test in {not, range, typ, subtype, onCard, isOwner, player, [relOp], }
 * value: number | number[] | string | string[]
*/
type FilterSpec = {
  not?: FilterSpec, or?: FilterSpec | FilterSpec[],
  range?: number, from?: string, type?: string | string[], subtype?: string | string[], name?: string | string[],
  isOwner?: boolean // true | false
}
// expect *one* of 'range', 'type', 'subtype'; and maybe 'not'

type ResponseArray = ResponseClause[]
interface DRSpec { aname?: string, card: Card, subject?: (Player | Card), untilKey?: string, onTrigger?: string, responses?: ResponseArray }
/** hold the registry of Card Props and "On" effects. */
export class DataRecord implements DRSpec {
  constructor(arg: DRSpec) {
    this.subjectName = arg.subject.name;
    this.onTrigger = arg.onTrigger
    this.untilKey = arg.untilKey
    this.aname = arg.aname
    this.card = arg.card;
    this.subject = arg.subject;
    this.responses = arg.responses || Array<ResponseClause>()
  }

  /**
   * When the Effect happens: onSomething
   * onSomething is triggered when the Player/Card does 'something'.
   * Tile/Policy Effects that are *always* active are coded as 'onBuild'
   * (Good Until Specifically Cancelled)
   *
   * onBuild is the default onTrigger: the effect applies/is-tested until removed from DB
   * a subject:Card with [text-low] status Effects are asserted 'onBuild', with {filter: {onCard: true}};
   * onBuild: {onCard: true} effects stay in DB, but are only applied when player is onCard
   * {type: Event} isDiscardActivated: effects are asserted, doEffects, & removed
   *
   * onTrigger effects are removed when the asserting Card is discarded (implicit untilDiscard)
   * untilKey effects remain until the key action is taken: untilBuys, untilBuilds, untilDraws, untilPolis
   *
   */
  onTrigger: string         // onStep, onStop, onMove, onArrive ("Rest Stop"), onGetDist
                            // onMove, onDraw, onBuy, onTurnStart, onGetBuildCost
                            // onBuild, special? futureEvent?
  /**
   * Duration of the Effect, especially when other than 'untilCardIsRemoved'.
   * Allows effect to live after subject Card is discarded
   */
  untilKey?: string // untilDraws, untilBuilds, untilBuys
  // untilBuilds/untilBuys is one-shot (buildAdjust, costAdjust): from "addDR" until "payBuildCost"
  // untilDraws is active (from enactment) until "draw" action removes it
  // untilKey: untilTurnEnd, untilBuilds, untilBuys, untilDraws

  subjectName?: string;   // only for debug/readability
  aname: string
  /** the Card that created this DataRecord */
  card: Card              // the card that createed this DataRecord
  subject?: Player|Card   // the "scope" of this trigger:action

  responses: ResponseArray =[];
  zbreak: boolean = undefined // set true; to break 'doEachResponse' loop
  /** original player.curCard (for restart doResponses) */
  zcard: Card;                // original onCard (for restart doResponses)
  zplyr: Player;              // original invoking player (for restart doResponses)
  zlast: number;              // where in responses to restart/continue

  /** convert respClause to ResponseClause[]
   * @respObject { fieldName: {verb: val, ... }, specialName: { }, ..., specialName: specVal, ...}
   * @responses push the new responses on the ResponseArray (default: this.responses)
   */
  addResponses(respObject: Record<string, any>, responses: ResponseArray = this.responses): ResponseArray {
    let pushFieldClause = (key: string, val: object): boolean => {
      if (!FieldClause.isFieldName(key)) return false
      // fieldName, val: {select: ActionValue, ..., filter: {...})
      responses.push(new FieldClause(this, key, val))
      return true
    }
    let pushSpecialClause = (key: string, val: any): boolean => {
      let sc = new SpecialClause(this, key, val).parseSpecial(responses)     // parse may modify name, value, etc.
      if (!sc.hasSpecialHandler(sc.specialName)) return false
      responses.push(sc)
      return true
    }
    let fail = (key: string, val: any) => {
      let msg = `respClause is not fieldName or specialName: {${key}: ${val}}`
      try { alert(msg) } catch { }
      console.log(stime(this, ".addResponses: unparsed respClause:"), { key, val }, respObject, this)
    }
    /** parseField or parseSpecial  */
    let parseKeyVal = (key: string, val: any) => {
      pushFieldClause(key, val) || pushSpecialClause(key, val) || fail(key, val)
    }
    if (typeof(respObject) != "object") {
      let msg = "respObject is not type object: "
      console.log(stime(this, ".addResponses:"), {msg, respObject})
      try { alert(msg+respObject) } catch {}
      console.log(stime(this, ".addResponses:"), {msg, dr: this})
    }
    if (respObject[0]) {
      (respObject as [key: string, val: object][]).forEach(([key, val]) => parseKeyVal(key, val));
    } else {
      Object.entries(respObject).forEach(([key, val]) => parseKeyVal(key, val))
    }
    return responses
  }

                          // testing status of Player(onTile?) or a Card(built?)
  static onTriggerNames = [S.onBuild, S.onStep, S.onStop, S.onMove, S.onGetDist, S.onTurnStart]
  static untilKeys = [S.untilDraws, S.untilBuys, S.untilBuilds]
  // now using: untilDiscard, untilBuilds, untilDraws as untilKey
  // [Note: untilDiscard is *implicit* on all Effects, remove if subject == card]
  // leaving only 'onBuild' 'onStep', 'onStop' 'onMove' as onTrigger

  /// TODO: 'zdr' is really a 'response-processor'. we need a stack of them,
  // and resp-proc.zbreak() will save the index into each one,
  // so that resp-proc.zcont() will restart them correctly (at the point of break)
  // TODO: parameterize with (curCard, player, ecard, ndx); avoid the amibiguity of 'card' ?
  // NOTE: the declaring card is alwasy: this.card!!
  /**
   * 'this' DataRecord was selected by trigger,subject to be Card-effective.
   * @param card the Card on which player is onStep, onStop, onMove, (or while Deferred/Event)
   * @param player generally table.curPlayer
   * @return false if DRs of card are suppressed
   */
  doEachResponse(card: Card, player: Player, ndx: number = 0) {
    if (this.cardIsDeactivated(this.card, player)) return false // card is null for Policy:onTurnStart
    this.zbreak = undefined
    this.zcard = card
    this.zplyr = player
    while (ndx < this.responses.length) {
      let resp = this.responses[ndx]
      console.log(stime(this, `.doEachResponse: resp`), {ndx, card: card && card.name, plyr: player.name, resp})
      this.zlast = ndx
      this.responses[ndx++].doResponse(card, player)
      if (this.zbreak) {
        console.log(stime(this, `.doEachResponse: zbreak!`), {ndx, card: card && card.name, plyr: player.name})
        break  // _offerChoice will set this.break = true
      }
    }
    return true
  }
  /** return true if this response is suppressed or inactive. */
  cardIsDeactivated(card: Card, player: Player): boolean {
    let dr: DataRecord
    if (dr = Effects.effects.isSpecialRule("suppressCard", card.name)) {
      console.log(stime(this, `.isSuppressed: ${dr.aname} by ${dr.card.name}`), {card: card})
      return true
    }
    // implicit filter for cards that can be public or private:
    // but allow temp-policy to decrement via onTurnStart
    return (card.isInactivePolicy(player) && (this.onTrigger != S.onTurnStart))
  }
  /** restart doEachResponse of this DataRecord at responses[zlast] (after choice) */
  restart() { this.doEachResponse(this.zcard, this.zplyr, this.zlast)} // restart
}
/** fieldName (FieldClause) or hasSpecialHandler (SpecialClause).
 * Either way: doResponse(card, player) */
// Effects are found 2 ways:
// 1. "onPhase" effects are found when the Game does the phase: (onStep -> (dist (add -1)))
// 2. "adjustX" effects are found when the Game needs X: payRent checks adjustRent, configBuildCost checks adjustBuild

export class ResponseClause {
  zdr: DataRecord;                // link back to DataRecord to methods can find (subject)

  constructor(dr: DataRecord) {
    this.zdr = dr
  }
  /** abstract method: FieldClause, SpecialClause */
  evalResponse(card, player): void | boolean  {}
  /**
   * if !(suppressed || inactive) evalResponse(card, player)
   * @param card the Card being affected by this Response OR for Deferred/Event *is* card0 OR null for onTurnStart
   * @param player the current Player?
   */
  doResponse(card0: Card, player: Player): void | boolean {
    let card = card0 || this.zdr.card
    return this.evalResponse(card, player)
  }
}

/** effects on the fields of Cards or Players. */
export class FieldClause extends ResponseClause {

  fieldName: string         // blockedDir [include/remove], mayRejectDist, arriveEffect==onArrive
  actions: ActionClause[] = Array<ActionClause>() // {set: 0} {add: field2} {max: 4} ...
  filters?: FilterSpec  // syntactically, there can be only 1 FilterClause on a FieldClause!

  // S.buildAdjust refers to: Build-Cost of a Tile (!isPolicy)
  // costAdjust [costAdjust] is the Buy-Cost (Tile or Policy)
  static cardAdjustField = [S.costAdjust, S.stepAdjust, S.stopAdjust, S.rentAdjust, S.buildAdjust, ]
  static cardUpdateStats = ['cost', 'step', 'stop', 'rent', 'vp']
  static cardQuery = ['noStop', 'name', 'type', 'subtype',  // evalFilters (name, type, subtype)
    'owner', // note: for "owner", ActionValue must be cast to/from Player
    ]
  static cardFields = [].concat(FieldClause.cardUpdateStats, FieldClause.cardAdjustField, FieldClause.cardQuery)

  /// TODO: convert isPolicy() to: get isPolicy = () => this.type == "Policy"   [and for other Card.isXyz()]
  static plyrAdjustFields = [S.drawNAdjust, S.polisAdjust, S.polisCostAdjust, S.rangeAdjust, S.rangeAdjustTurn, S.blockedDirAdjust, ]
  static plyrFields = [S.buys, S.builds, S.draws, S.moves, S.dist, S.coins, S.polis,
    'distMoved', 'temp', 'mayRejectDist', 'moveDir', 'saveDir', 'payOwner', 'direction', 'range',
    S.arrivalFrom, S.rgbColor, S.noRent, ].concat(FieldClause.plyrAdjustFields)
  static fieldNames = Array<string>().concat(FieldClause.cardFields, FieldClause.plyrFields)
  /** any of: cardFields, plyrFields, adjFields */
  static isFieldName(name:string):boolean {
    return FieldClause.fieldNames.includes(name);
  }
  static isCardField(name: string): boolean {
    return FieldClause.cardFields.includes(name);
  }
  /** card(cardFields) or player(plyrFields,adjFields) */
  static fieldSubject(fieldName: string, card: Card, player: Player):(Card|Player) {
    return (
      (FieldClause.cardFields.includes(fieldName)) ? card
    : (FieldClause.plyrFields.includes(fieldName)) ? player
    : undefined)
  }

  static fieldAndConst(field_value: object, card: Card, player: Player): any[] {
    let [fieldName, value] = Object.entries(field_value)[0] // assert: val is simple value
    let subj = FieldClause.fieldSubject(fieldName, card, player)
    return [subj[fieldName], value]
  }
  static relOp(op:string, field_value: object, card: Card, player: Player):boolean {
    let [v1, v2] = FieldClause.fieldAndConst(field_value, card, player)
    switch (op) {
      case "gt": return v1 > v2;
      case "lt": return v1 < v2;
      case "le": return v1 <= v2;
      case "ge": return v1 >= v2;
      case "eq": return v1 == v2;
      case "ne": return v1 != v2;
      default: return false;
    }
  }
  constructor(dr: DataRecord, fieldName: string, val: object) {
    super(dr)
    this.parseField(fieldName, val) // push val to this.actions (& this.filter)
  }

  /**
   * @param key fieldName
   * @param val is {verb: value, ...} OR simple value --> {set: value} for Card initializers
   */
  parseField(key: string, val: object) {
    this.fieldName = key;
    if ((typeof val) === "object") {
      // parseActionClauses & FilterClauses: (fieldName (verb1 ...) (verb2...) (verb3 ...))
      // for verbs such as: [set, add, min, filter, ...]
      const doVerbValue = (verb: string, value: ActionValue | FilterSpec) => {
        if (verb === 'filter') {
          this.filters = value as FilterSpec   // value is a FilterSpec Object
        } else {
          // ASSERT value is const terminal: number | string | string[]; not parsed or evaluated here
          let ac = new ActionClause(verb, value as ActionValue) // actions ActionValue[]
          this.actions.push(ac)
        }
      }
      if (!val[0]) { // object with multiple [distinct] key-value pairs:
        const kvl = val as { [k: string]: ActionValue | FilterSpec }
        Object.entries(kvl).forEach(elt => doVerbValue(...elt));
      } else {  // array of objects, each with a single key-value pair:
        const kva = val as { [k: string]: ActionValue | FilterSpec }[];
        kva.forEach(elt => doVerbValue(...Object.entries(elt)[0]));
      }
    } else {
      // Card initializers! (fieldName value)  vs (fieldName (set value))) for such as [step, stop, rent]
      // assert: (typeof val) == ActionValue
      let ac = new ActionClause("set", val as ActionValue)
      this.actions.push(ac)
    }
  }

  /** return true IFF the given card, player and dr.subject meet conditions of filterClause.
   * spec = {not?:FilterSpec, or?: FilterSpec[], range?:number, from?:string, type?:string|string[], subtype?:string|string[], name?:string|string[]}
   *
   * @param card the Card to be affected
   * @param player
   * @param card0 the Card that asserted this FieldClause (OR player.onCard scanTo(filter))
   * @return true if all filters of this FieldClause evaluate TRUE
   */
  evalFilters(card: Card, player: Player, card0: Card): boolean {
    /** satisfy any/one condition */
    let orSpec = (specs: FilterSpec[]):boolean => {
      // if any [sel,val] spec evals to TRUE, return TRUE; else return FALSE
      return !!Object.entries(specs).find(([select, value]) => evalSelectVal(select, value));
    }
    /** match any/one string */
    let orString = (target: string, vals: string | string[]) => {
      if (typeof vals === 'string') return (target == vals);
      let valS = Array.from(vals);
      while (valS.length>0) {
         if (target == valS.shift()) return true
      }
      return false;
    }
    let evalSelectVal = (select: string, val: ActionValue | FilterSpec | FilterSpec[] ):boolean => {
      switch (select) {
        case 'not': return !evalSpec(val as FilterSpec);
        case 'or': return orSpec(val as FilterSpec[])
        case 'name': return orString(card && card.name, val as string | string[]);
        case 'type': return orString(card && card.type, val as string | string[]);
        case 'subtype': return orString(card.subtype, val as string | string[]);
        case 'onCard': return player.isOnCard(card0);
        case 'noStop': return (card.noStop === val);  // val = #f to select rentable tiles
        // #t to confirm player owns the source, #f to confirm player owns the destination Tile
        case 'isOwner': return (player == (val ? card0.owner : card.owner)); // card0 activated if player owns it
        case 'range': {
          let limit = (val as number || 0) + 1; // +1 means: stop counting when out of range
          let from = (this.filters.from === 'curPlayerCard') ? player.onCard() : card0;
          let range = player.mainMap.rangeTo(from, card, limit); // in interval [0 .. limit]
          return range <= this.filters.range;
          this.zdr.card.table.effects
        }
        case 'from':
          return true // not an actual filter selector...
        case 'gt': case 'ge': case 'lt': case 'le': case 'eq': case 'ne':
          return FieldClause.relOp(select, val as object, card0, player)
        default:
          // TODO: enable all NamedValue for filter? znamedValues.eval(card, select) === val;
          if (!!card && card[select] !== undefined) return (card[select] == val)
          console.log(stime(this, ".evalSelectVal: unparsed filter selector:"), select, "val=", val);
          return false;
      }
    }
    /** ANDify across the FilterSpec */
    let evalSpec = (spec: FilterSpec): boolean => {
      // if any FilterSpec is false, return false
      return (spec['key0']) ?
        !(spec['key0'] as FilterSpec[]).find(specn => { // array of single-item objects:
          let [select, value] = Object.entries(specn)[0];
          return !evalSelectVal(select, value);
        }) :
        !Object.entries(spec).find(([select, value]) => { // object with multi-items:
          return !evalSelectVal(select, value);
        })
    }
    return this.filters ? evalSpec(this.filters) : true;
  }
  /** evalFilter and maybe doActionClause
   * @param card target of the response
   * @param player
   * @param card0 is dr.subject as Card, Card that asserted this Response
   * @override
  */
  override evalResponse(card: Card, player: Player) {
    if (!this.evalFilters(card, player, this.zdr.card)) return
    this.doActionClauses(card, player)
    if (this.fieldName == "payOwner") {
      let cost = player.payOwner
      player.payOwner = 0
      if (!!card.owner) {
        player.payRent(card, cost) // simplifies things to ensure rental Effects are paid here (vs onStop)
      } else {
        player.adjustPlayerCoins(- cost, "payBank", "toBank") // whenYesBuyCard
      }
    }
  }

  /** for each ActionClause, action.doVerb(subject, field) */
  doActionClauses(card: Card, player: Player) {
    let cardid = (scard: Card) => {
      let {row, col} = scard.getSlotInfo(); return `${scard.name}[${row||'?'},${col||'?'}]` // QQQQ: move to Card?
    }
    let card0 = this.zdr ? this.zdr.card : card // card0 is the card that defined this FieldClause/ActionClause
    let source = (!!card0) ? cardid(card0) : this.zdr ? this.zdr.subjectName : card ? card.name : "not-given";

    let subject = FieldClause.fieldSubject(this.fieldName, card, player);
    let ignorePolicyToPlayer = (card0: Card, player: Player) => {
      return card0.isPolicy() && card0.parent != player.plyrPolis && card0.parent != player.table.policySlots;
    }
    // do not adjustField of other player...
    // but allow card0.owner to decrement turnCounter of card0
    if (ignorePolicyToPlayer(card0, player) && (subject != card0)) {
      if (this.fieldName !== "buildAdjust")
        console.log(stime(this), "Policy Effect does not apply to Player:", player, "policy Card=", source, "resp=", this)
      return
    }
    this.actions.forEach(action => action.updateField(card, player, subject, this.fieldName, source));
    // do all the actions [create, set, add, max ], then fire ValueEvent:
    ValueEvent.dispatchValueEvent(subject, this.fieldName, subject[this.fieldName])
  }
}
export class NamedValues {
  // 'set' expects a NamedValue function; some "values" require parameters:
  // put parameter-value into this.param, this.param1, this.param2
  param: any
  param1: any
  param2: any
  // In a different world, we could go full "forth", and stack the parameters (and results?)
  // but that requires more context & continuity, here we reset znamedvalues.param when needed.

  /**
   * @value actual value or string naming Field or a computed value
   * @param card the Card that asserted this DataRecord
   * @param player the current Player
   * @return value OR the current translation of special 'named' values.
   */
  eval(value: ActionValue, card: Card, player: Player): ActionValue {
    if ((typeof value) === "string") {
      // get working value of various Player "action" fields:
      if (typeof(this[value as string]) == 'function')
        value = this[value as string](card, player) as ActionValue // || Player
      else if (FieldClause.cardFields.includes(value as string)) value = card[value as string]
      else if (FieldClause.plyrFields.includes(value as string)) value = player[value as string]
      // else: use 'value' as given
    }
    return value
  }
  evalPlayer(value: ActionValue, card: Card, player: Player): Player {
    return this.eval(value as string, card, player) as any as Player
  }

  undefined(card: Card, player: Player): any { return undefined}
  reverseDir(card: Card, player: Player): string { return S.dirRev[player.moveDir] }
  /**
   * Effect to reveal nextDistance, but do not initiate a move
   * @return distance to move, suitable for (dist (set ...))
   */
  // Taxi: {onStep: {dist: {set: "nextDistance"}}};
  // LOTTO: {coins: {add2: "nextDistance"}}
  // Flex: {when: {offerChoice: "", dist: {set: "nextDistance"}}}
  nextDistance(card: Card, player: Player): number {
    return player.getNextDistance()
  }
  /**
   * Effect to initiate a move using nextDistance.
   *
   * QQQQ: use SpecialClause instead of NamedValue?
   *
   * We use the idiom: (temp (set moveNextDistance))
   * player.newMove sets player.dist; and eventually continueMove decrements dist.
   * @return distance to move, suitable for (dist (set ...))
   */
  // Transit Hub: (when (chooseDir: 3) (temp (set "moveNextDistance")))
  // FutureEvent: (when (chooseDir [NESW]) (temp (set "moveNextDistance")) [OR: "New Move": moves += 1]
  // FutureEvent: (temp (set "moveNextDistance")) [OR: "Move Again": moves += 1]
  moveNextDistance(card: Card, player: Player): number {
    let dist = player.getNextDistance(); // could be withPlayer()
    player.playerMove(dist)              // see also: Player.onPlyrDistClicked(ce)
    return dist
  }
  nextDirection(card: Card, player: Player): string {
    return player.nextDirection()   // flip a direction card, set player.direction
  }
  /** on Card, compute range to next Airport in player.moveDir */
  rangeToAirport(card: Card, player: Player, dir = player.moveDir): number {
    //let cardRec = (player.scanTo(c => c.name === "Airport"))
    let { row, col } = card.slotInfo
    let cardRec = player.mainMap.scanTo((c => c.name === "Airport"), dir, row, col)
    return player.mainMap.rangeTo(card, cardRec.card)
  }
  nthAirportVP(card: Card, player: Player, addCard = 0): number {
    let airports = []
    card.table.mainMap.children.forEach((disp: DisplayObject) => {
      if (disp instanceof Card && disp.name == "Airport" && !airports.includes(disp)) airports.push(disp)
    } )
    return card["nthAirportVP"][airports.length + addCard]
  }

  // Taxable assets: (see: pay_tax)
  total_cash(card: Card, player: Player): number { return player.stats.coins }
  total_rent(card: Card, player: Player): number { return player.stats.totalRentIn }
  total_cost(card: Card, player: Player): number { return player.stats.totalCost }
  total_debt(card: Card, player: Player): number { return player.stats.totalDebt }
  total_roads(card: Card, player: Player): number { return player.stats.totalRoads }

  /** call into player.stats to obtain values (tie goes to 'first/next' player) */
  _findHighPlayer(player: Player, key: string): Player {
    let table: Table = player.table, highPlyr: Player = undefined, highVal: number = 0
    table.forEachPlayerInTurn((p: Player) => { if (p.stats[key] > highVal) { highPlyr = p; highVal = p.stats[key]}} )
    return highPlyr
  }
  high_total_cash(card: Card, player: Player) { return this._findHighPlayer(player, "coins") }
  high_total_rent(card: Card, player: Player) { return this._findHighPlayer(player, "totalRentIn") }
  high_total_cost(card: Card, player: Player) { return this._findHighPlayer(player, "totalCost") }
  high_total_debt(card: Card, player: Player) { return this._findHighPlayer(player, "totalDebt") }
  high_total_roads(card: Card, player: Player) { return this._findHighPlayer(player, "totalRoads") }

  tile_owner(card: Card, player: Player) { return player.onCard().owner }  // for example
  this_player(card: Card, player: Player) { return player }
}

type ActionValue = boolean|number|string|Array<string>|Array<number>|Array<string|number>;
/** modify the value of a Card or Player Field: ActionClause.updateField */
// maybe refactor to: FieldClause.updateField(ActionClause) ??
export class ActionClause {
  verb: string            // set/add, min/max, include/remove, counter, roadDir
  value: ActionValue      // number[] or string[] (["N" , "S"]) or a NamedValue: 'nextDistance', ...
  znamedValues = new NamedValues()

  constructor(verb: string, value: ActionValue) {
    this.verb = verb
    this.value = value
  }

  /**
   * @param value roadSpec[] indicating how to change dir: L, R, S, X from each movDir.
   * Note: spec is aligned with the FROM direction, not the TO direction!
   * @return resulting dir from entering road from player.moveDir
   */
  static roadDir(card: Card, player: Player, value: string[]): string {
    // player.moveDir = direction going TOWARD
    // value = turn when coming FROM [N, E, S, W]
    // value = [ "S", "L", "S", "R" ]  (same, left, same, right) = "Merge Dn Straight" -> "Merge Up Straight"
    // value = [ "S", "L", "R", "R" ]  (same, left, same, right) = "Merge Dn Right" -> "Merge Up Left"
    // rotVal(value) = [ "S2->S", "R3->L", "S0->S" "L1->R"] = [S L S R]
    let rotVal = (v: string[]) => {
      let rv = [v[2], v[3], v[0], v[1]]; // or change dmap?
      return rv;
    }
    if (card.rotation == 180) {
      value = rotVal(value)
    }
    let dmap = { N: 2, E: 3, S: 0, W: 1 }  // reverse TO/FROM dirs
    let tmap = {                           // TURN map: Same, Left, Right
      N: { S: S.N, L: S.W, R: S.E },
      E: { S: S.E, L: S.N, R: S.S },
      S: { S: S.S, L: S.E, R: S.W },
      W: { S: S.W, L: S.S, R: S.N }
    }
    let dir = player.moveDir  // "N" dir-heading: NESW
    let dirNdx = dmap[dir]    // 2
    let tdir = value[dirNdx]  // [SLSR]->S, [SLRR]->R, [LLLL]->L
    return tmap[dir][tdir]    // "N"   ->N,       ->E,       ->W
  }

  /**
   * update Field per ActionClause (verb, value)
   * @param card target of update, card with Field
   * @param player
   * @param subject
   * @param fieldName the Field to be modified
   * @param src for debugging: idenify the Card that asserted this Response.
   */
  updateField(card: Card, player: Player, subject: Card|Player, fieldName: string, src?: string) {
    const boxSize = (text: Text): { width: number; height: number } => {
      let texth = text.getMeasuredLineHeight();
      let textw = text.getMeasuredWidth();
      let height = texth * 1.2;
      let width = Math.max(textw * 1.3, height); // Ellipse
      return { width, height };
    }
    /** create the fieldName and bind to a ValueCounter.
     * @param value [label offx offy color]
     */
    let createCounter = (counterName: string, value: Array<string|number>):any => {
      let {0: label, 1: offx1, 2: offy2, 3: color3} = value
      // assert: counterName.endsWith("Counter")
      let color = color3 as string || (player ? player.rgbColor : card.owner ? card.owner.rgbColor : "lightgrey");
      let fsize = 38, {width, height} = boxSize(new Text("3", F.fontSpec(fsize)));
      let defx = width/2 - card.width/2, defy = -height/2 + card.height/2
      let offx = (typeof(offx1) == "number") ? offx1 : defx
      let offy = (typeof(offy2) == "number") ? offy2 : defy
      let counter = card.makeCounter(counterName, 0, offx, offy, color, fsize)
      if (typeof(label) == "string") counter.setLabel(label as string, undefined, 15) // no way to set offsets
      let fieldName = counterName.slice(0, -"Counter".length)
      let initValue = card[fieldName] as string | number
      counter.setValue(initValue)
      return counter
    }

    let value: ActionValue = this.znamedValues.eval(this.value, card, player)
    let newValue: ActionValue, oldValue: ActionValue = subject[fieldName]

    switch (this.verb) {
      case 'set': newValue = value; break;
      case 'sub': newValue = (subject[fieldName] as number || 0) - (value as number); break; // assume (min: 0)
      case 'add': newValue = (subject[fieldName] as number || 0) + (value as number); break; // assume (min: 0)
      case 'add2': newValue = (subject[fieldName] as number || 0) + 2*(value as number); break;
      case 'min': newValue = Math.max(subject[fieldName] as number || 0, (value as number)); break;
      case 'max': newValue = Math.min(subject[fieldName] as number || 0, (value as number)); break;
      case 'counter': newValue = createCounter(fieldName, value as (string|number)[]); break;
      case 'roadDir': newValue = ActionClause.roadDir(card, player, value as string[]); break;
      case 'include': {  // prepend new instance of each string
        // BAG (not a SET) operation: may create multiple elements of same value
        let orig = (subject[fieldName] || [] as string[]);
        let values = (value as string[]);
        values.forEach( str =>  orig.unshift(str) ) // prepend because remove splices out the first occurence.
        newValue = orig;
        break;
      }
      case 'remove': {  // remove one instance of each string
        let orig = (subject[fieldName] as string[]);
        let values = (value as string[]);
        values.forEach(val => {
          orig.find((str, ndx, obj) => (str === val ? obj.splice(ndx, 1) : false))
        })
        newValue = orig;
        break
      }
      // 'set' a parameter value for later NamedValue
      case 'param':
      case 'param1':
      case 'param2': this.znamedValues[this.verb] = value; break;
      default:
        console.log(stime(this, ".updateField: unknown verb="), this.verb, "value=", value, "card=", card.name);
    }
    // update value display if there's a Counter:
    let counter = subject[fieldName+"Counter"]
    if (counter instanceof ValueCounter) {
      counter.setValue(newValue as string | number) // no "event" required or expected.
    }
    if (Effects.isLogUpdateField() && fieldName !== "buildAdjust") {
      console.log(stime(this, ".updateField:"), {verb: this.verb, value, field: subject.name+"["+fieldName+"]", oldValue, newValue, src: src, subject: subject})
    }
    subject[fieldName] = newValue; // value may be a Promise!
    if (FieldClause.cardUpdateStats.includes(fieldName)) card.table.adjustAllRentsAndStats(card)
  }
}
/** Special responses ResponseClause */
export class SpecialClause extends ResponseClause {

  specialName: string                  // names the SpecialClause method to invoke
  specialValue: any                    // SpecialClause for when/else, else Object from props: (specialName specialValue)
  responses: ResponseArray = [];    // set by specialParser; for when/else, withPlayer

  constructor(dr: DataRecord, name?: string, value?: any) {
    super(dr)
    this.specialName = name
    this.specialValue = value
  }

  // Special "Values": PlayerLastBuy, doUrbanRenewal, player/playerSelect, player_high_roads... ,
  // penalty, NoHouse, OnlyHouse, 'calcRangeToAirport',
  hasSpecialHandler(key: string): boolean {
    return (typeof (this[key]) == 'function');
  }

  /** when hasSpecialHandler, may also have SpecialParser.
   * @param responses the ResponseArray into which this SpecialClause will be pushed
   * (in particular: for an 'else' clause: responses.last == 'when')
   */
  parseSpecial(responses: ResponseArray): this {
    // usually, just a special key and value; evaluated at runtime (doSpecialClause(card, player))
    let key = this.specialName;
    let val = this.specialValue;
    // see if it needs specialParser: (for when/else)
    let sp = new SpecialParser(), parser = sp[key] as Function
    if (typeof(parser) === "function") {
      sp.responses = responses
      parser.call(sp, this, val)
    }
    return this
  }

  // ALL METHODS ARE SPECIAL HANDLERS!
  // this.method(Card, Player): void

  /** local method for FieldClause.fieldAndConst */
  _twoValues(card, player) { return FieldClause.fieldAndConst(this.specialValue, card, player)}
  /** Predicates for when/else: */
  gt(card: Card, player: Player): boolean { let [v1, v2] = this._twoValues(card, player); return v1 > v2 }
  lt(card: Card, player: Player): boolean { let [v1, v2] = this._twoValues(card, player); return v1 < v2 }
  ge(card: Card, player: Player): boolean { let [v1, v2] = this._twoValues(card, player); return v1 >= v2 }
  le(card: Card, player: Player): boolean { let [v1, v2] = this._twoValues(card, player); return v1 <= v2 }
  eq(card: Card, player: Player): boolean { let [v1, v2] = this._twoValues(card, player); return v1 == v2 }
  ne(card: Card, player: Player): boolean { let [v1, v2] = this._twoValues(card, player); return v1 != v2 }

  /** apply the specialName method to (card, player)
   * @override
   */
  override evalResponse(card: Card, player: Player): boolean | void {
    console.log(stime(this, ".evalResponse:"), { card: card && card.name, spName: this.specialName, spVal: this.specialValue })
    let specialFunc = this[this.specialName] as Function;
    if (typeof(specialFunc) == "function")
      return specialFunc.call(this, card, player)
    else
      alert(`SC.evalResponse: method "${this.specialName}" not defined`)
    return
  }

  /** add a DataRecord for this Card; parsed from this.specialValue. */
  addDR(card: Card, player: Player, spValue: Record<string, object> = this.specialValue): DataRecord {
    let [key, value] = Object.entries(spValue)[0]
    console.log(stime(this, `.addDR:`), {key: key, value: value, card: card, zdr: this.zdr})
    return Effects.effects.addPropsClause(card, key, value as object)
  }
  /** remove 'this' DataRecord. */
  removeDR(card: Card, player: Player): DataRecord {
    console.log(stime(this, `.removeDR`), this.zdr, this.specialValue ) // could use specialValue to select a DataRecord!
    return Effects.effects.removeRecord(this.zdr)
  }

  /**
   * Predicate:
   * If resolved: return result: boolean
   * Else: set up choice GUI, run result(chooseDir) when user clicks; return false
   *
   * set zdr.zbreak to stop responses until user clicks;
   * restart responses when user clicks
   *
   * @specialValue is "cost" to change direction. (appears on the buttons)
   * @return (zbreak &) false until cd.rv.resolved; then return result(cd)
   */
  _offerChoice(card: Card, player: Player, spec: DirSpec, result: (cd: ChooseDir) => boolean): boolean {
    let cd = card.table.chooseDir
    if (cd.rv.resolved && (this['result'] !== undefined)) {
      let result = this['result']
      console.log(stime(this, "._offerChoice-returned:"), { dir: cd.dir, value: cd.value, button: cd.button, result })
      delete this['result']            // next time: run cd.choose(...)
      return result
    }

    /** restart doEachResponse, with cd.rv.resolved == true; [return to _offerChoice] */
    let doneFunc = (cd: ChooseDir) => {
      console.log(stime(this, "._offerChoice-resolved:"), { dir: cd.dir, value: cd.value, player: player })
      cd.visible = false
      cd.stage.update()
      this['result'] = result(cd)
      this.zdr.restart()               // restart DataRecord at responses[zlast]
    }
    let failFunc = (reason: any) => {
      console.log(stime(this, "._offerChoice-failed:"), reason)
    }

    console.log(stime(this, "._offerChoice-setup"), { spec: spec, name: card.name, player: player, card: card })
    cd.choose(card, player, spec).then(doneFunc, failFunc); // _offerChoice
    if (cd.rv.resolved) return this['result']   // rare, unexpected
    this.zdr.zbreak = true                      // stop procesing Responses, doneFunc will restart()
    return false
  }

  /** Predicate for 'when'.
   * set player.moveDir to chosen direction (or leave unchanged...)
   * @specialValue is "cost" to change direction. (appears on the buttons)
   * @return true if a new direction is chosen (player.moveDir is changed)
   */
  chooseDir(card: Card, player: Player): boolean {
    let spec: DirSpec = this.specialValue
    if (typeof (spec) == "number") {
      spec = { N: spec, S: spec, E: spec, W: spec, C: null }
    }
    let coins = Math.max(player.coins, 0)
    Object.entries(spec).forEach(([k, v]) => { if (!!v && typeof (v) == 'number' && v > coins) { spec[k] = undefined } })

    let result = (cd: ChooseDir) => {
      let rv = (cd.dir !== S.C)
      if (rv) player.moveDir = cd.dir
      console.log(stime(this, ".chooseDir-result:"), { moveDir: player.moveDir, coins: player.coins, player, button: cd.button })
      return rv
    }
    return this._offerChoice(card, player, spec, result)
  }
  /** Predicate for 'when'.
   * Present the question (on card, to player), zbreak and return false.
   *
   * ultimately choice returns: yes=true/no=false
   */
  offerChoice(card: Card, player: Player, question: string = this.specialValue): boolean {
    // Note: offer is made/accepted even if player.coins < 0
    // (Player can repay credit *next* turn, unless opponent takes available Debt: causing Bankruptcy for player)
    let spec: DirSpec = { N: question, S: undefined, E: "Yes", W: "No", C: undefined }
    let result = (cd: ChooseDir) => {
      console.log(stime(this, ".offerChoice-result:"), { value: cd.value })
      return (cd.value === "Yes") }
    return this._offerChoice(card, player, spec, result)
  }
  /** for Eminent Domain (see also: whenYesBuyCard) */
  offerBuyTile(card: Card, player: Player) { player.gamePlay.offerBuyTile(card, player) }

  chooseDist(card: Card, player: Player) { }
  configBuy(card: Card, player: Player) { }
  /**
   * operation & [card] filter; apply operation to each card
   *
   * .specialValue is  {verb: value, filter: fspec}
   *
   * basically: while (cards>0) do choice(next card)
   */
  damage(card0: Card, player: Player) {
    let ecard = this.zdr.card
    let fc = (this.specialValue as FieldClause)
    let verb = fc.actions[0].verb
    let value = fc.actions[0].value as number
    let filter = (card: Card) => fc.evalFilters(card, player, this.zdr.card) // for ex: {name: "Home"}
    let fcc = fc["cards"] as Card[]    // if continuation from zbreak
    let cards = fcc || player.mainMap.filterTiles(filter, S.Road) // all Tiles on map matching filter

    switch (verb) {
      /** Pay ${value} per $* of Rent or downgrade largest building */
      case "downgrade": {
        let houseTokensOnCard = (card: Card) => {
          let tokens = card.slotInfo.stack.filter(dispObj => (dispObj instanceof HouseToken)) as HouseToken[]
          tokens.sort((a, b) => (b.costn - a.costn))  // DESCENDING! vs HouseToken.onCard(card)
          return tokens
        }
        let largestBldg = (card: Card) => { return houseTokensOnCard(card)[0] }
        let largestBldgCost = (card: Card) => {
          let lb = largestBldg(card)
          return (lb !== undefined) ? lb.costn : 0 // or undefined? or -1?
        }
        if (!fcc) {
          // first time: sort cards, and store in fc['cards']
          // do downgrades in playerTurnOrder, each Player downgrades property with lowest-cost target
          // that is: the Card whose Highest-cost Bldg is of the lowest cost.
          // so you can demolish a House on prop1 and then downgrade a Apartment on next Card, rebuilding the House
          let scards: Card[] = []                     // sorted cards
          card0.table.forEachPlayerInTurn(plyr => {
            if (plyr.isExempt(ecard, stime(this, ".damage-downgrade"))) return
            let pcards = cards.filter(c => (c.owner === plyr) && (c.rent > 0))  // HouseToken(s) of plyr: may be []
            pcards.forEach(c => c['lbc'] = largestBldgCost(c)) // mark with lowest-building-cost: may be 0
            pcards.sort((a, b) => a['lbc'] - b['lbc'])
            scards = scards.concat(pcards)
          })
          cards = fcc = fc["cards"] = scards
        }
        if (fcc.length <= 0) {
          delete fc["cards"]    // reset for next time
          return                // no zbreak, no Promise, no doneFunc to restart doEachResponse
        }
        // TODO: eval result() and reset chooseDir to new location/promise
        let cd = card0.table.chooseDir
        if (cd.rv.resolved) {
          console.log(stime(this, "SC.damage.downgrade:"), {label: this['label'], player: player.name})
          delete this['result']            // ignore 'result', re-arm chooser
        }
        let card = cards.shift()           // for each card in scards
        let pay = Math.max(0, Math.round(card.rent * value))
        let target = largestBldg(card)
        let msgE = (!!target ? target.name : "??"), msgW = `Pay $${pay}`
        let spec: DirSpec = { N: "Downgrade or Pay?", S: undefined, E: msgE, W: msgW, C: undefined }
        let result = (cd: ChooseDir) => {
          if (cd.dir == S.E) {   // downgrade:
            this['label'] = msgE
            !!target && target.downgrade()   // replace target with smaller building (or nothing)
          } else {               // pay:
            this['label'] = msgW
            card.owner.coins -= pay
          }
          return true            // nobody really cares... damage is not a predicate
        }
        // set zbreak; restart when user clicks
        this._offerChoice(card, card.owner, spec, result)
        break;
      }
      /** "Put a NoRent token on property within range = ${value}; remove when Owner visits property" */
      case S.noRent: {
        // put BLACK.flag to overCont, set card[S.noRent] = BLACK.flag;
        // add effect to reverse it when card.onStop(owner) OR card.onStep(owner)
        cards.forEach(card => {
          if (TP.noRentStop && !!card.noStop) return // no "onStop" for these tiles
          if (card[S.noRent] != undefined) return // only one noRent marker on a card
          if (!card.owner) return // cannot block rent on un-owned Tile
          if (card.owner.isExempt(ecard, stime(this, ".damage-noRent"))) return
          let bf = new Flag(card.table.homeCards.findCard("Owner-BLACK-0", true))
          this._addToOverContOnCard(bf, card, card.width-bf.width*bf.scaleX-bf.x-12, bf.y+20+40)
          card[S.noRent] = bf
          // {isOwner: false} means check owner of affected *Tile*
          // {isOwner: true} means check owner of the asserting card/event/policy (zdr.card)
          // {subtype: "Home", isOwner: false} is the Player's Home card.
          // {onCard: true, isOwner: true} Player is onCard & owner of the Tile
          let spValue = TP.noRentStop
            ? { onStop: { when: { isOwner: false, damage: { _reRent: true } } } }
            : { onStep: { when: { isOwner: false, damage: { _reRent: true } } } }
          this.addDR(card, player, spValue)
        })
        break;
      }
      // 'un'-damage this card, remove the noRent Flag:
      case '_reRent': {
        let card = this.zdr.card   // card is subject of the '_reRent' effect
        let oc = card.table.mainMap.overCont
        let bf = card[S.noRent]
        oc.removeChild(bf)
        delete card[S.noRent]
        card.table.addUndoRec(card, "add noRent flag", () => { card[S.noRent] = bf, oc.addChild(bf)}) // bf@(x,y)
        this.removeDR(card0, player) // Effects.effects.removeRecord(this.zdr)
        break;
      }
      /** "Owner pays ${value} for each Property within range = 1 of Player" */
      case "coins": {
        let table = card0.table
        let filter = (card: Card) => fc.evalFilters(card, player, this.zdr.card) // hmm: repeating from above?
        cards = player.mainMap.filterTiles(filter) // hmm: forEachStack(filter(stack.bottomCardOfStack())) ??
        table.forEachPlayerInTurn(plyr => {
          if (plyr.isExempt(ecard, stime(this, ".damage-coins"))) return
          cards.filter(c => plyr.isReallyOwner(c)).forEach(card => {
            plyr.payDamage(value, card, 'damage') // log and pay value
          })
        })
        break;
      }
      default:
        console.log(stime(this, ".damage:"), `unrecognized verb: ${verb}`, { value, filters: fc.filters }, this.zdr.subjectName)
        break;
    }
    return
  }
  static reRentProps = { onStep: { damage: { _reRent: true } } } // 'onStep' could be anything...

  /** extremely dodgy hack... find a real predicate for _reRent */
  isOwner(card: Card, player: Player): boolean {
    let val = this.specialValue
    return (player == (val ? card.owner : card.owner))
  }
  _addToOverContOnCard(obj: DisplayObject, card: Card, x?: number, y?: number) {
    let oc = card.table.mainMap.overCont
    card.localToLocal(x || obj.x, y || obj.y, oc, obj)
    oc.addChild(obj)
  }
  /**
   * Discard card0, the subject of this Response.
   * [when temp-policy times out, discard without further action]
   * @param card the Card being affected by this Response OR for Deferred/Event *is* card0
   * @param player the current Player
   */
  discard(card: Card, player: Player) {
    let card0 = this.zdr.subject as Card
    console.log(stime(this, ".discard:"), {card0name: card0.name, card0: card0, card: card, player: player, dr: this.zdr})
    card.table.dragToDiscard(card) // temp-policy timed out
  }
  /** pay this.specialValue, clickOn Card to demolish */
  doUrbanRenewal(card: Card, player: Player) {
    let table = card.table, mainMap = card.table.mainMap
    let cost = this.specialValue as number           // maybe eval named value...
    let isOccupied = (card: Card): boolean => {
      return !!table.allPlayers.find(p => p.onCard() === card)
    }
    let isEligible = (card: Card) => {
      return (card.owner == undefined || card.owner == player) && (card.vp == 0) && (!isOccupied(card) || TP.urbanRenewWhileOccupied)
    }
    let ncards = 0
    let markDemolish = (row: number, col: number, stack: Stack) => {
      let card = stack[0]                            // mainMap.bottomCardOfStack(row, col)
      stack[S.buildCost] = undefined                 // may be redundant...
      if ((card instanceof Card) && isEligible(card)) {
        ncards += 1
        stack[S.buildCost] = cost
        mainMap.showLegalMark(stack, cost, C.briteGold, true)
      } else {
        mainMap.showLegalMark(stack, 0, C.demoRed, (card instanceof Card)) // for testing
      }
    }
    /** you get 1 click on MainMap, pay&demolish, or nothing. */
    let demolishOnMainMap = (ce: CardEvent) => {
      console.log(stime(this, ".doUrbanRenewal:"), { row: ce.row, col: ce.col, name: ce.card.name, card: ce.card })
      if (ce.cont.getStack(ce.row, ce.col)[S.buildCost] !== undefined) {
        mainMap.dropToOrigSlot = false       // ensure payBuildCost will run
        player.gamePlay.payBuildCost(ce)     // pay as if Build; w/undoRec
        ce.card.table.dragToDiscard(ce.card) // D&D to discardT
      }
      mainMap.removeEventListener(S.clicked, clickListener) // Note: mainMap.on(S.netClik) -> send_clik->eval_clik -> S.clicked
      mainMap.hideLegalMarks()
    }
    mainMap.forAllStacks(markDemolish)
    console.log(stime(this, ".doUrbanRenewal:"), {ncards: ncards})
    mainMap.stage.update()
    let clickListener = mainMap.on(S.clicked, demolishOnMainMap, this)
  }
  /** all players pay 10% of value named in this.specialValue */
  pay_tax(card: Card, player: Player) {
    let field = this.specialValue as string
    let card0 = this.zdr.card
    let rate = TP.taxRate || card0.rent // NOTE: override card's tax-rate for dev/test
    player.table.forEachPlayerInTurn(plyr => {
      if (plyr.isExempt(card0, stime(this, ".pay_tax"))) return
      let basis = new NamedValues().eval(field, card, plyr) as number   // total_cash, total_rent, etc.
      let tax = Math.ceil(basis * rate)
      if (tax > 0)
        plyr.adjustPlayerCoins(-tax, "tax", "toCity")
    })
  }
  // doUrbanRenewal ?
  reposses(card: Card, player: Player) { }

 /**
  * Scan from card0, in player.moveDir (maybe update for Roads) to next card, until filter returns true.
  * @param card0 start scan from: player.onCard()
  * @param player
  * @param filter return true to stop scanning
  * @param roads set true to follow roadDir while scanning (updates player.moveDir)
  * @returns the final moveRec; where (filter -> true) or (return to card0) or (roads loop)
  */
  _scanToFilter(card0: Card, player: Player, filter: FieldClause, roads: boolean = false): MoveRec {
    let path = [] // when follow roads, must detect loops in path
    console.log(stime(this, "._scanToFilter:"), { card0: card0.name, dist: player.dist, dir: player.moveDir, scanTo: filter })
    // find next Tile matching FilterSpec[] in FieldClause.filters
    let cardFilter = (card: Card, nextRec: MoveRec) => {
      // instead of computing player.moveDir=roadDir(...),
      // could just invoke: doEffects("onStep", card, player)
      // doEffects would also charge for using the "Express Lane"... (but Bus gets it for free)
      if (roads && (card.type === S.Road)) {
        let dir = ActionClause.roadDir(card, player, card[S.roadSpec]) // for next iteration
        let rec = { card: card, dir: dir }
        nextRec.dir = player.moveDir = dir // make the turn and sync Player with new direction
        console.log(stime(this, "._scanToFilter: Road="), card.name, rec)
        // if player exits Road in the same dir, that is a loop; stop on the Road
        if (path.find(elt => elt.card == card && elt.dir == dir)) return true;
        path.push(rec)
        //return false         // Ignore filter: can't follow Roads *and* stop on them. because (subtype: Transit)
        // sure: check the filter; maybe someone wants to scan to find a Road, and then move on.
      }
      return filter.evalFilters(card, player, card0) || card == card0 // return true on arrival
    }
    let {row, col} = card0.slotInfo
    return player.mainMap.scanTo(cardFilter, player.moveDir, row, col)
    //player.scanTo(cardFilter)
  }

  /** goto and STOP: for goto Jail/Go_Home, etc.
   * works from Events [setMoveRecDone() does nothing...]
   * like transitTo, but simpler;
   * @param card -- likely the Event card provoking this action
   * @param player -- likely a withPlayer selection
   */
  goTo(card: Card, player: Player): boolean {
    let card0 = player.onCard()
    let filter = (this.specialValue as FieldClause)
    let nextRec = this._scanToFilter(card0, player, filter, false)
    if (nextRec.card == card0) {
      console.log(stime(this, ".goTo: returned to sender="), card0, player.name)
      return false
    }
    // ASSERT: Card.isEvent [until we find a Tile/Policy that uses goTo, or invokes an Event]
    player.setMoveRecDone()          // pro forma; likely player.isIdle
    if (!player.isMoving()) {
      player.dist = nextRec.dist = 0;  // block newMove
      console.log(stime(this, ".goTo:"), { nextRec: nextRec, player: player.name, card: nextRec.card.name });
      player.initMoveHistory(0, false)  // do NOT moveFromHere(); just initHistory & startrec
    }
    player.dist = nextRec.dist = 0;  // goTo and STOP (in case onMove changed dist)
    player.moveToLoc(nextRec);       // going here with (dist = 0) [showMark; wait-> continueMove(nextRec)]
    return true
  }
  /** Earthquake */
  nextAlignment(card: Card, player: Player) {
    let mainMap = card.table.mainMap
    mainMap.nextAlignmentCard()
    mainMap.table.adjustAllRentsAndStats() // nextAlignment, change adjacency, range, etc
  }

  /** next=scanTo(filter=specialValue); moveRecDone(); set dist; fromTransit=card.name; moveTo(next) */
  transitTo(card: Card, player: Player) {
    // Bus Stop:      onStop: {subtype: "Transit" "Com-Transit", dist: 0, roads: true}
    // Train Station: onStop: {name: "Train Station"}
    // Airport:       onStep: {name: "Airport"}
    let roads: boolean = (this.specialValue["roads"]) // true: follow roadDir, false: just another Tile Card.
    let dist: number = (this.specialValue["dist"])    // continue with dist = 0 or 1
    let card0: Card = player.onCard()
    let filter = this.specialValue as FieldClause
    let nextRec = this._scanToFilter(card0, player, filter, roads)
    // if (nextRec.card == card0) // That's mostly OK
    let lmr = player.setMoveRecDone()// lmr.done=true; stop movement from *this* moveRec; use nextRec
    player.dist = nextRec.dist = dist;  // generally "transitTo => (dist (set 1))", but Bus stops at destination.
    nextRec.fromTransit = card0.name // control isLoopLoc (so can moveTo self, with Dist=1 vs 0)
    // TODO: = card? (vs .name) [not necessary: isLoopLoc also checks {row, col} == {row, col}]

    console.log(stime(this, ".transitTo:"), {lastRec: lmr, fromTransit: lmr.fromTransit, nextRec: nextRec});
    player.moveToLoc(nextRec);       // going here with (dist = 1) RENTRANT CALL!
    return
  }
  /** fromTransit: predicate for when
   * @param this.SpecialClause is string to match to lastMoveRec.fromTransit
   */
  fromTransit(card: Card, player: Player): boolean {
    return (this.specialValue == player.getLastMoveRec().fromTransit)
  }

  /** specialValue evaluates to a Player, responses set by specialParser
   * {withPlayer: {"owner": {coins: {add: cost}}}
   * @param card where curPlayer is
   * @param player curPlayer, but its not much used...
   * @param specialValue a NamedValue that resolves to Player: owner, high_total_xxx
   */
  withPlayer(card: Card, player: Player) {
    let ecard = this.zdr.card
    if (this.specialValue === true) return // special form: {withPlayer: true} signals per-player step-effect
    let player0 = new NamedValues().evalPlayer(this.specialValue, card, player)
    if (!(player0 instanceof Player)) {
      console.log(stime(this, ".withPlayer: no satisfactory Player:"), player0, card)
      return
    }
    if (this.responses.length <= 0) return  // vacuous with-player marking later isExempt check
    if (player0.isExempt(ecard, stime(this, ".withPlayer"))) return// player0 not affected by card if (step > rangeRaw)
    this.responses.forEach(resp => resp.doResponse(card, player0)) // withPlayer
  }

  /** doSpecialClause and set sc1["crit"] true/false.
   * if crit==true then doResponses
   * Otherwise, there may be an 'else' handler for crit==false.
   */
  when(card: Card, player: Player) {
    // (when {lt: {field: 4}} RespClause, ...}
    // (when {isOwner: true} respClause, ...  )
    // specialClause = { predName, predValue, RespClause, ...}
    let sc1: SpecialClause = this.specialValue as SpecialClause // the Predicate clause
    let crit = sc1.evalResponse(card, player) as boolean        // eval the predicate
    sc1["crit"] = crit                                          // save for possible else
    console.log(stime(this, ".specialHandlers[when]: crit="), crit, " sc1=", sc1)
    if (crit) {
      this.responses.forEach(resp => resp.doResponse(card, player)) // when
    }
  }
  /** note: 'else' shares scq and sc1.crit with the preceding 'when' */
  else(card: Card, player: Player) {
    let sc1: SpecialClause = this.specialValue as SpecialClause // === when.sc1
    let crit = sc1["crit"] as boolean         // already been evaluated by 'when'
    console.log(stime(this, ".specialHandlers[else]: !crit="), !crit, " sc1=", sc1)
    if (!crit) {
      this.responses.forEach(resp => resp.doResponse(card, player)) // else
    }
  }
  // nothing to do here... ex: doResponses which checks specialName=="suppressCard"/specialValue=card.name
  suppressCard(card: Card, player: Player) { }

  /** eligible (vp==0) tile in range */
  _tilesInRange(card0: Card, player: Player, range: number, ...except: string[]): Card[] {
    let mainMap = player.mainMap
    let filter_range = (card: Card) => {
      return (mainMap.rangeTo(card0, card, range) < range)  && !(card.vp as number > 0)
    }
    let cards = mainMap.filterTiles(filter_range, ...except)
    return cards
  }
  /** count and range are set; find Tiles and demolish the least expensive */
  tornado(card0: Card, player: Player) {
    let ecard = this.zdr.card
    let range: number = this.specialValue.range || 1;
    let count: number = this.specialValue.count || 3;
    let cards = this._tilesInRange(card0, player, range, S.Road)
    let cardValue = (card: Card) => (card.costn + card.rentAdjust)
    cards.sort((c1, c2) => cardValue(c1) - cardValue(c2))
    card0.table.curPlayer.robo.block()
    this._flashThenFunc(cards, 0, Math.min(count, cards.length), (card) => {
      if (!!card.owner && card.owner.isExempt(ecard, stime(this, ".tornado"))) return
      console.log(stime(this, ".tornado: demolish:"), { card: card.name, cost: cardValue(card), owner: card.owner ? card.owner.name : "?" }, card)
      card.table.dragToDiscard(card) // Tornado demolish
    }, () => card0.table.curPlayer.robo.block(card0.table))
  }
  /** For each card: high-light the card, run f(card), then discard(card) */
  _flashThenFunc (cards: Card[], ndx: number, max: number, f: (card: Card)=>void, final?: ()=>void) {
    if (ndx < max) {
      let card = cards[ndx], {cont, row, col } = card.getSlotInfo()
      cont.flashMarkAtSlot(row, col, undefined, () => {
        f(card)                        // TODO: put discard in f(), _flashThen(c,n,m,f); use for Flooding, others?
        this._flashThenFunc(cards, ++ndx, max, f, final) // recursive through cards[++ndx]
      })
    } else {
      if (!!final) final()
    }
  }
  /** for each player, demolish a [eligble, non-road] property in range; give $2 compensation. */
  toxicSpill(card0: Card, player: Player) {
    // Each player demolish a property in range, recieve $1 if they do
    let ecard = this.zdr.card
    let range: number = this.specialValue.range || 2;
    let comp: number = this.specialValue.comp || 2;   // insurance payout?
    let cards = this._tilesInRange(card0, player, range, S.Road)
    let cstack = new Stack(cards).sort((a,b) => a.costn - b.costn) // not a choice! demo a lowest costn property
    let dcards: Card[] = []    // discard [one] card per player
    player.table.forEachPlayer(p => {
      if (p.isExempt(ecard, stime(this, ".toxicSpill"))) return
      let card = cstack.find((c) => c.owner == p);
      if (!!card) dcards.push(card)
    })
    card0.table.curPlayer.robo.block()
    this._flashThenFunc(dcards, 0, dcards.length, (card) => {
      let owner = card.owner
      console.log(stime(this, ".toxicSpill:"), { effect: "demolish", card: card.name, color: owner.color, cost: (card.costn) }, card)
      card.table.dragToDiscard(card)           // Toxic Spill
      owner.adjustPlayerCoins(comp, "Toxic Spill")
    }, () => card0.table.curPlayer.robo.block(card0.table, S.actionEnable))

  }

  /** Lawyer intercedes: */
  undoLastEffect(card: Card, player: Player) { }
}

/** methods invoked by SpecialClause.parseSpecial() via .call(...) */
class SpecialParser {
  responses: ResponseArray
  /** get the previous ResponseClause */
  _lastResponseClause(): ResponseClause { return this.responses[this.responses.length -1]}

  damage(sc: SpecialClause, fao: object) {
    sc.specialValue = new FieldClause(sc.zdr, sc.specialName, fao) // name=damage, {verb: value}, filter: fspec
    // 'verb' is a SpecialClause name, or a 'case' in SC.damage()
  }

  /** special form/macro {when: {offerChoice: "?", ...}} */
  whenYesBuyCard(sc: SpecialClause, promptAndResp: object | string) {
    let prompt: string, resp: object;
    if (typeof(promptAndResp) !== 'string') {
      prompt = promptAndResp['prompt']
      resp = promptAndResp['and']
    } else prompt = promptAndResp
    // inject prompt; compute price using last-computed rentAdjust:
    let pao = { offerChoice: prompt, temp: {set: S.rentAdjust, add: 2}, payOwner: { set: "cost", add: "temp" }, owner: { set: "this_player" }, ...resp }
    sc.specialName = 'when'
    sc.specialValue = pao      // { offerChoice: prompt, ... }
    this.when(sc, pao)
  }
  // "Event: {withPlayer:{tile_owner:{coins:{add:cost},owner:{set:undefined},offerToBuy:null}}"
  /** {withPlayer: {value: {fieldClause, ..., specialClause, ...}} */
  withPlayer(sc: SpecialClause, valueAndResponses: [value: string, resp: object]) {
    if (sc.specialValue === true) return   // special form: {withPlayer: true} signals per-player step-effect
    const [value, responseObject] = [...valueAndResponses];
    sc.specialValue = value
    sc.responses = []
    sc.zdr.addResponses(responseObject, sc.responses)// withPlayer
  }
  /**
   * {when: {pred: val, ... action}}
   *
   * set sc.specialValue to new SpecialClause(dr: this.zdr, name: predFunc, value: predArg)
   * @param sc a SpecialClause to hold actions when predicate is true
   * @param predActionsObj object {pred: val, ...actions}
   */
  when(sc: SpecialClause, predActionsObj: object) {
    // (when (pred value) (resp1) (resp2))
    // sc.specialName = "when"
    // sc.specialValue = new SpecialClause(dr, pred, val)
    // sc.responses = actions when pred evaluates true

    // whenPredActionClause = {name: predName, specialValue: predValue, responses: [...respClause]}

    // (when (undefined arrivalFrom) (arrivalFrom (set "Airport") ...))
    // when: { undefined: "arrivalFrom", arrivalFrom: {set: "Airport"}, ...}
    // CAR(predActionsObj) --> [pred,val]
    // CDR(predActionsObj) --> actionsObj
    const arrayEntries = (ary: {[key: string]: object}[]) => ary.map(kv => Object.entries(kv)[0]);
    // Either: array of singleton objects OR multi-key object: --> new [pred, val][];
    let pavAry = (predActionsObj[0]) ? arrayEntries(predActionsObj as []) : Object.entries(predActionsObj);
    let [pred, val] = pavAry.shift() // [[undefined, "arrivalFrom"] [arrivalFrom, {}]]
    let respObject = Obj.fromEntries(pavAry); // actions to take when predicate is true
    console.log(stime(), "SC.specialParser[when]", {pred: pred, val: val, dr: sc.zdr}, "respObject:", respObject)
    // pred = "undefined", val = "arrivalFrom"
    // new SpecialClause to hold {pred, val} and "crit"
    sc.specialValue = new SpecialClause(sc.zdr, pred, val).parseSpecial([]) // expect no responses from the predicate!
    sc.responses = sc.zdr.addResponses(respObject, [])         // sc holds its responses (much like a DR)
  }
  else(sc: SpecialClause, actionsObj: object) {
    // link to when.specialValue (being {pred: val} )
    let when = this._lastResponseClause() as SpecialClause // {onStep: {when: {prd: val, ... when.responses}, else: {... else.responses}}
    if (!when || when.specialName != "when") {
      let msg = "SC.specialParser[else]: without preceding 'when' clause: "+when
      console.log(stime(), msg, {else: sc, pav: actionsObj, resps: sc.zdr.responses})
      alert(msg)
    }
    sc.specialValue = when.specialValue         // SpecialClause.when() will decorate with ["crit"] value
    sc.responses = sc.zdr.addResponses(actionsObj, [])    // sc holds its responses (much like a DR)
  }
  tornado(sc: SpecialClause, props: object) {
    sc.specialValue["range"] = props["range"]
    sc.specialValue["count"] = props["count"]
  }
  toxicSpill(sc: SpecialClause, props: object) {
    sc.specialValue["range"] = props["range"]
    sc.specialValue["comp"] = props["comp"]
  }
  /**
   * set sc.specialValue = new FieldClause(zdr, "transitTo", filterClause)
   * @param sc the SpecialClause being constructed
   * @param toSpec FilterSpec with optional roads, dist: {roads?: boolean, dist?:number, ...filterSpec}
   * Can also specify as: {filter: {roads?: , dist?: , ...filterSpe}}
   * LIKE: {name: "Train", roads: false} OR {subtype: "Gov"} OR {subtype: S.Home, isOwner: true}
   * transform it to a legitimate FieldClause.filters object
   */
  transitTo(sc: SpecialClause, toSpec: object) {
    let filterSpec = Obj.fromEntriesOf(toSpec)   // toSpec struct is shared across instances of the Card.
    let [key, val] = Object.entries(filterSpec)[0], filterClause: object
    if (key == "filter") {
      filterClause = filterSpec
      filterSpec = val
    } else {
      filterClause = { filter: filterSpec }
    }
    let roads: boolean = filterSpec["roads"]; delete filterSpec["roads"]
    let dist: number = filterSpec["dist"]; delete filterSpec["dist"]
    // FC = {fieldName: {...actions, filter: {...} }}; we decorate with "roads" & "dist"
    // NOTE: "transitTo" is NOT a real FieldName
    // Happily, filterSpec has no fc.actions that will try to access card0[fieldName]
    sc.specialValue = new FieldClause(sc.zdr, "transitTo", filterClause)
    sc.specialValue["roads"] = roads !== undefined ? roads : false // true or false or undefined
    sc.specialValue["dist"] = dist !== undefined ? dist : 1        // generally 1 or 0
  }
  goTo(sc: SpecialClause, toSpec: object) {
    let filterSpec = toSpec, [key, val] = Object.entries(filterSpec)[0]
    if (key != "filter") filterSpec = {filter: toSpec}
    sc.specialValue = new FieldClause(sc.zdr, "goTo", filterSpec)
  }

}


/** registry of Card Props and "On" effects. */
export class Effects {
  /** a singleton; suitable for invoking methods */
  static effects: Effects = new Effects()
  /** a singleton; suitable for finding/editing the DataRecords. */
  dataRecs: DataRecord[] = []

  pushLogUpdateField(val: boolean) { return Effects.logUpdateField.unshift(val) }
  popLogUpdateField() { return Effects.logUpdateField.shift() }
  static isLogUpdateField():boolean { return Effects.logUpdateField[0]}
  private static logUpdateField: boolean[] = [true];

  getFirstKeyVal(clause: object): [string, object] {
    return (Object.entries(clause)[0] as [string, object])
  }
  keyIs(key: string, names: string[]) {
    return names.find(k => k === key);
  }

  /**
   * Parse PropsClause (do immediate fieldName assignments)
   * Extract 'untilKey' or 'onTrigger', parse & store response[] from valObj
   * @param card
   * @param key
   * @param valObj
   * @return the resultant DataRecord (or undefined if an IMMEDIATE fieldClause)
   */
  parseCardProp(card: Card, key: string, valObj: object): DataRecord | undefined {
    /*
    "addPropsClause" is invoked when Tile is Build/Enacted: "onBuild" or Policy is enabled "onBuy"
    a "topLevel" field or untilPhase implies: (onBuild (field1 ...) (field2 ...)) or (onBuild (untilPhase ...))
    (fieldName ...) or (cardField fieldName) are IMMEDIATE (no DataRecord created)
    (untilPhase ...) create/assert new DataRecord:
    (onTrigger ...) setup repsonses in DataRecord
    */

    /** define name as a FieldName, for future immediate/initialization clause. */
    let addField = ((name:string, fields: string[]) => {
      if (!fields.includes(name)) fields.push(name)  // cardFields, plyrFields
      if (!FieldClause.fieldNames.includes(name)) FieldClause.fieldNames.push(name)
    });

    // until-clause {untilKey: trigger-clause }  ("onBuild" (untilDiscard ... ))
    // trigger-clause {onStep: {responses...}}   ("onStep" (field1 ...) (field2 ...) )
    // {responses} = { [action-clause | special-clause], ... }
    // action-clause ::== fieldName: {set: 1, add: 3, max: 4, filter: {pred: val}}
    // {fieldName: value}
    // {untilKey: {onTrigger: propsClause}}
    // propsClause = {special: specVal, fieldName: {action: value, action: value, filter: {pred: value, pred: value}}}

    // TOP-LEVEL Field is processed as immediate/one-shot, no DataRecord
    // See also: Cards.loadCards: valProp(card, props, key) [cost is needed *before* buy/build]
    if (FieldClause.isFieldName(key)) {
      // {key: peek} ==> {fieldName: {set: peekValue}}
      let fc = new FieldClause(undefined, key, valObj) // no dataRec!

      // for Tile: all immediate are ActionClause, maybe Policy/Event may have SpecialClause...
      // assert: (this.subject instanceof Card)
      let player = card.table.curPlayer;
      console.log(stime(this, ".parseCardProp:"), {Card: card.name}, " Immediate:", {key: key, value: valObj} );
      fc.doActionClauses(card, player) // card is acting on itself: card0 = card
      return undefined;
    } else if (key == "cardFields" || key == "plyrFields") {
      // Hack dynamic FieldName extension: like (cardFields (include "val")) but as a SET, unique element.
      let val = valObj as string | string[]
      if (!(val instanceof Array)) {
        addField(val, FieldClause[key])
      } else
        val.forEach(name => addField(name, FieldClause[key]))
      return undefined;
    }
    // Tile: {onTrigger: {responses...}}   ==> {undef: {onTrigger: {resp...}}}  // untilRemoved
    // Event: {event: {responses...}} | {untilKey: {resp...}} | {onGetDist: {when...}}    <== resp: immediate!?
    // Policy: {onTrigger: {resp...}} | {special: {resp...}}                    // untilRemoved
    let aname = `${card.type}: ${json(valObj)}`
    let untilKey: string = undefined, onTrigger: string = S.onBuild // onBuild -> for adjustField()
    // Mark this DataRec for auto-removal when phase invoked. (and not execute/remove if discardActivated)
    if (key.startsWith("until")) {
      untilKey = key   // register to auto-remove this DataRecord
    } else if (key.startsWith("on")) {
      onTrigger = key    // onSomething [useful]: onStep, onStop, onTurnStart, ...
    } else {
      onTrigger = key    // filler: event, futureEvent, ... maybe some use later?
      //valObj = { key: valObj}  // reconstitute propsClause; avoid the filler
    }

    if (TP.newParseEffects) {
    let origVal = valObj
    if (key.startsWith("until")) {
      untilKey = key   // register to auto-remove this DataRecord
      let [key1, val1] = this.getFirstKeyVal(valObj)
      key = key1, valObj = val1
    }
    if (key.startsWith("on")) {
      onTrigger = key    // onSomething [useful]: onStep, onStop, onTurnStart, ...
    } else {
      onTrigger = "onBuild"    // filler: event, futureEvent, ... maybe some use later?
      valObj = origVal; // later: = { onBuild: valObj };   // reconstitute propsClause; replace the "filler"
    }
    }
    // Use curPlayer so DR will remain after card is discarded; remove when player turnEnd
    let subject = card.isDiscardActivated(card.isFromPrjs()) ? card.table.curPlayer : card
    let drspec: DRSpec = { aname, card, subject, untilKey, onTrigger }
    let dr: DataRecord = new DataRecord(drspec)

    // propsClause: ResponseClause = {response, response, ...} ==> dr.responses[]
    // response = {fieldName: {verb: value, ...}} OR {specialName: ...}
    dr.addResponses(valObj)  // propsClause = {fieldName: ..., specialName: ...}
    return dr
  }
  // {trigger-string: {field1: {verb: value, min?:numbr, filter: {pred: value}}, field2: {verb: value}, specialOp: {...}} }

  /**
   * Do Immediate fields & [maybe] create new DataRecord and add to the database.
   * PropsClause = {key: peek}
   * @param card0 the Card that has been activated to assert its props
   * @param key the first key in card.props
   * @param value the value associated with key.
   * @return the DataRecord from parseCardProp
   */
  addPropsClause(card0: Card, key: string, value: object): DataRecord {
    let dr = this.parseCardProp(card0, key, value);
    if (!!dr) {
      this.addRecord(dr)
      card0.hasDRinDB = true
    }
    return dr
  }

  /**
   * Each top-level clause is either Immediate OR creates a DataRecord.
   * Iterate to parse and add DataRecord for each card.props entry.
   * each "Prop" is a (fieldName: Value) OR (trigger: responseObject}
   * @param card a Tile being built, or an Event/Policy being activated
   * @param tag commentary for the log
   * @param props [optional] the props associated with this Card
   * @return the DataRecord[s] that were added to the db
   */
  addCardProps(card: Card, tag: string, props: object = card.props): DataRecord[] {
    let rv = Object.entries(props || {}).map(([key, val]) => this.addPropsClause(card, key, val), this)
    let log = {card: card.name, row: card.slotInfo.row, col: card.slotInfo.col, cost: card.slotInfo.stack[S.buildCost]}
    console.log(stime(this, `.addCardProps: ${tag}`), log, {db: Array.from(this.dataRecs)})
    return rv
  }
  /**
   * remove Effects inserted by the given Card
   * @param card a Card being removed from play: Tile from mainMap or Policy from policySlots
   */
  removeDRsOfCard(card: Card): DataRecord[] {
    let cardRecs = this.dataRecs.filter(rec => rec.subject == card)
    console.log(stime(this, ".removeDRsOfCard:"), { name: card.name, card }, "cardRecs=", cardRecs, { db: Array.from(this.dataRecs) })
    let rv = this.removeRecords(cardRecs)
    delete card.hasDRinDB // Note: Event may have left untilPhase(Player)
    return rv
  }
  /** when build or temp-build addProps along with undoRec. */
  addCardPropsWithUndo(card: Card, tag: string, props: object = card.props): DataRecord[] {
    card.table.addUndoRec(this, `removeDRsOfCard(${card.name}#${card.id})`, () => this.removeDRsOfCard(card))
    return this.addCardProps(card, tag, props) // [S.builds/S.polis] ASSUME: immediate effects only affect the Card (not Player/Game)
  }

  addRecord(record:DataRecord) {
    this.dataRecs.push(record)
  }
  /** remove the given DataRecord.
   * @param record a particular DR to remove
   * @return the removed record
   */
  removeRecord(record:DataRecord):DataRecord {
    // find and remove
    return this.dataRecs.find((wr:DataRecord, ndx, ary) => {
      let found = (wr === record)
      if (found) ary.splice(ndx, 1)
      return found
    })
  }
  /** remove records based on untilKey and Player
   * @param player doing the "untilKey" action (curPlayer)
   * @param untilKey "untilDraws", "untilBuilds", etc
   * @return the DataRecords that were removed
   */
  removeUntilRecords(player: Player, untilKey: string): DataRecord[] {
    let rv = this.dataRecs.filter((wr:DataRecord) => wr.untilKey == untilKey && wr.subject == player )
    return this.removeRecords(rv)
  }
  /**
   * Remove the given records
   * (partial undo of addCardProps; does not undo the IMMEDIATE effects of CardProps)
   *
   * @param rmRecs
   */
  removeRecords(rmRecs: DataRecord[]): DataRecord[] {
    rmRecs.map(dr => this.removeRecord(dr));
    return rmRecs;
  }
  /**
   * add the given records.
   * undo removeUntilRecords()
   * @param addRecs
   */
  addRecords(addRecs: DataRecord[]) {
    addRecs.forEach(dr => this.addRecord(dr))
  }

  /**
   * Find DataRecords that match given trigger,
   * and are asserted by the given Card OR by any Policy Card.
   *
   * @trigger onStep, onStop, onMove, onTurnStart (without a card)
   * @param card is null [onStartTurn] or curPlayer.onCard() [onMove, onStep, onStop]
   * @return DataRecords that match the given trigger
   */
  findTriggerOnCard(trigger: string, card?: Card): DataRecord[] {
    let rv = this.dataRecs.filter((dr: DataRecord) =>
      ((dr.onTrigger === trigger) &&
        (dr.card === card || dr.card.isPolicy()))) // remove per-Player OR inactive Policy later.
    return rv
  }

  /**
   * find all DataRecords with onTrigger and doEachResponse.
   * @param trigger string matching DataRecod.trigger field
   * @param card curCard for [onStep, onStop, onMove]; null for onTurnStart (mostly Policy)
   * @param player the curPlayer
   */
  doEffectsOnCard(trigger: string, card: Card, player: Player) {
    let datarecs = this.findTriggerOnCard(trigger, card)
    if (datarecs.length > 0 || TP.logNoDataRecsFound)
      console.log(stime(this, ".doEffectsOnCard:"), trigger, {card: card && card.name}, "found datarecs=", datarecs.length, datarecs, {db: Array.from(this.dataRecs)})
    datarecs.forEach(dr => dr.doEachResponse(card, player)) // doEffectsOnCard
  }

  /**
   * For Events: curPlayer has activated the given [Deferred/Event] Card.
   *
   * Add props/effects, do Responses, and then remove those DataRecords. (except: untilRecs)
   * @param ecard an Event card: addCardProps and do only those effects.
   * @param player for onCard and isOwner effects
   * @param props [optional] card0.props to be done
   * @return untilRecs that remain after the Event fires (subject = table.curPlayer!)
   */
  doEffectsOfEvent(ecard: Card, player: Player, props: object = ecard.props): DataRecord[] {
    // ecard may be player.onCard for pseudo-event: offerBuyCard, removeNoRentFlag
    if (ecard.isEvent() && !findFieldValue(props, "event", "withPlayer") && player.isExempt(ecard, stime(this, `.doEffects (${ecard.name})`))) return []
    let card = player.onCard() // do not require a trigger; insert into theDB, immediately removed.
    let datarecs = this.addCardProps(ecard, "Event", props)    // do immediate field effects, return DR[]
    let untilRecs = []
    console.log(stime(this, ".doEffectsOfEvent:"), { eName: ecard.name, curCard: card && card.name, ecard }, "found datarecs=", datarecs.length, datarecs, { db: Array.from(this.dataRecs) })
    datarecs.forEach(dr => {
      if (!!dr) {
        if (dr.doEachResponse(card, player) && !!dr.untilKey) { // doEffectsOfEvent (dr.card = ecard)
          untilRecs.push(dr)    // subject == curPlayer
        } else {
          this.removeRecord(dr)
        }
      }
    // ecard.props are either Immediate/FieldClause OR do-it-now SpecialClause
    // the former never get into DataRecs (!!dr)
    // the latter stay in DB: {untilKey: {someAdjust...} }, with subject = curPlayer
    })
    return untilRecs
  }

  removeNoRentFlag(card: Card) {
    let bflag = card[S.noRent]
    if (!bflag) return
    console.warn(stime(this, `.setOwner: remove noRent Flag`), bflag, card)
    this.doEffectsOfEvent(card, card.table.curPlayer, SpecialClause.reRentProps) // incls addUndoRec()
  }
  /** FieldClause that references the given fieldName: conditioned by onTrigger [S.onBuild]
   * @param fieldName only run where FieldClause.fieldName === fieldName
   * @param onTriggers only run where DataRecords.onTrigger in the supplied list
   * @return ResponseArray of onTrigger FieldClauses that affect fieldName.
   */
  findWithFieldName(fieldName: string, ...onTriggers: string[]): ResponseArray {
    let rv = Array<ResponseClause>()
    this.dataRecs.forEach(dr => {
      if (onTriggers.includes(dr.onTrigger))
        dr.responses.forEach((resp: ResponseClause) => {
          if (resp instanceof FieldClause && resp.fieldName === fieldName) rv.push(resp)
        })
      })
    return rv
  }
  /**
   * Is there a DataRecord: dr.onTrigger="special", dr.response = (specialName, specialValue)
   * @param specialName "suppressRule"
   * @param specialValue card0.name
   * @return true if Responses of indicated card are to be suppressed.
   */
  isSpecialRule(specialName: string, specialValue: any): DataRecord {
    let isTargetCard = (resp: SpecialClause): boolean => {
      return (resp instanceof SpecialClause && resp.specialName == specialName && resp.specialValue == specialValue)
    }
    return this.dataRecs.find((dr: DataRecord) => {
      return (dr.onTrigger == "special" && dr.responses.find(isTargetCard))
    })

  }
  /** Airport.props.onStats -> here */
  showAirportStats(card: Card, row: number, col: number, stack: Stack) {
    let offs = {
      N: {x: 0, y: -200},
      S: {x: 0, y: 200},
      W: {x: -200, y: -20},
      E: {x: 200, y: -20}
    }
    //console.log(stime(this, ".showAirportStats"), card.name, { card, row, col, stack})
    let table = card.table, plyr = table.curPlayer, nv = new NamedValues()
    let result = {}
    S.dirs.forEach(dir => {
      let rangeTo = nv.rangeToAirport(card, plyr, dir)
      let rent = card.rentAdjust   // maybe put { rent: 1} on Airport props?
      let rcName = `rangeTo${dir}`
      let rc = (card[rcName] as ValueCounter) || card.makeCounter(rcName, rangeTo, offs[dir].x/2, offs[dir].y/2, C.targetMark)
      result[dir] = rent
      rc.setValue(rangeTo+rent)
    })
    //console.log(stime(this, ".showAirportStats result="), result, row, col)
  }
}
