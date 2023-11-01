import { C, F } from "@thegraid/common-lib";
import { AlphaMaskFilter, Bitmap, Container, Graphics, Text } from "@thegraid/easeljs-module";
import { GridSpec, ImageGrid } from "./image-grid";
import { CenterText, PaintableShape, RectShape } from "./shapes";

// (define BLACK  '(0    0   0))
// (define GREY   '(128 128 128))
// (define WHITE  '(255 255 255))
// (define BROWN  '(185 83 0))
// (define DEBT   '(224 92  0)) ; #e05c00
// (define GOLD   '(235 188 0))
// (define RED    '(239 32 60))
// (define ORANGE '(255 128 0))
// (define YELLOW '(255 255 0))
// (define GREEN  '( 21 180 0))
// (define BLUE1  '( 36 36 255))		; dark
// (define BLUE   '(162 162 255))		; lighter, purpler
// (define PURPLE '(232 115 255))
// (define GREEN2 `(4 201 0))		; GREEN for HouseTokens

type BASELINE = "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";
type TWEAKS = { font?: string, color?: string, bold?: boolean, dx?: number, dy?: number, baseline?: BASELINE };
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
  nreps?: number;
  name?: string;
  type?: CardType | TokenType;
  subtype?: SubType | null;
  color?: string | null;
  cost?: string | number;
  step?: number;
  stop?: number;
  rent?: number;
  vp?: string | number;
  ext?: string | null;
  text?: string | [string, ...any[]] | null | object;
  textLow?: string | null | object;
  ispec?: [name?: string, x?: xiarg, y?: yiarg, w?: number, h?: number | 'xs']; // ~/Google Drive/jpeckj/Estates/images/...
  props?: object;     // cardProps: event/policy/tile script
  // BACK-DECK
  bgcolor?: string;
  portrait?: boolean; // rotate before exporting
  ty?: number;        // top-band (60)
  by?: number;        // bottom-band (60)

  extras?: object;    // extracted to textLow, ispec, props, etc.
  path?: string;      // name of created card image (.png)
  image?: HTMLImageElement; // loaded card image; from citymap/gimp
  imagePromise?: Promise<HTMLImageElement> // waiting for image to load from disk
}

/** CardImage (for a Card) based on CardInfo */
export class CI extends Container {
  baseShape: PaintableShape;
  constructor(public cm: CardMaker, public cardInfo: CardInfo, scale = 1.0) {
    super();
    this.scaleX = this.scaleY = scale;
    this.name = `CI:${cardInfo.name}`;
    this.setPortrait(cardInfo, cm);
    const bleed = cm.bleed;
    this.makeMaskCanvas(bleed);
    this.makeBase(); // includes cache();
    this.setTitle(cardInfo.name);
    this.setType(cardInfo.type, cardInfo.extras);
    cardInfo.subtype && this.setType(cardInfo.subtype, {lineno: 1});
    this.updateCache();
  }

  cardw: number;
  cardh: number;
  setPortrait(cardInfo = this.cardInfo, cm = this.cm) {
    if (cardInfo.portrait === undefined) {
      cardInfo.portrait = (!['Event', 'Policy', 'Temp Policy', 'Future Event', 'Deferred'].includes(cardInfo.type));
    }
    const p = cardInfo.portrait;
    this.cardw = p ? Math.min(cm.cardh, cm.cardw) : Math.max(cm.cardh, cm.cardw);
    this.cardh = p ? Math.max(cm.cardh, cm.cardw) : Math.min(cm.cardh, cm.cardw);
  }

  getBitmap() {
    return new Bitmap(this.cacheCanvas);
  }

  shrinkFontForWidth(xwide: number, text: string, size: number, fontn: string,  ) {
    const width = new Text(text, F.fontSpec(size, fontn)).getMeasuredWidth();
    return (width <= xwide) ? size : Math.floor(size * xwide / width);
  }

  makeText(text: string, size: number, fontn = this.cm.textFont, color = C.BLACK, xwide?: number) {
    const fontsize = xwide ? this.shrinkFontForWidth(xwide, text, size, fontn) : size;
    return new CenterText(text, F.fontSpec(fontsize, fontn), color);
  }

  setTitle(name: string) {
    const xwide = this.cardw - (2 * this.cm.edge);// - this.cm.coinSize;// * (1.84 / .84) // 2.1904
    const nameText = this.makeText(name, this.cm.textSize, this.cm.titleFont, C.BLACK, xwide);
    nameText.y = -this.cardh / 2 + (this.ty / 2);
    this.addChild(nameText);
  }

