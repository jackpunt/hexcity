import { Deck } from '../card'
import { C } from '../basic-intfs'
/** This class and file are auto-generated do not edit. */
export class TestDeck {
   static deck: Deck = {
      name: 'TestDeck',
      cards: [
        {nreps: 1, type: "Industrial", name: "High Tech", cost: "9+", step: 2, stop: 0, rent: 0, vp: 1, subtype: "Internet Ads", ext: "High Tech", props: {stop: 3, rent: 2, cost: 9, cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ], valueToken: 0, valueTokenCounter: {counter: [ "Value", 93, -20 ]}, stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}, onStep: {valueToken: {add: 1, max: 6}, rent: {set: 2, add: "valueToken"}, stop: {set: 3, add2: "valueToken"}}, onBuild: {costAdjust: {add: 2, filter: {name: "High Tech"}}, buildAdjust: {add: 2, filter: {name: "High Tech"}}, rentAdjust: {add: 2, filter: {type: [ "Commercial", "Residential" ], range: 2}}}}, path: "High-Tech-Internet-Ads.png"},
        {nreps: 12, type: "house", name: "House", cost: 2, step: 0, stop: 0, rent: 0.5, vp: 1, subtype: null, props: {rgbColor: "rgb(21,180,0)", noStop: true}, path: "House.png"},
        {nreps: 2, type: "Deferred", name: "Demolition", cost: null, subtype: null, ext: "Event", props: {event: {doUrbanRenewal: 2}}, path: "Demolition.png"},
        {nreps: 1, type: "Residential", name: "Home-RED", cost: 0, step: 1, stop: 0, rent: 1, vp: null, subtype: "Home", props: {rgbColor: "rgb(239,32,60)"}, path: "Home-RED.png"},
        {nreps: 1, type: "Road", name: "Merge Lt L   ", cost: 3, subtype: "Transit", props: {cardFields: "roadSpec", roadSpec: {set: [ "R", "S", "L", "L" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}}, path: "Merge-Lt-L---.png"},
        {nreps: 1, type: "Back", name: "Test Back", cost: 262.0, step: 375.0, path: "Test-Back.png"},
   ]
  }}
