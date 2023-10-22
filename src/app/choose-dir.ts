import { stime } from '@thegraid/common-lib';
import { Container, DisplayObject, Shape } from "@thegraid/easeljs-module";
import { EzPromise } from "@thegraid/ezpromise";
import { C, S } from "./basic-intfs";
import { Card, HasSlotInfo, SlotInfo } from "./card";
import { Player } from "./player";
import { Table } from "./table";
import { TP } from "./table-params";
import { ValueCounter } from "./value-counter";

/** indicates value to display|choose for each direction & Center */
export type DirSpec = { N: number | string, E: number | string, S: number | string, W: number | string, C: number | string }
export type DirKey = keyof DirSpec
type Buttons = { N?: Button, S?: Button, E?: Button, W?: Button, C?: Button }
export class Button extends Container {
  dir: string
  shape: Shape
  coins: ValueCounter

  _cost: number
  get cost() { return this._cost };
  set cost(val: number | string) {
    let isNum = (typeof (val) == "number")
    this._cost = isNum ? val as number : 0;
    this.coins.setValue(val || 0, isNum ? C.coinGold : C.white, 50)    // val may be text: string
    this.coins.visible = (!!val)       // null cost => coin not visible
    this.visible = (val !== undefined) // so null (no coin) button is VISIBLE
    // coins==undefined ==> no Button; coins=null ==> Button, no Coin; 
  }
  set rotate(dir: string) { this.rotation = S.dirRot[dir] }

  constructor(color: string, radius: number, dir: string) {
    super()
    this.dir = dir
    this.shape = new Shape()
    this.shape.graphics.beginFill(color).drawPolyStar(0, 0, radius, 3, 0, -90)
    this.shape.rotation = S.dirRot[dir]
    this.shape.name = dir
    this.addChild(this.shape)
    this.coins = new ValueCounter("button-" + dir, 0, C.coinGold)
    this.name = dir+"-Button"
    this.coins.attachToContainer(this)
  }
}

export class ChooseDir extends Container implements HasSlotInfo {
  card: Card            // chooser is placed over this card on [mainMap]
  wide: number
  high: number
  slotInfo: SlotInfo
  buttons: Buttons = {} // {N:, S:, E:, W:, C:}
  button: DirKey;      // button.name one of: N,E,S,W,C
  dir: DirKey
  maskShape: Shape
  spec: object;
  value: number | string
  static backSize: number = 6000
  rv: EzPromise<ChooseDir>

  setSlotInfo(slotInfo: SlotInfo): SlotInfo { return this.slotInfo = slotInfo }

  /** provide container to indicate slotSize */
  constructor(table: Table) {
    super()
    let wh = table.mainMap.slotSize
    this.wide = wh.width
    this.high = wh.height
    let grey = "rbg(240, 240, 240)"
    this.makeMask(grey)
    S.dirs.forEach(dir => {
      this.makeButton(dir as DirKey, C.GREEN)
    });
    this.makeButton(S.C as DirKey, C.RED)
    //this.on("mousedown", this.clicked, this)[S.Aname] = "mousedown"
    this.on(S.click, this.clicked, this)[S.Aname] = S.click
    this.visible = false
    let parent = table.scaleCont         // to be above everything else
    parent.addChild(this)
    this.rv = new EzPromise<ChooseDir>() // no choice has been made...
  }

  fillMask(rgb: string): Shape {
    let { x, y, w, h } = TP.bgRect // from table.bgRect --> scaleC.background
    let rgba = C.rgba(rgb, .2)
    this.maskShape.graphics.clear().beginFill(rgba).drawRect(x, y, w, h)
    return this.maskShape
  }
  makeMask(rgb: string): Shape {
    if (!this.maskShape) {
      this.maskShape = new Shape()
      this.addChildAt(this.maskShape, 0)
    }
    this.fillMask(rgb)
    return this.maskShape
  }

  /** for "C", .rotation == -190 */
  makeButton(dir: DirKey, color: string, radius: number = this.wide / 4): Button {
    let h = this.high, w = this.wide
    let offs = {
      N: { x: 0.0, y: -h/2 },
      E: { x: w/2, y: 0.0 },
      S: { x: 0.0, y: h/2 },
      W: { x: -w/2, y: 0.0 },
      C: { x: 0.0, y: 0.0 }
    }
    let button: Button = new Button(color, radius, dir)
    button.name = dir
    button.x = offs[dir].x
    button.y = offs[dir].y
    this.buttons[dir] = button
    this.addChild(button)
    return button
  }

  /** wait for Player to choose a button
   * 
   * Put up GUI, fulfill EzPromise when user makes choice
   * 
   * @param card indicates where to place this chooser
   * @param player the player being asked
   * @param spec specifies the value and visiblility of the five {N,E,S,W,C} Buttons
   */
  choose(card: Card, player: Player, spec: DirSpec): EzPromise<this> {
    this.card = card
    //, callback?: (dir: string, coins: number, button: string) => void, thisArg?: object
    let rv = this.rv = new EzPromise<this>()
    this.visible = false
    let { cont, row, col } = card.getSlotInfo()
    //cont.addChild(this)
    cont.moveAndSetSlotInfo(this, row, col)
    cont.localToLocal(this.x, this.y, this.parent, this)

    this.fillMask(player.rgbColor)
    this.parent.localToLocal(0, 0, this, this.maskShape)
    let setButton = (dir: string, cost: number | string) => {
      this.buttons[dir].cost = cost
      if (cost !== undefined) this.visible = true  // any {number, string, 0, null} make Chooser visible
    }
    S.dirs.forEach(dir => setButton(dir, spec[dir]))
    setButton(S.C, spec[S.C])            // spec[C] undefined: if no cost and a dir *must* be chosen (Train Station)
    this.buttons[S.C].rotate = player.moveDir

    // If no usable Buttons, abort:
    if (!this.visible) {
      this.dir = this.value = this.button = undefined
      console.log(stime(this, ".choose: no visible choice") )
      return rv.fulfill(this)
    }

    this.spec = spec
    let parent = this.parent
    parent.setChildIndex(this, parent.numChildren -1)
    { // for debugging: this.buttons: {S.N: Button, S.E: Button, ...}
      let visStat = {}; Object.entries(this.buttons).forEach(b => visStat[b[0]] = b[1].visible)
      console.log(stime(this, ".choose"), "Buttons = ", visStat)
    }
    this.stage.update()
    player.robo.notify(this, S.chooseDir) // notify the player which must choose
    return rv
  }

  /** mousedown handler: */
  clicked(me: MouseEvent) {
    me.stopImmediatePropagation()
    let button = (me.target as DisplayObject).parent
    if (button instanceof Button) {
      this.buttonClicked(button)
    } // else: back.parent --> this instanceof ChooseDir
  }
  /** injectable Button click. */
  buttonClicked(button: Button) {
    let value = button.coins.value // == this.spec[button.dir]
    if (typeof (value) == 'string' && value.endsWith("?")) return; // ignore click on Question
    this.value = value
    this.button = button.name as DirKey
    this.dir = button.dir as DirKey
    this.rv.fulfill(this) // with this.value & this.dir set (caller: this.visible = false)
  }
  /** click on Button for dir. */
  buttonClickDir(dir: DirKey) {
    this.buttonClicked(this.buttons[dir])
  }

}