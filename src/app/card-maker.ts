import { C, F } from "@thegraid/common-lib";
import { AlphaMaskFilter, Bitmap, Container, Graphics, Text } from "@thegraid/easeljs-module";
import { GridSpec, ImageGrid } from "./image-grid";
import { CenterText, CircleShape, EllipseShape, PaintableShape, RectShape } from "./shapes";
import { NamedObject } from "./game-play";

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
type TWEAKS = {
  align?: 'left' | 'center' | 'right',
  font?: string, lineno?: number, color?: string,
  bold?: boolean, dx?: number, dy?: number, baseline?: BASELINE
};
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

class NamedContainer extends Container implements NamedObject {
  Aname: string;
  constructor(name: string, cx = 0, cy = 0) {
    super();
    this.Aname = this.name = name;
    this.x = cx; this.y = cy;
  }
}
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
  constructor(public cm: CardMaker, public cardInfo: CardInfo, scale = cm.scale) {
    super();
    this.scaleX = this.scaleY = scale;

    this.name = `CI:${cardInfo.name}`;
    this.setWidthHeight(cardInfo, cm);
    const bleed = cm.bleed;
    this.makeMaskCanvas(bleed);
    this.makeBase(); // includes cache();
    this.setTitle(cardInfo.name);
    this.setType(cardInfo.type, cardInfo.extras);
    this.setSubType(cardInfo.subtype, { lineno: 1 });
    this.setText(cardInfo.text)
    this.updateCache();
  }

  cardw: number;
  cardh: number;
  setWidthHeight(cardInfo = this.cardInfo, cm = this.cm) {
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
  // https://stackoverflow.com/questions/64583689/setting-font-weight-on-canvas-text
  composeFontName(size: number, fam_wght: string, ) {
    // extract weight info, compose: ${style} ${weight} ${family}
    const style = 'normal'; // assert: style is not included in original fontstr: 'nnpx family weight'
    const regex = / (\d+|thin|light|regular|normal|bold|semibold|heavy)$/i;
    const match = fam_wght.match(regex);
    const weight = match?.[1];
    const family = weight ? fam_wght.slice(0, match.index) : fam_wght;
    const fontstr = `${style} ${weight ?? 410} ${size}px ${family}`;
    return fontstr;
  }

  shrinkFontForWidth(xwide: number, text: string, fontsize: number, fontspec: string,  ) {
    const width = new Text(text, fontspec).getMeasuredWidth();
    return (width <= xwide) ? fontsize : Math.floor(fontsize * xwide / width);
  }

  /** make Text object, optionally shrink to fit xwide. */
  makeText(text: string, size0: number, fam_wght = this.cm.textFont, color = C.BLACK, xwide?: number) {
    const fontname0 = this.composeFontName(size0, fam_wght);
    const fontsize = (xwide !== undefined) ? this.shrinkFontForWidth(xwide, text, size0, fontname0) : size0;
    const fontname = (xwide !== undefined) ? this.composeFontName(fontsize, fam_wght) : fontname0;
    return new CenterText(text, fontname, color);
  }

  /** setText [Centered] with Tweaks: { color, dx, dy, lineno, baseline, align} */
  setTextTweaks(text: string | Text, fontsize: number, fontname: string, tweaks?: TWEAKS) {
    const { color, dx, dy, lineno, baseline, align } = tweaks ?? {};
    const text0 = (text instanceof Text) ? text.text : text;
    const cText = (text instanceof Text) ? text : this.makeText(text, fontsize, fontname, color ?? C.BLACK);
    const liney = lineno ? lineno * cText.getMeasuredLineHeight() : 0;
    cText.textBaseline = (baseline ?? 'middle'); // 'top' | 'bottom'
    cText.textAlign = (align ?? 'center');
    cText.x += (dx ?? 0);
    cText.y += ((dy ?? 0) + liney);
    return this.addChild(cText);
  }

  /** set Title centered in topBand */
  setTitle(name: string) {
    const xwide = this.cardw - (2 * this.cm.edge);// - this.cm.coinSize;// * (1.84 / .84) // 2.1904
    const nameText = this.makeText(name, this.cm.textSize, this.cm.titleFont, C.BLACK, xwide);
    nameText.y = -this.cardh / 2 + (this.ty / 2);
    return this.addChild(nameText);
  }

  //  args=[lineno] put subtype after nth line.
  //  line=0 is always CARD-TYPE-SIZE (no shrink) [???]
  //  line=1 starts below that, and may be shrunk.
  /** set Type centered in bottomBand; subType on lineno. */
  setType(type: string, tweaks?: { lineno?: number, color?: string } & TWEAKS) {
    const color = tweaks?.color ?? C.BLACK;
    const xwide = this.cardw - (2 * this.cm.edge) - this.cm.coinSize * (1.84 / .84) // 2.1904
    const text = this.makeText(type, this.cm.typeSize, this.cm.typeFont, color, xwide);
    const lineh = text.getMeasuredLineHeight();
    // const offset = (tweaks?.lineno ? tweaks.lineno * lineh : 0);
    this.setTextTweaks(text, undefined, undefined, { baseline: 'bottom', ...tweaks });
    text.y += this.cardh / 2 - (this.cm.bottomBand / 2);
    return text;
  }

  setSubType(type: string, tweaks?:  { lineno?: number, color?: string }) {
    if (type) this.setType(type, tweaks);
  }

  makeCoin(value: number | string, size = this.cm.coinSize, cx = 0, cy = 0, args?: { color?: string, fontn?: string, r180?: boolean, oval?: number }) {
    const def = { color: C.BLACK, fontn: this.cm.coinFont, r180: false, oval: 0 };
    const { color, fontn, r180, oval } = { ...def, ...args };
    const rv = new NamedContainer(`Coin(${value})`, cx, cy);
    const rx = (oval === 0) ? size : size * (1 - oval);
    const ry = (oval === 0) ? size : size * oval;
    const coin = new EllipseShape(C.coinGold, rx, ry, '');
    const fontsize = Math.floor(size * .82); // 110 -> 90;
    const fontspec = this.composeFontName(fontsize, fontn);
    const val = new CenterText(`${value}`, fontspec, color);
    val.y += (value === '*') ? fontsize * .05 : 0;  // push '*' down to center of coin
    if (r180) val.rotation = 180;
    rv.addChild(coin, val);
    return rv;
  }

  /** add coin(value) at (cx, cy) */
  setCoin(value: number | string, size= this.cm.coinSize, cx = 0, cy = 0) {
    return this.addChild(this.makeCoin(value, size, cx, cy));
  }

  /** addChild(coinObj) at return end XY; next Text starts there. */
  setTextCoin(line: string, tsize0: number, tfont: string, lineno: number, liney: number) {
    const frags = line.split('$');
    const xwide = this.cardw - this.cm.edge * 2 - (frags.length - 1) * tsize0;
    const font0 = this.composeFontName(tsize0, tfont);
    const tsize = this.shrinkFontForWidth(xwide, line, tsize0, font0);
    const fontn = this.composeFontName(tsize, tfont);
    const linet = new Text(line, fontn);
    const lineh = linet.getMeasuredLineHeight();
    const coinr = lineh;             // pixel height of font.
    const coindx = coinr + 0;        // fudge as circle replaces '$v'
    const linew = linet.getMeasuredWidth();
    const { width } = linet.getBounds()
    let linex = -linew / 2;          // full line will be centered.
    frags.forEach((frag, n) => {
      const dx = linex, dy = liney + lineno * lineh;
      const fragt = this.setTextTweaks(frag, tsize, tfont, { dx, dy, align: 'left' });
      linex += fragt.getMeasuredWidth();
      if (n + 1 < frags.length) {
        // prep for next frag:
        const vre = /^\d+/;
        const fragn = frags[n + 1];  // if frag has '$', then fragn starts with /^\d+/
        const val = fragn.match(vre)?.[0] ?? '?';
        frags[n + 1] = fragn.replace(vre, '');
        const coin = this.setCoin(val, coinr, linex, liney + (lineno - .5) * lineh);
        linex = linex + coindx;
      }
    })
  }

  /** set main Text on card, center each line; multiline & coin glyph. */
  setText(text: string | [string, ...any[]] | object, y0?: number) {
    const y = (y0 !== undefined) ? y0 : -this.cardh/2 + this.cm.topBand + this.cm.topBand + this.cm.textSize;
    const tfont = this.cm.textFont, tsize = this.cm.textSize;
    const tlines = ((typeof text === 'string') ? text : text?.[0]) ?? '';
    if (!tlines) return;
    const lines = tlines.split('\n');
    lines.forEach((line: string, lineno: number) => {
      if (!line.includes('$')) {
        this.setTextTweaks(line, tsize, tfont, { lineno, dy: y });
      } else {
        this.setTextCoin(line, tsize, tfont, lineno, y)
      }
    })
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
  /** RoundedRect for CardImage boundary. */
  makeMaskCanvas(bleed = this.cm.bleed, r = this.cm.radi, scale = 1) {
    let { w, h } = { w: this.cardw, h: this.cardh };
    const { x, y } = { x: -w / 2, y: -h / 2 };
    const maskr = this.maskr = new RectShape({ x, y, w, h, r: r + bleed }, C.BLACK, ''); // with setBounds()
    maskr.cache(x, y, w, h, scale);
    this.maskCanvas = maskr.cacheCanvas as HTMLCanvasElement;
    this.setBounds(x, y, w, h);
  }
  get ty() { return this.cardInfo.ty ?? this.cm.topBand }
  get by() { return this.cardInfo.by ?? this.cm.bottomBand }

  // card-make-image-background (ty, by, color)
  makeBase() {
    const color = this.cardInfo.color ?? 'pink';
    const { x, y, width: w, height: h } = this.getBounds();
    this.baseShape = new RectShape({ x, y, w, h }, undefined, '');
    const ty = this.ty; // default top-band
    const by = this.by;
    const tband = new RectShape({ x, y: - h / 2, w, h: ty }, color, '');
    const bband = new RectShape({ x, y: h / 2 - by, w, h: by }, color, '');
    this.filters = [ new AlphaMaskFilter(this.maskCanvas)]; // implicit "destination-in"
    this.addChild(this.baseShape, tband, bband);
    this.cache(x, y, w, h);
  }
}
class CI_Tile extends CI {

}
class CI_Event extends CI {

}
class CI_Road extends CI {

}
class CI_Home extends CI {

}
class CI_Move extends CI {

}
class CI_Dir extends CI {

}
class CI_Token extends CI {

  override setWidthHeight(cardInfo?: CardInfo, cm?: CardMaker): void {
    this.cardw = this.cardh = cm.circle_image_size;
  }
  override makeMaskCanvas(bleed?: number, r?: number, scale?: number): void {
    super.makeMaskCanvas(bleed, this.cm.circle_image_size / 2, scale);
  }

  override setType(type: string, tweaks?: TWEAKS) {
    return undefined as CenterText;
  }
}

/** holds all the context; use a factory to make a Card (or CardImage?) based on supplied CardInfo */
export class CardMaker {
  transitColor = 'rgb(180,180,180)';    // very light grey
  comTransitColor = 'rgb(180,120,80)';  // Brown/Grey

  circle_image_size = 125;
  square_image_size = 115;

  readonly withBleed = false;
  get bleed() { return this.withBleed ? this.gridSpec.bleed : 0; }
  get edge() { return this.gridSpec.safe + this.bleed };
  get topBand() { return 115 + this.bleed; }
  get bottomBand() { return 130 + this.bleed; }

  textFont = 'Times New Roman 400';
  sfFont = 'SF Compact Rounded';
  fontFam = 'Nunito';                     // Nunito is variable weight, but less compact
  titleFont = `${this.fontFam} 600`;      // Medium font-weight: 557
  typeFont = `${this.fontFam} 557`;
  coinFont = `${this.fontFam} 557`;
  vpFont = `${this.fontFam} 659`;
  dirFont = `${this.fontFam} 659`; // Semibold font-weight: 659

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

  constructor(public gridSpec: GridSpec = ImageGrid.cardSingle_1_75, public scale = 1) {
    const mBleed = 2 * (this.withBleed ? 0 : gridSpec.bleed);
    this.cardw = gridSpec.cardw - mBleed; // 800, includes bleed
    this.cardh = gridSpec.cardh - mBleed;
    this.radi = (gridSpec.radi ?? this.radi) + (this.withBleed ? gridSpec.bleed : 0);     // corner radius
    this.safe = (gridSpec.safe ?? this.safe);     // text/image safe edge
  }
  makeCard(info: CardInfo) {
    const type: CardType = info.type;
    switch (info.type) {
      case 'Residential':
      case 'Financial':
      case 'Industrial':
      case 'Commercial':
      case 'Municipal':
      case 'Government':
      case 'High Tech':
          return new CI_Tile(this, info);

      case 'Event':
      case 'Future Event':
      case 'Deferred':
      case 'Temp Policy':
      case 'Policy':
          return new CI_Event(this, info); // landscape Event/Policy


      case 'Road':
          return new CI_Road(this, info);

      case 'House':  // card-type-home
          return new CI_Home(this, info);

      case 'Owner':  // for Flag
      case 'Distance':
        return new CI_Move(this, info);

      // Token-type
      case 'Debt':
      case 'house':
      case 'marker':
        return new CI_Token(this, info);

      case 'Blocked':
      case 'Direction':
      case 'Alignment':
      case 'Back':
      default:
        return new CI(this,info);
    }
  }
}
