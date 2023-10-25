import { stime } from '@thegraid/common-lib';
// if using ctx = require.context(dir, true, /\.png$/); ctx.keys().forEach(ctx)
// also need module.d.ts: declare module "*.png";
// const dir = 'src/assets/main/images/cards'
//const ctx = require.context('src/assets/main/images/cards', true, /\.png$/, 'eager');
//const keys = ctx.keys()
// ctx.keys().forEach(ctx)

/** simple async image loader [from ImageReveal.loadImage()] */
export function loadImage(url: string): Promise<HTMLImageElement> {
  //console.log(stime(`image-loader: try loadImage`), url)
  return new Promise((res, rej) => {
    const img: HTMLImageElement = new Image();
    img.onload = (evt => res(img));
    img.onerror = ((err) => rej(`failed to load ${url} -> ${err}`));
    img.src = url; // start loading
  });
}

