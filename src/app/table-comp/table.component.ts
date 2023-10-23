import { AfterViewInit, Component, Input, OnInit } from '@angular/core';
import { Router, ActivatedRoute, Params, ParamMap } from '@angular/router';
import { GameSetup } from '../game-setup';
import { stime } from '@thegraid/common-lib';
import { TP } from '../table-params';


@Component({
  selector: 'app-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.css']
})
/**
 * a canvas (stage) onto which we drop Card (Bitmap) objects.
 * constrained to a grid.
 * recording the CardID in a NxM matrix.
 * @param mapCanvasId HTML element ID of the Canvas to be used.
 */
export class TableComponent implements OnInit, AfterViewInit {
  static idnum: number = 0;
  getId(): string {
    return "T" + (TableComponent.idnum = TableComponent.idnum + 1);
  };
  /**
   * Names of extensions to be removed: ext=Transit,Roads
   *
   * Someday, these should auto-extract from the URL;
   * for now: using URLSearchParams explicitly
   */
  @Input('ext')
  ext: string = '';
  /** name of game host (game7) */
  @Input('ghost')
  ghost: string = '';

  @Input('width')
  width = 1200.0;   // [pixels] size of "Viewport" of the canvas / Stage
  @Input('height')
  height = 600.0;   // [pixels] size of "Viewport" of the canvas / Stage

  /** Auto-injected into the HTML \<canvas/> element [width & height] in table.component.html */
  mapCanvasId = "mapCanvas" + this.getId(); // argument to new Stage(this.canvasId)

  constructor(private activatedRoute: ActivatedRoute) {}
  ngOnInit() {
    console.log(stime(this, ".noOnInit---"))
    let x = this.activatedRoute.params.subscribe(params => {
      console.log(stime(this, ".ngOnInit: params="), params)
    })
    let y = this.activatedRoute.queryParams.subscribe(params => {
      console.log(stime(this, ".ngOnInit: queryParams="), params)
      this.ext = params['ext'];
      console.log(stime(this, ".ngOnInit: ext="), this.ext);
    });
  }

  ngAfterViewInit() {
    setTimeout(()=>this.ngAfterViewInit2(), 250) //https://bugs.chromium.org/p/chromium/issues/detail?id=1229541
  }
  ngAfterViewInit2() {
    let href: string = document.location.href;
    console.log(stime(this, ".ngAfterViewInit---"), href, "ext=", this.ext)
    if (href.endsWith("startup")) { 

    }
    const urlParams = new URLSearchParams(window.location.search);
    let ghost = urlParams.get('ghost')
    let extstr = urlParams.get('ext')
    let ext = !!extstr ? extstr.split(',') : []
    let mktstr = urlParams.get('mkt')
    if (!!mktstr) {
      TP.marketTileNames = mktstr.split(',')  // set TableParams
    }

    new GameSetup(this.mapCanvasId, ghost).startup(true, undefined, ext) // load images; new GameSetup
  }
}
