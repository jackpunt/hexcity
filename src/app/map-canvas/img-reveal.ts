// handle terImage info, and reveal terrain on map-canvas
import { ImagePixels } from './image-pixels';

/** MapCanvasComponent implements Revealer */
export interface Revealer {
    reveal_cell_on_map(y:number, x:number, rgba:number, zval:number, tvid:number):void;
    reveal_pixel_on_map(y: number, x: number, rgba: number):void;
    reveal_update():void;
}

/** Handle TerImageSeq & RevealSeq, get Image and put on map Image */
export class ImgReveal {
    /** Handle TerImageSeq & RevealSeq */
    constructor(private revealer: Revealer) {}

    /** @return Promise\<HTMLImageElement> containing image from URL. */
    static loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((res, rej) => {
            const img: HTMLImageElement = new Image();
            img.onload = (evt => {res(img)});
            img.onerror= (() => rej("failed to load "+url));
            img.src = url; // start loading
        });
    }
}

