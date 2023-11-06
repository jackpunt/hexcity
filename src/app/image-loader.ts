import { S, stime } from "@thegraid/common-lib";

/** Simple async Image loader [from ImageReveal.loadImage()]
 *
 * see also: createjs.ImageLoader, which we don't use.
 */
export class ImageLoader {
  /**
   * Promise to load url as HTMLImageElement
   */
  loadImage(fname: string, ext = this.ext): Promise<HTMLImageElement> {
    const { root } = this;
    const url = `${root}${fname}.${ext}`;
    //console.log(stime(`image-loader: try loadImage`), url)
    return new Promise<HTMLImageElement>((res, rej) => {
      const img: HTMLImageElement = new Image();
      img.onload = (evt => res(img));
      img.onerror = ((err) => rej(`failed to load ${url} -> ${err}`));
      img.src = url; // start loading
    });
  }

  /**
   * load all fnames, return Promise.all()
   * @param fnames
   */
  loadImages(fnames = this.fnames, ext = this.ext) {
    let promises = fnames.map(fname => this.loadImage(fname, ext));
    return Promise.all(promises).then(
      (images: HTMLImageElement[]) => {
        fnames.forEach((filename, n) => {
          images[n][S.Aname] = filename;
          this.imap.set(filename, images[n])
        })
        return this.imap;
      }, (reason) => {
        console.error(stime(this, `loadImages failed: ${reason}`));
        return this.imap;
      });
  }

  /**
   *
   * @param args -
   * - root: path to image directory with trailing '/'
   * - fnames: string[] basenames of each image to load
   * - ext: file extension (for ex: 'png' or 'jpg')
   *
   * @param imap supply or create new Map()
   * @param cb invoked with (imap)
   */
  constructor(args: { root: string, fnames: string[], ext: string },
    public imap = new Map<string, HTMLImageElement>(),
    cb?: (imap: Map<string, HTMLImageElement>) => void)
  {
    this.root = args.root;
    this.fnames = args.fnames;
    this.ext = args.ext;
    if (cb) {
      this.loadImages().then(imap => cb(imap));
    }
  }
  readonly root: string;
  readonly fnames: string[];
  readonly ext: string;
}
