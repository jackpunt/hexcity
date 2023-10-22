// retain access to the pixels obtained from an image
//import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from "@angular/common";
import { Inject } from '@angular/core';


//@Injectable()
export class ImagePixels {
    image: HTMLImageElement;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    width: number;
    height: number;
    imageData: ImageData;
    rgbaData: Uint32Array;

    // would be nice if we did not need the "document" object.
    /** put image on a canvas of document; extract to rgba array of pixels. */
    constructor(image: HTMLImageElement) {
        this.image = image;
        this.canvas = document.createElement('canvas'); // (image.ownerDocument || document)
        this.canvas.width = image.width;
        this.canvas.height = image.height;
        this.context = this.canvas.getContext('2d');
        this.width = image.width;
        this.height = image.height;
        this.context.drawImage(image, 0, 0);
        this.imageData=this.context.getImageData(0,0,this.width, this.height);
        this.rgbaData = new Uint32Array(this.imageData.data.buffer);
    }
    getPixel(x: number, y: number): number {
        return this.rgbaData[x + y*this.width];
    }
    setPixel(x: number, y: number, rgba: number) {
        this.rgbaData[x + y*this.width] = rgba;
    }
    setRectangle(x0: number, y0: number, width: number, height: number, rgba: number) {
        for (let y=y0; y<y0+height; y++) {
            for (let x=x0; x<x0+width; x++) {
                this.setPixel(x, y, rgba);
            }
        }
    }
    /**
     * putImageData on this image canvas context.
     * reset image.src to canvas.toDataURL()
     */
    update_image() {
        this.context.putImageData(this.imageData, 0, 0);
        this.image.src = this.canvas.toDataURL();
        //console.log(stime(this, ".update_image: toDataURL()="), this.image.src);
    }

    /** create an [empty] Image with ImagePixels */
    static create_image(width: number, height: number, rgba?:number): ImagePixels {
        let image = new Image(width, height);
        let imgr: ImagePixels = new ImagePixels(image);
        if (rgba && rgba != 0) {
            imgr.setRectangle(0,0,width,height,rgba);
            imgr.update_image();
        }
        return imgr;
    }
}