  /** makeText with Tweaks: { color, dx, dy, baseline, } */
  setText(text: string | Text, fontsize: number, fontname: string, tweaks?: TWEAKS) {
    const cText = (text instanceof Text) ? text : this.makeText(text, fontsize, fontname, tweaks?.color ?? C.BLACK);
    cText.textBaseline = (tweaks?.baseline ?? 'middle'); // 'top' | 'bottom'
    cText.x += (tweaks?.dx ?? 0);
    cText.y += (tweaks?.dy ?? 0);
    return this.addChild(cText);
  }

  //  args=[lineno] put subtype after nth line.
  //  line=0 is always CARD-TYPE-SIZE (no shrink) [???]
  //  line=1 starts below that, and may be shrunk.
  setType(type: string, tweaks?: { lineno?: number, color?: string } & TWEAKS) {
    const color = tweaks?.color ?? C.BLACK;
    const xwide = this.cardw - (2 * this.cm.edge) - this.cm.coinSize * (1.84 / .84) // 2.1904
    const text = this.makeText(type, this.cm.typeSize, this.cm.typeFont, color, xwide);
    const lineh = text.getMeasuredLineHeight();
    const offset = tweaks?.lineno ? tweaks.lineno * lineh : 0;
    this.setText(text, undefined, undefined, { ...tweaks });
    text.y += this.cardh / 2 - (this.cm.bottomBand / 2) + offset;
    return text;
  }

  setCacheID() {
    if (!this.cacheID) {
      const b = this.getBounds();            // Bounds are set
      this.cache(b.x, b.y, b.width, b.height);
    } else {
      this.updateCache();
    }
  }

  maskr: RectShape;
  maskCanvas: HTMLCanvasElement;
  makeMaskCanvas(bleed = this.cm.bleed, scale = 1) {
    const p = this.cardInfo.portrait;
    let { w, h, r } = { w: this.cardw, h: this.cardh, r: this.cm.radi };
    const { x, y } = { x: -w / 2, y: -h / 2 };
    const maskr = this.maskr = new RectShape({ x, y, w, h, r: r + bleed }, C.BLACK, ''); // with setBounds()
    maskr.cache(x, y, w, h, scale);
    this.maskCanvas = maskr.cacheCanvas as HTMLCanvasElement;
    this.setBounds(x, y, w, h);
  }
  get ty() { return this.cardInfo.ty ?? (115 + this.cm.bleed) }
  get by() { return this.cardInfo.by ?? (130 + this.cm.bleed) }

  // card-make-image-background (ty, by, color)
  makeBase() {
    const color = this.cardInfo.color ?? 'pink';
    const { x, y, width: w, height: h } = this.getBounds();
    this.baseShape = new RectShape({ x, y, w, h });
    const ty = this.ty; // default top-band
    const by = this.by;
    const tband = new RectShape({ x, y: - h / 2, w, h: ty }, color);
    const bband = new RectShape({ x, y: h / 2 - by, w, h: by }, color);
    this.filters = [ new AlphaMaskFilter(this.maskCanvas)]; // implicit "destination-in"
    this.addChild(this.baseShape, tband, bband);
    this.cache(x, y, w, h);
  }
}

/** holds all the context; use a factory to make a Card (or CardImage?) based on supplied CardInfo */
export class CardMaker {
  transitColor = 'rgb(180,180,180)';    // very light grey
  comTransitColor = 'rgb(180,120,80)';  // Brown/Grey

  readonly withBleed = false;
  get bleed() { return this.withBleed ? this.gridSpec.bleed : 0; }
  get edge() { return this.gridSpec.safe + this.bleed };
  get topBand() { return 115 + this.bleed; }
  get bottomBand() { return 130 + this.bleed; }

  textFont = '"Times New Roman"';
  titleFont = 'SF Compact Rounded Medium';
  typeFont = 'SF Compact Rounded Medium';
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
  radi = 37;   // (1/8 inch)

  fileDir = 'citymap';
  ci: CI;

  constructor(public gridSpec: GridSpec = ImageGrid.cardSingle_1_75) {
    const mBleed = 2 * (this.withBleed ? 0 : gridSpec.bleed);
    this.cardw = gridSpec.cardw - mBleed; // 800, includes bleed
    this.cardh = gridSpec.cardh - mBleed;
    this.radi = (gridSpec.radi ?? this.radi) + (this.withBleed ? gridSpec.bleed : 0);     // corner radius
    this.safe = (gridSpec.safe ?? this.safe);     // text/image safe edge
  }
}
