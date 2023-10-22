import * as createjs from '@thegraid/easeljs-module';
//import  createjs  from 'createjs-cmd';
//import createjs from 'yuki-createjs';

export class CircleDrawTest {
    constructor() { }

    //show_circle({stage = this.stage, x = 0 , y=0, r=75, color="DeepSkyBlue"}) {
    static add_circle(parent: createjs.Container, layout?: {x?:number, y?:number, color?:string, r?:number},
        index?: number) {
        let {x=0 , y=0, r=75, color="DeepSkyBlue"} = layout;
        console.log("show_circle:", "layout=", layout, "index=", index,"parent=", parent);
        let circle = new createjs.Shape();
        circle.graphics.beginFill(color).drawCircle(0, 0, r);
        circle.x = x;
        circle.y = y;
        if (!parent) {
            console.log("show_circle: No parent, return");
            return;
        }
        if (index == undefined) {
            parent.addChild(circle);
        } else {
            parent.addChildAt(circle, index);
        }
        return circle;
    }
}
