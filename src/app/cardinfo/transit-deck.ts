import { Deck } from '../card'
import { C } from '../basic-intfs'
/** This class and file are auto-generated do not edit. */
export class TransitDeck {
   static deck: Deck = {
      name: 'TransitDeck',
      cards: [
        {nreps: 4, type: "Municipal", name: "Bus Stop", cost: 4, step: 0, stop: 0, rent: 1, vp: null, subtype: "Transit", ext: "Transit", props: {stop: 1, onStep: {when: {fromTransit: "Bus Stop", dist: {set: 1}}, else: {dist: {add: -1}}}, onStop: {transitTo: {subtype: [ "Transit", "Com-Transit" ], dist: 0, roads: true}}}, text: "-1 Distance\n\n*Move to next Transit\nor Com-Transit.\nIf that is Bus Stop:\nDistance = 1", path: "Bus-Stop.png"},
        {nreps: 4, type: "Municipal", name: "Train Station", cost: 5, step: -1, stop: 0, rent: 1, vp: null, subtype: "Transit", ext: "Transit", props: {stop: 1, onStop: {when: {chooseDir: {N: 0, S: 0, E: 0, W: 0}, transitTo: {name: "Train Station"}}}}, text: "*Go to next\nTrain Station\nin chosen Direction.\nDistance = 1", path: "Train-Station.png"},
        {nreps: 4, type: "Commercial", name: "Transit Hub", cost: 6, step: -1, stop: 1, rent: 1, vp: 1, subtype: "Com-Transit", ext: "Transit", props: {onStep: {dist: {add: -1}}, onStop: {when: {chooseDir: 3, payOwner: 3, temp: {set: "moveNextDistance"}}}, onBuild: {buildAdjust: {add: -2, filter: {range: 1, onCard: true, subtype: [ "Transit" ]}}}}, text: "-1 Distance\n*May pay $3 to Move\nnext Distance\nin chosen Direction.", path: "Transit-Hub.png"},
        {nreps: 4, type: "Commercial", name: "Taxi", cost: 6, step: -1, stop: 0, rent: 0, vp: null, subtype: "Com-Transit", ext: "Transit", props: {noStop: true, onStep: {dist: {set: "nextDistance"}, payOwner: {set: "dist"}}}, text: "Use Next Distance\nPay $1 per Distance\nand continue to Move.", path: "Taxi.png"},
        {nreps: 4, type: "Municipal", name: "Airport", cost: 8, step: 0, stop: 0, rent: 1, vp: "*", subtype: "Transit", ext: "Transit", props: {cardFields: "nthAirportVP", nthAirportVP: {set: [ 0, 5, 3, 1, 0, 0 ]}, noStop: true, vp: {set: "nthAirportVP"}, onStep: {when: {ne: {arrivalFrom: "Airport"}, arrivalFrom: {set: "Airport"}, temp: {set: "rangeToAirport"}, payOwner: {set: "temp", add: "rentAdjust"}, transitTo: {name: "Airport"}}, else: {payOwner: {set: "temp", add: "rentAdjust"}, arrivalFrom: {set: "undefined"}}}}, text: ["Go to next Airport.\nDistance = 1\n\n*To each Airport\npay $1 + $1 per range\nto destination.", {size: 45}], path: "Airport.png"},
   ]
  }}
