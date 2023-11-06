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
    return new Promise((res, rej) => {
      const img: HTMLImageElement = new Image();
      img.onload = (evt => res(img));
      img.onerror = ((err) => rej(`failed to load ${url} -> ${err}`));
      img.src = url; // start loading
    });
  }

  /**
   * load all imageUrls, then invoke callback(images: HTMLImageElement[])
   * @param imageUrls
   * @param cb
   */
  loadImages(fnames: string[], cb: (images: HTMLImageElement[]) => void) {
    let promises = fnames.map(fname => this.loadImage(fname));
    Promise.all(promises).then((values) => cb(values), (reason) => {
      console.error(stime(this, `.loadImages:`), reason);
    })
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
    imap = new Map<string, HTMLImageElement>(),
    cb?: (imap: Map<string, HTMLImageElement>) => void)
  {
    this.root = args.root;
    this.fnames = args.fnames;
    this.ext = args.ext;
    const { fnames } = args;
    this.loadImages(fnames, (images: HTMLImageElement[]) => {
      fnames.forEach((fn, n) => {
        images[n][S.Aname] = fn;
        imap.set(fn, images[n])
      })
      if (cb) cb(imap)
    })
  }
  readonly root: string;
  readonly fnames: string[];
  readonly ext: string;
}
