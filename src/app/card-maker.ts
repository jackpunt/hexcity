import { C } from "@thegraid/common-lib";
import { AlphaMaskFilter, Bitmap, Container, Shape, Text } from "@thegraid/easeljs-module";
import { EzPromise } from "@thegraid/ezpromise";
import { NamedObject } from "./game-play";
import { GridSpec, ImageGrid } from "./image-grid";
import { ImageLoader } from "./image-loader";
import { CenterText, EllipseShape, PaintableShape, RectShape } from "./shapes";

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

// function moa(objs) {let rv={}; objs.forEach(obj => rv = {...rv, ...obj}); return rv;}
function mergeObjectArray<T>(objs: T[]) {
    let rv = {} as T;
    objs.forEach(obj => rv = {...rv, ...obj})
    return rv;
  }

type BASELINE = "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";
type TWEAKS = {
  align?: 'left' | 'center' | 'right', size?: number,
  font?: string, lineno?: number, color?: string, nlh?: number, // add lead to after/btwn each line.
  wght?: string | number, dx?: number, dy?: number, baseline?: BASELINE
};
// type TWEAK_KEY = keyof TWEAKS;
// type TWEAK = { [key in TWEAK_KEY]?: string | number };
type XTEXT = [text: string, x?: number | 'center', y?: number | 'center' | 'top', justify?: 'LEFTJ' | 'CENTER' | 'RIGHTJ', size?: number, fontname?: string, color?: string, rest?: TWEAKS];
type XLINE = [y: number, color?: string, margin?: number, thick?: number];
type XIMAGE = [name: string | null,
  x?: number | "center" | "fit" | "card",
  y?: number | "center" | "fit" | "top",
  w?: number,
  h?: number | "xs" // match width (x-size)
];   // for now, image: null OR image: [null, x, y, w, h]; never image: 'fname'
type LVAL = string|number|any[];
type EXTRAS = {
  text?: XTEXT,
  line?: XLINE,
  vp?: XTEXT | string | number,
  cardProps?: any,
  ext?: any,
  image?: XIMAGE,
  coin?: number,
  step?: LVAL,
  subtype?: LVAL,
  filen?: LVAL,
  xname?: LVAL,
  textLow?: string | [text: string, ...tweaks: TWEAKS[]],
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

/** for generated *-deck.ts, with string | number */
export interface CardInfo2 {
  nreps?: number;
  name?: string;
  type?: CardType | TokenType;
  subtype?: SubType | null;
  color?: string | null;
  cost?: string | number;
  step?: number | string;
  stop?: number | string;
  rent?: number | string;
  vp?: string | number;
  ext?: string | null;
  text?: string | null | object;
  textLow?: string | null | object;
  ispec?: [name?: string, x?: xiarg, y?: yiarg, w?: number, h?: number | 'xs']; // ~/Google Drive/jpeckj/Estates/images/...
  props?: object;     // cardProps: event/policy/tile script
  // BACK-DECK
  bgcolor?: string;
  portrait?: boolean; // rotate before exporting
  ty?: number;        // top-band (60)
  by?: number;        // bottom-band (60)

  extras?: EXTRAS[];    // extracted to textLow, ispec, props, etc.
  path?: string;      // name of created card image (.png)
  image?: HTMLImageElement; // loaded card image; from citymap/gimp
  imagePromise?: Promise<HTMLImageElement> // waiting for image to load from disk
}

/** used by Card, step,stop,rent reduced to number. */
export interface CardInfo extends CardInfo2 {
  step?: number;
  stop?: number;
  rent?: number;
}

/** CardImage (for a Card) based on CardInfo */
export class CI extends Container {
  static fnames = [
    'Airport', 'Bar', 'Casino', 'Cineplex', 'Grocery', 'Lake', 'Mall',
    'Park', 'Playground', 'Plaza', 'Restaurant', 'School', 'Stadium', 'Taxi',
    'CitymapBackBleed', 'CitymapBackBleedL', 'BoomBackBleed', 'BoomBackBleedL',
    'Home', 'ROT-L', 'ROT-R', 'THRU-S', 'TURN-L', 'TURN-R'
  ];
  static images = { root: '/assets/main/images/ximage/', fnames: CI.fnames, ext: 'png'};
  static imageLoader = new ImageLoader(CI.images, undefined, ); // (imap) => { console.log(`CI.imageloader:`, imap)}
  static ipser = 0;

  constructor(public cm: CardMaker, public cardInfo: CardInfo2, scale = cm.scale) {
    super();
    this.scaleX = this.scaleY = scale;

    this.name = `CI:${cardInfo.name}`;
    this.setWidthHeight(cardInfo, cm);
    const bleed = cm.bleed;
    this.makeMaskCanvas(bleed);
    this.makeBase(); // includes cache();
    this.setTitle(cardInfo.name);
    this.setType(cardInfo.type);
    this.setCost(cardInfo.cost);
    this.setVP(cardInfo.vp);
    this.setSubType(cardInfo.subtype, { lineno: 1 });
    this.setPriceBar(cardInfo);
    this.setText(cardInfo.text);
    this.updateCache();   // what we have so far...
    this.ciPromise = new EzPromise<CI>();
    const iname = this.iname;
    const ximage = iname && CI.imageLoader.imap.get(iname);
    if (iname && !ximage) {
      this.loadImageSetExtras();
      return;
    }
    this.finishWithXimage(ximage);
  }
  ciPromise: EzPromise<CI>;

  get iname() {
    const imageElt = this.cardInfo.extras?.find(elt => elt.image !== undefined);
    const fname = imageElt && (imageElt.image?.[0] ?? this.cardInfo.path)?.split('.')[0];
    return fname;
  }

  ximage: HTMLImageElement;
  loadImageSetExtras() {
    const imageElt = this.cardInfo.extras?.find(elt => elt.image !== undefined);
    const fname = imageElt && (imageElt.image?.[0] ?? this.cardInfo.path); // null --> undefined --> path
    const ip = fname && CI.imageLoader.loadImage(fname);
    const ximage = CI.imageLoader.imap.get(fname);
    if (!ximage) {
      ip.then(
        ximage => {
          this.finishWithXimage(ximage);
          this.stage?.update();
        },
        reason => (this.finishWithXimage(), undefined));
    } else {
      this.finishWithXimage(ximage);
    }
  }

  finishWithXimage(ximage?: HTMLImageElement) {
    this.ximage = ximage;
    this.setExtras(this.cardInfo.extras)
    this.updateCache();
    this.ciPromise.fulfill(this);
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

  baseShape: PaintableShape;
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

  /** replace weight */
  family_wght(fam_wght: string, wght?: string | number) {
    // extract weight info, compose: ${style} ${weight} ${family}
    const regex = / (\d+|thin|light|regular|normal|bold|semibold|heavy)$/i;
    const match = fam_wght.match(regex);
    const weight = wght ?? match?.[1];
    const family = weight ? fam_wght.slice(0, match.index) : fam_wght;
    const fontstr = `${family} ${weight ?? 410}`;
    return fontstr;
  }

  // https://stackoverflow.com/questions/64583689/setting-font-weight-on-canvas-text
  composeFontName(size: number, fam_wght: string, wght?: string | number) {
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
    const lines = text.split('\n');
    let width = 0;
    lines.forEach(line => {
      const wide = new Text(line, fontspec).getMeasuredWidth();
      width = Math.max(width, wide);
    })
    return (width <= xwide) ? fontsize : Math.floor(fontsize * xwide / width);
  }

  fontSize(fontSpec: string) {
    const pixels = fontSpec.match(/(\d+)px/)?.[1];
    return Number.parseInt(pixels);
  }

  /** make Text object, optionally shrink to fit xwide.
   * @param size0: requested size of Font, shrink to fit xwide;
   * @param fam_wght (if fully resolved, supply size0 = xwide = undefined)
   * @param xwide: max width of Text, shrink fontSize fit. supply undefined if fam_wght is fully resolved.
   */
  makeText(text: string, size0?: number, fam_wght = this.cm.textFont, color = C.BLACK, xwide?: number) {
    const fontname0 = (size0 !== undefined) ? this.composeFontName(size0, fam_wght) : fam_wght;
    const fontsize = (xwide !== undefined) ? this.shrinkFontForWidth(xwide, text, size0, fontname0) : size0;
    const fontname = (xwide !== undefined) ? this.composeFontName(fontsize, fam_wght) : fontname0;
    return new CenterText(text, fontname, color);
  }

  /** addChild(coinObj) at return end XY; next Text starts there. */
  setTextWithCoins0(line: string, lineh: number, fontn: string, lineno: number, dy: number, tweaks: TWEAKS) {
    const linet = new Text(line, fontn);
    const coinr = .47 * lineh;           // lineh = pixel height of font = (1.2 * M-width)
    const coindx = coinr * 2 + 0;        // fudge as circle replaces '$v'
    const linew = linet.getMeasuredWidth();
    const cy = dy;
    let dx = -linew / 2;                 // start at left of centered linew.
    line.split('$').forEach((frag, n, frags) => {     // ASSERT: frag has no newline
      const fragt = this.setTextTweaks(frag, undefined, fontn, {...tweaks, dx, dy, align: 'left' });
      dx += fragt.getMeasuredWidth();
      if (n + 1 < frags.length) {
        // prep for next frag:
        const vre = /^\d+/;
        const fragn = frags[n + 1];  // if frag has '$', then fragn starts with /^\d+/
        const val = fragn.match(vre)?.[0] ?? '?';
        const coin = this.setCoin(val, coinr, dx + coinr, cy - lineh * .08);
        frags[n + 1] = fragn.replace(vre, '');
        dx = dx + coindx;
      }
    })
  }

  /** setText [Centered] with Tweaks: { color, dx, dy, lineno, baseline, align, nlh}
   * @param fontSize is fed to makeText (with xwide === undefined)
   * @param fontName is fed to makeText
   * @param tweaks: dy: initial y-coord, lineno: advances by lineh;
   */
  setTextTweaks(text: string | Text, fontsize: number, fontname: string, tweaks?: TWEAKS) {
    const { color, dx, dy, lineno, baseline, align, nlh, wght } = tweaks ?? {};
    if (wght) fontname = this.family_wght(fontname, wght);
    const cText = (text instanceof Text) ? text : this.makeText(text, fontsize, fontname, color ?? C.BLACK);
    const fname = cText.font;            // shrink-resolved fontName
    const lineh = cText.lineHeight = nlh ?? (cText.lineHeight > 0 ? cText.lineHeight : cText.getMeasuredLineHeight());
    const liney = (lineno ?? 0) * lineh; // first
    const rText = cText.text;
    const tweak2 = {...tweaks, lineno: 0, baseline: (baseline ?? 'middle'), align: (align ?? 'center') }
    if (rText.includes('$')) {
      const lines = rText.split('\n');
      lines.forEach((line, lineinc) => {
        const dy2 = (dy ?? 0) + liney + lineinc * lineh;
        this.setTextWithCoins0(line, lineh, fname, lineinc, dy2, tweak2);
      })
      return undefined;
    }
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
  setType(type: string, tweaks?: TWEAKS) {
    const color = tweaks?.color ?? C.BLACK;
    const xwide = this.cardw - (2 * this.cm.edge) - 2.2 * this.cm.coinSize;
    const text = this.makeText(type, this.cm.typeSize, this.cm.typeFont, color, xwide);
    const dy = this.cardh / 2 - (this.cm.bottomBand / 2);
    this.setTextTweaks(text, undefined, undefined, { baseline: 'bottom', dy, ...tweaks });
    return text;
  }

  setSubType(type: string, tweaks?:  { lineno?: number, color?: string }) {
    if (type) this.setType(type, tweaks);
  }

  setPriceBar(info: CardInfo2, color = 'rgb(100,100,100)') {
    const { x, y, width: w, height: h } = this.getBounds();
    const { step, stop, rent } = info;
    if (step === undefined && stop === undefined && rent === undefined) return;
    const size = this.cm.coinSize, ty = this.cm.priceBarSize;
    const cy = ty / 2, cx = this.cardw / 2 - this.cm.edge - size;
    const bar = new NamedContainer('PriceBar', 0, cy);
    bar.y = this.cm.topBand - h / 2;
    const band = new RectShape({ x, y: 0, w, h: ty }, color, '');
    const stepc = (step === undefined || step === null) ? undefined : this.makeCoin(step, size, -cx, cy);
    const stopc = (stop === undefined || stop === null) ? undefined : this.makeCoin(stop, size, 0, cy);
    const rentc = (rent === undefined || rent === null) ? undefined : this.makeCoin(rent, size, cx, cy);
    bar.addChild(band, stepc, stopc, rentc);
    this.addChild(bar);
  }

  makeCoin(value: number | string, rad = this.cm.coinSize, cx = 0, cy = 0,
    args?: { color?: string, fontn?: string, r180?: boolean, oval?: number }) {
    const def = { color: C.BLACK, fontn: this.cm.coinFont, r180: false, oval: 0 };
    const { color, fontn, r180, oval } = { ...def, ...args };
    const rv = new NamedContainer(`Coin(${value})`, cx, cy);
    const ry = (oval === 0) ? rad : rad;
    const rx = (oval === 0) ? rad : rad * oval;
    const coin = new EllipseShape(C.coinGold, rx, ry, '');
    const fontsize = Math.floor(2 * rad * .82); // 110 -> 90;
    const fontspec = this.composeFontName(fontsize, fontn);
    // value = '*';
    const val = new CenterText(`${value}`, fontspec, color); // @ (0,0)
    // vertical offset to align digits (or '*') in circle;
    const offset = this.cm.coinFontAdj + ((value === '*') ? .13 : 0);
    val.y = fontsize * offset;
    val.scaleX = this.cm.coinFontX;  // narrow/compact the font
    if (r180) val.rotation = 180;
    rv.addChild(coin, val);
    // rv.addChild(new CircleShape(C.BLUE, 5, '')); // center dot
    return rv;
  }

  /** add coin(value) at (cx, cy) */
  setCoin(value: number | string, rad = this.cm.coinSize, cx = 0, cy = 0,
    args?: { color?: string, fontn?: string, r180?: boolean, oval?: number }) {
    return this.addChild(this.makeCoin(value, rad, cx, cy, args));
  }

  /** addChild(coinObj) at return end XY; next Text starts there. */
  setTextWithCoins(line: string, tsize0: number, tfont: string, lineno: number, liney: number) {
    const frags = line.split('$');
    const xwide = this.cardw - this.cm.edge * 2 + (frags.length - 1) * tsize0 * .5; // '$n ' -> '()'
    const font0 = this.composeFontName(tsize0, tfont);
    const tsize = this.shrinkFontForWidth(xwide, line, tsize0, font0);
    const fontn = this.composeFontName(tsize, tfont);
    const linet = new Text(line, fontn);
    const lineh = linet.getMeasuredLineHeight();
    const coinr = lineh / 2;         // pixel height of font.
    const coindx = coinr * 2 + 0;        // fudge as circle replaces '$v'
    const linew = linet.getMeasuredWidth();
    const { width } = linet.getBounds()
    let linex = -linew / 2;          // full line will be centered.
    frags.forEach((frag, n) => {     // ASSERT: frag has no newline
      const dx = linex, dy = liney + lineno * lineh;
      const fragt = this.setTextTweaks(frag, tsize, tfont, { dx, dy, align: 'left' });
      linex += fragt.getMeasuredWidth();
      if (n + 1 < frags.length) {
        // prep for next frag:
        const vre = /^\d+/;
        const fragn = frags[n + 1];  // if frag has '$', then fragn starts with /^\d+/
        const val = fragn.match(vre)?.[0] ?? '?';
        frags[n + 1] = fragn.replace(vre, '');
        const coin = this.setCoin(val, coinr, linex + coinr, liney + coinr + (lineno - .5) * lineh);
        linex = linex + coindx;
      }
    })
  }

  /** set main Text on card, center each line; multiline & coin glyph. */
  setText(text: string | { key0?: string, size?: number }, y0?: number) {
    const tlines = ((typeof text === 'string') ? text : text?.key0) ?? undefined;
    if (!tlines) return;
    const tsize = (typeof text !== 'string') ? (text?.size ?? this.cm.textSize) : this.cm.textSize;
    const tfont = this.cm.textFont;
    const dy = y0 ?? -this.cardh / 2 + this.cm.topBand + this.cm.priceBarSize + tsize;
    this.setTextTweaks(tlines, tsize, tfont, { dy })
    // const lines = tlines.split('\n'); // TODO: vertical centering
    // lines.forEach((line: string, lineno: number) => {
    //   if (!line.includes('$')) {
    //     this.setTextTweaks(line, tsize, tfont, { lineno, dy });
    //   } else {
    //     this.setTextWithCoins(line, tsize, tfont, lineno, dy)
    //   }
    // })
  }

  setCost(cost: number | string) {
    if (cost === undefined || cost === null) return;
    // High Tech: { cost: "9+" }
    const rad = this.cm.coinSize, cx = - (this.cardw / 2) + this.cm.edge + rad, cy = this.cardh / 2 - this.cm.edge - rad;
    this.setCoin(cost, rad, cx, cy);
  }

  setVP(vp: number | string) {
    if (vp === undefined || vp === null) return;
    const size = this.cm.vpSize, font = this.cm.vpFont;
    const dx = this.cardw / 2 - size, dy = this.cardh / 2 - size;
    this.setTextTweaks(`${vp}`, size, font, { color: C.WHITE, dx, dy });
  }

  setCacheID() {
    if (!this.cacheID) {
      const b = this.getBounds();            // Bounds are set
      this.cache(b.x, b.y, b.width, b.height);
    } else {
      this.updateCache();
    }
  }

  setLine(liney: number, color = C.BLACK, margin = 40, thick = 5) {
    const line = new Shape();
    line.name = `line(${liney})`;
    const x0 = margin - this.cardw / 2, y = liney - this.cardh/2;
    line.graphics.ss(thick, 'round').s(color).mt(x0, y).lt(-x0, y);//
    this.addChild(line);
  }

  setExtras(extras: EXTRAS[]) {
    extras?.forEach((extra: EXTRAS) => {

      const exline: XLINE = extra.line;
      if (exline) {
        const [liney, color, margin, thick ] = exline;
        this.setLine(liney, color, margin, thick); // for Housing: complex 'textLow'
      }

      const exvp = extra.vp; // XTEXT, string, number (ignore simple string/number; done setVP())
      if (typeof exvp === 'object') {
        const [text, dx0, dy0, justify, size, fontname, color, tweaks] = exvp;
        const dx1 = (dx0 === 'center') ? this.cardw / 2 : dx0 as number;
        const dy1 = (dy0 === 'center') ? this.cardw / 2 : dx0 as number;
        const x0 = this.cardw / 2 - this.cm.vpSize, y0 = this.cardh / 2 - this.cm.vpSize;
        const dx = x0 + dx1;
        const dy = y0 + dy1;
        const font = (fontname === 'TEXTFONT') ? this.cm.vpFont : fontname;
        const align = (justify === 'LEFTJ') ? 'left' : (justify === 'RIGHTJ') ? 'right' : (justify=== 'CENTER') ? 'center' : undefined;
        this.setTextTweaks(text, size, font, { color, dx, dy, align, ...tweaks });
      }

      const extext: XTEXT = extra.text;
      if (extext) {
        const [text, dx0, dy0, justify, size, fontname, color, rest] = extext;
        const top = this.cm.topBand + this.cm.priceBarSize;
        const dx1 = (dx0 === 'center') ? this.cardw / 2 : dx0 as number;
        const dy1 = (dy0 === 'center') ? this.cardh / 2 : (dy0 === 'top') ? top : dy0 as number;
        const dx = ((dx1 < 0) ? dx1 + this.cardw : dx1) - this.cardw / 2;
        const dy = dy1 - this.cardh / 2;
        const fname = (fontname === 'TEXTFONT') ? this.cm.textFont : fontname;
        const align = (justify === 'LEFTJ') ? 'left' : (justify === 'RIGHTJ') ? 'right' : (justify=== 'CENTER') ? 'center' : undefined;
        const fsize = (size) ? size : this.cm.textSize;
        this.setTextTweaks(text, fsize, fname, { color, dx, dy, align, ...rest });
      }

      const textLow = extra.textLow;
      if (textLow) {
        const xwide = this.cardw - (2 * this.cm.edge), thick = 5;
        const [text, ...tweaks_ary] = (typeof textLow === 'string') ? [textLow] : textLow;
        const tweaks = mergeObjectArray(tweaks_ary);
        const size0 = tweaks.size ?? this.cm.textSize, font0 = this.cm.textFont, lead = size0 / 4;
        const text0 = this.makeText(text, size0, font0, tweaks.color ?? C.BLACK, xwide);
        const fontn = text0.font;
        const lineh = text0.lineHeight = (tweaks.nlh ?? text0.getMeasuredLineHeight());
        const height = text0.getMeasuredHeight(); // multi-line...
        const liney = this.cardh - this.cm.bottomBand - height - lead - lead - thick / 2;
        const texty = liney + thick / 2 + lead  + lineh / 2 - this.cardh / 2;
        this.setLine(liney, undefined, undefined, thick);
        tweaks.dy = texty;
        this.setTextTweaks(text0, undefined, fontn, tweaks);
      }
      const coin = extra.coin;
      if (coin) {
        const gap = this.cardh * .013;
        const top = this.cm.topBand + this.cm.priceBarSize + gap;
        const bot = this.cm.bottomBand + gap;
        const rady = (this.cardh - top - bot) / 2, cx = 0, cy = top + rady - this.cardh / 2;
        const oval = .8;
        this.setCoin(coin, rady, cx, cy, { oval });
      }

      this.setImage(extra.image);
    })
  }

  setImage(eximage: XIMAGE) {
    if ((eximage || eximage === null) && this.ximage) {
      const ximage = this.ximage;
      /** x-coord to center item of width between left & right */
      const center = (l: number, r: number, w: number) => l + (r - l - w) / 2;
      // const { x: rx, y: ry, width: rw, height: rh } = this.getBounds();
      const [name, x, y, w, h] = eximage ?? [];
      const cw = this.cardw, iw = ximage.width, mar = this.cm.edge;
      const ch = this.cardh, ih = ximage.height;
      const cl = mar - cw / 2, cr = cw / 2 - mar;
      const ct = (this.cm.topBand + this.cm.priceBarSize - ch / 2);
      const cb = ch / 2 - this.cm.bottomBand
      const normalx = (x) => x === 'left' ? cl : x === 'right' ? cr : x === 'center' ? 0 : x;
      const normaly = (y) => y === 'top' ? ct : y === 'bot' ? cb : y === 'center' ? 0 : y;
      // Assert: this.ximage is loaded.
      const bm = new Bitmap(ximage);
      // Analyse x, y, w, h to set bm.x, scaleX; bm.y, scaleY
      // Initialize as suitable for x, y === 'center' or x === 'card':
      let bmx = (typeof x === 'number') ? x : center(cl, cr, iw);
      let bmy = ((typeof y === 'number') ? y - ch/2 : center(ct, cb, ih));
      let scalex = (typeof w === 'number') ? w / iw : 1;
      let scaley = (typeof h === 'number') ? h / ih : 1;

      if (x === 'card') {
        bmx = - cw / 2;
        bmy = - ch / 2;
      }
      // 'fit' to white region: x-margin, y-top/bottom
      if (x === 'fit') {
        bmx = cl;
        scalex = (cr - cl) / iw;
      }
      if (y === 'fit') {
        bmy = ct;    // TODO: shrink to fit with text & textLow
        scaley = (cb - ct) / ih;
      } else if (y === 'top') {
        bmy = ct;
      }
      if (h === 'xs') {
        scaley = scalex;
      }
      bm.x = bmx;
      bm.y = bmy;
      bm.scaleX = scalex;
      bm.scaleY = scaley;
      this.addChild(bm);
      // const spot = new CircleShape(C.BLUE, 30);
      // spot.paint();
      // this.addChild(spot);
      return;
    }
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
class CI_Back extends CI {
  override setPriceBar(info: CardInfo2, color?: string): void {  }
  override setCost(cost: string | number): void {}
}
class CI_Token extends CI {

  override setWidthHeight(cardInfo?: CardInfo, cm?: CardMaker): void {
    this.cardw = this.cardh = cm.circle_image_size;
  }
  override makeMaskCanvas(bleed?: number, r?: number, scale?: number): void {
    super.makeMaskCanvas(bleed, this.cm.circle_image_size / 2, scale);
  }
  override setTitle(name: string): CenterText {
    return undefined;
  }

  override setType(type: string, tweaks?: TWEAKS) {
    return undefined as CenterText;
  }

  override setPriceBar(info: CardInfo2, color?: string): void {  }

  override setCost(cost: string | number): void {
    if (cost === null) return;
    this.setTextTweaks(`${cost}`, this.cardw/2, this.cm.fontFam);

  }
  override setVP(vp: number | string) {
    if (vp === undefined || vp === null) return;
    const size = this.cm.vpSize / 2, font = this.cm.vpFont;
    const dx = this.cardw / 2 - size, dy = this.cardh / 2 - size;
    this.setTextTweaks(`${vp}`, size, font, { color: C.WHITE, dx, dy });
  }

}

/** holds all the context; use a factory to make a Card (or CardImage?) based on supplied CardInfo */
export class CardMaker {
  constructor(public gridSpec: GridSpec = ImageGrid.cardSingle_1_75, public scale = 1) {
    const mBleed = 2 * (this.withBleed ? 0 : gridSpec.bleed);
    this.cardw = gridSpec.cardw - mBleed; // 800, includes bleed
    this.cardh = gridSpec.cardh - mBleed;
    this.radi = (gridSpec.radi ?? this.radi) + (this.withBleed ? gridSpec.bleed : 0);     // corner radius
    this.safe = (gridSpec.safe ?? this.safe);     // text/image safe edge
  }

  nbsp = `${'\u00A0'}`;    // unicode NBSP
  transitColor = 'rgb(180,180,180)';    // very light grey
  comTransitColor = 'rgb(180,120,80)';  // Brown/Grey

  circle_image_size = 125;
  square_image_size = 115;

  readonly withBleed = false;
  get bleed() { return this.withBleed ? this.gridSpec.bleed : 0; }
  get edge() { return this.gridSpec.safe + this.bleed };
  get topBand() { return 115 + this.bleed; }
  get bottomBand() { return 130 + this.bleed; }

  sfFont = 'SF Compact Rounded';
  nunito = 'Nunito';                      // Nunito is variable weight, but less compact
  fontFam = this.nunito;                  // also change in style.css to preload
  textFont = `${this.fontFam} 400`;
  titleFont = `${this.fontFam} 600`;      // Medium font-weight: sfFont: 557
  typeFont = `${this.fontFam} 557`;
  vpFont = `${this.fontFam} 659`;
  dirFont = `${this.fontFam} 659`; // Semibold font-weight: 659
  coinFont = `${this.fontFam} 557`;
  coinFontX = .85;
  coinFontAdj = .11; // SFCR: .05, Nunito: .11

  titleSize = 60;
  textSize = 50;
  typeSize = 40;
  /** radius of Coin */coinSize = 45;
  priceBarSize = 2 * (this.coinSize + 5);
  vpSize = 70;
  dirSize = 400; // font size! (and then shrink-to-fit)

  // GridSpec.dpi can do card-scale...? just use: Container.scale for in-app sizing.
  cardw = 750; // 800 with bleed
  cardh = 525; // 575 with bleed
  safe = 25;
  radi = 37;   // (1/8 inch)

  fileDir = 'citymap';
  ci: CI;

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
        return new CI_Back(this, info);
      default:
        return new CI(this,info);
    }
  }
}
