import { Container } from "@thegraid/easeljs-module";
import { GridSpec } from "./image-grid";
import { PaintableShape, RectShape } from "./shapes";
import { C } from "@thegraid/common-lib";


const TokenTypes = [
  'Debt',
  'house',
  'marker',
] as const;
export type TokenType = typeof TokenTypes[number];

const CardTypes = [
  'Alignment',
  'Back',
  'Blocked',
  'Direction',
  'Distance',
  'Future Event', // subtype: 'Tax', 'Policy',
  'Deferred',
  'Event',
  'Road',
  'Policy',
  'Temp Policy',
  'Industrial', 'High Tech',
  'House',
  'Residential',
  'Owner', // for Flag!
  'Financial',
  'Commercial',
  'Municipal',
  'Government',
] as const;
export type CardType = typeof CardTypes[number] | TokenType;


const SubTypes = [
  'Tax', 'Policy', 'Bonus', 'Home', 'Gov', 'Damage', 'Municipal', // Stadium --> Commercial + Municipal
  'Transit', 'Com-Transit', // Taxi --> Transit + Com-Transit
  'Social Network', 'Shiny Devices', 'Online Shopping', 'Streaming Video', 'Internet Ads',
  'Home', 'Bank', 'Build', 'Bar', 'Shop', 'Park',
  'N', 'E', 'S', 'W', 'NW', 'NE', 'SE', 'SW', 'EW', 'NS',  // see also HexDir & 'EW' | 'NS'
  'Test',
] as const;
export type SubType = typeof SubTypes[number];

type xiarg = number | 'center' | 'fit' | 'card' | 'scale' | 'reg';
type yiarg = number | 'center' | 'fit' | 'top';
// type CI = Container; // may be full Card or likely the container to produce a BitMap image/cache

export interface CardInfo {
  path: string; // path to image.png
  nreps?: number;
  type?: CardType | TokenType;
  name?: string;
  title?: string;
  cost?: string | number;
  step?: number;
  stop?: number;
  rent?: number;
  vp?: string | number;
  ext?: string | null;
  subtype?: SubType | null;
  text?: string | [string, ...any[]] | null;
  textLow?: string | null;
  ispec?: [name?: string, x?: xiarg, y?: yiarg, w?: number, h?: number | 'xs'];
  props?: object;
  image?: HTMLImageElement;
  imagePromise?: Promise<HTMLImageElement>
}

class CI extends Container {
  baseShape: PaintableShape;
  constructor(public cm: CardMaker) {
    super();
  }

  setCacheID() {
    if (!this.cacheID) {
      const b = this.getBounds();            // Bounds are set
      this.cache(b.x, b.y, b.width, b.height);
    } else {
      this.updateCache();
    }
  }
  /** crop to RR based on bleed & radi */
  select_rr(bleed = false, radi = this.cm.radi) {
    const r = radi + (bleed ? this.cm.bleed : 0);
    const rr = new RectShape({x: 0, y: 0, w: this.cm.cardw, h: this.cm.cardh, r}, C.BLACK);
    this.setCacheID();
    this.baseShape.graphics = rr.graphics;
    this.updateCache("source-in"); // outside the rr, set transparent.
  }

  makeBase() {
    this.baseShape = new RectShape({x: 0, y: 0, w: this.cm.cardw, h: this.cm.cardh});
  }

  makeCard(info: CardInfo) {
    this.makeBase();
    // TODO: inject info!
  }

}

export class CardMaker {
  transitColor = 'rgb(180,180,180)';    // very light grey
  comTransitColor = 'rgb(180,120,80)';  // Brown/Grey

  get templ() { return this.gridSpec };
  get bleed() { return this.templ.bleed }
  get edge() { return this.gridSpec.bleed + this.gridSpec.safe; };
  get topBand() { return 115 + this.bleed; }
  get bottomBand() { return 130 + this.bleed; }

  textFont = '"Times New Roman"';
  titleFont = this.textFont;
  typeFont = this.textFont;
  coinFont = 'SF Compact Rounded Medium';
  vpFont = 'SF Compact Rounded Medium';    // font-weight: 557
  dirFont = 'SF Compact Rounded Semibold'; // font-weight: 659

  titleSize = 60;
  textSize = 50;
  typeSize = 40;
  coinSize = 90;
  vpSize = 70;
  dirSize = 400; // font size! (and then shrink-to-fit)

  // GridSpec.dpi can do card-scale...? just use: Container.scale for in-app sizing.
  cardw = 750; // 800 with bleed
  cardh = 525; // 575 with bleed
  safe = 25;
  radi = 37;

  fileDir = 'citymap';
  ci: CI;

  constructor(public gridSpec: GridSpec) {
    this.cardw = gridSpec.cardw; // 800, includes bleed
    this.cardh = gridSpec.cardh;
    this.radi = gridSpec.radi ?? this.radi;     // corner radius
    this.safe = gridSpec.safe ?? this.safe;     // text/image safe edge
  }
}
