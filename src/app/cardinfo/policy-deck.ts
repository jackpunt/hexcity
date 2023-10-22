import { Deck } from '../card'
import { C } from '../basic-intfs'
/** This class and file are auto-generated do not edit. */
export class PolicyDeck {
   static deck: Deck = {
      name: 'PolicyDeck',
      cards: [
        {nreps: 2, type: "Policy", name: "Increase Distance", cost: 3, step: 2, subtype: null, ext: "Policy", props: {onMove: {dist: {add: 1}}}, path: "Increase-Distance-Policy.png"},
        {nreps: 2, type: "Policy", name: "Adjust Distance 1", cost: 4, step: 3, subtype: null, ext: "Policy", props: {onBuild: {distAdjust: {distChoice: {high: 1, low: -1}}}}, path: "Adjust-Distance-1-Policy.png"},
        {nreps: 2, type: "Policy", name: "Adjust Distance 2", cost: 5, step: 3, subtype: null, ext: "Policy", props: {onBuild: {distAdjust: {distChoice: {high: 2, low: -1}}}}, path: "Adjust-Distance-2-Policy.png"},
        {nreps: 2, type: "Policy", name: "Buy More", cost: 5, step: 3, subtype: null, ext: "Policy", props: {buys: {add: 1}, onTurnStart: {buys: {add: 1}}}, path: "Buy-More-Policy.png"},
        {nreps: 2, type: "Policy", name: "Build More", cost: 4, step: 3, subtype: null, ext: "Policy", props: {builds: {add: 1}, onTurnStart: {builds: {add: 1}}}, path: "Build-More-Policy.png"},
        {nreps: 2, type: "Policy", name: "Build Farther", cost: null, step: 2, subtype: null, ext: "Policy", props: {onBuild: {rangeAdjust: {add: 1}}}, path: "Build-Farther-Policy.png"},
        {nreps: 2, type: "Policy", name: "Build Nearer", cost: null, step: 2, subtype: null, ext: "Policy", props: {onBuild: {rangeAdjust: {add: -1, min: 1}}}, path: "Build-Nearer-Policy.png"},
        {nreps: 2, type: "Policy", name: "Fuel Rationing", cost: null, step: 2, subtype: null, ext: "Policy", props: {onMove: {dist: {add: -1, min: 1}}}, path: "Fuel-Rationing-Policy.png"},
        {nreps: 2, type: "Policy", name: "Draw Another", cost: 4, step: 3, subtype: null, ext: "Policy", props: {onBuild: {coins: {add: -1}, drawNAdjust: {add: 1}}}, path: "Draw-Another-Policy.png"},
        {nreps: 2, type: "Policy", name: "Draw Again", cost: 4, step: 3, subtype: null, ext: "Policy", props: {onTurnStart: {coins: {add: -1}, draws: {add: 1}}}, path: "Draw-Again-Policy.png"},
        {nreps: 2, type: "Policy", name: "Move Again", cost: 4, step: 2, subtype: null, ext: "Policy", props: {onTurnStart: {coins: {add: -1}, moves: {add: 1}}}, path: "Move-Again-Policy.png"},
        {nreps: 2, type: "Policy", name: "Flexible Itenerary", cost: 3, step: 2, subtype: null, ext: "Policy", props: {onGetDist: {when: {offerChoice: "Flip second dist?", dist: {set: "nextDistance"}}}}, path: "Flexible-Itenerary-Policy.png"},
        {nreps: 2, type: "Policy", name: "Road Repair", cost: null, step: 2, subtype: null, ext: "Dir", props: {onBuild: {blockedDirAdjust: {include: [ "N" ]}}}, path: "Road-Repair-N-Policy.png"},
        {nreps: 2, type: "Policy", name: "Road Repair", cost: null, step: 2, subtype: null, ext: "Dir", props: {onBuild: {blockedDirAdjust: {include: [ "E" ]}}}, path: "Road-Repair-E-Policy.png"},
        {nreps: 2, type: "Policy", name: "Road Repair", cost: null, step: 2, subtype: null, ext: "Dir", props: {onBuild: {blockedDirAdjust: {include: [ "S" ]}}}, path: "Road-Repair-S-Policy.png"},
        {nreps: 2, type: "Policy", name: "Road Repair", cost: null, step: 2, subtype: null, ext: "Dir", props: {onBuild: {blockedDirAdjust: {include: [ "W" ]}}}, path: "Road-Repair-W-Policy.png"},
        {nreps: 2, type: "Policy", name: "Discount to Build", cost: null, step: 1, subtype: null, ext: "Policy", props: {onBuild: {buildAdjust: {add: -1, min: 1}}}, path: "Discount-to-Build-Policy.png"},
        {nreps: 2, type: "Policy", name: "Bail Bond", cost: null, step: 1, subtype: null, ext: "Policy", props: {special: {suppressCard: "Jail"}}, path: "Bail-Bond-Policy.png"},
        {nreps: 2, type: "Policy", name: "Overtime Penalty", cost: null, step: 1, subtype: null, ext: "Policy", props: {onStop: {when: {gt: {distMoved: 4}, coins: {add: -2}, moves: {add: -1}}}}, path: "Overtime-Penalty-Policy.png"},
        {nreps: 2, type: "Policy", name: "Overtime Bonus", cost: null, step: 1, subtype: null, ext: "Policy", props: {onStop: {when: {gt: {distMoved: 4}, coins: {add: 2}}}}, path: "Overtime-Bonus-Policy.png"},
        {nreps: 2, type: "Policy", name: "Speed Limit", cost: null, step: 1, subtype: null, ext: "Policy", props: {onMove: {dist: {max: 4}}}, path: "Speed-Limit-Policy.png"},
        {nreps: 2, type: "Policy", name: "Minimum Wage", cost: 2, step: 2, subtype: null, ext: "Policy", props: {onBuild: {stopAdjust: {min: 2}}}, path: "Minimum-Wage-Policy.png"},
        {nreps: 2, type: "Policy", name: "Labor Shortage", cost: 3, step: 2, subtype: null, ext: "Policy", props: {onBuild: {stopAdjust: {add: 2}}}, path: "Labor-Shortage-Policy.png"},
        {nreps: 2, type: "Policy", name: "Urban Renewal", cost: 4, step: 3, subtype: null, ext: "Policy", props: {special: {doUrbanRenewal: 2}}, path: "Urban-Renewal-Policy.png"},
        {nreps: 2, type: "Policy", name: "Zoning: No Houses", cost: null, step: 2, subtype: null, ext: "Policy", props: {special: {configBuy: "NoHouse"}}, path: "Zoning:-No-Houses-Policy.png"},
        {nreps: 2, type: "Policy", name: "Zoning: Only Houses", cost: null, step: 2, subtype: null, ext: "Policy", props: {special: {configBuy: "OnlyHouse"}}, path: "Zoning:-Only-Houses-Policy.png"},
        {nreps: 1, type: "Policy", name: "Price of Power", cost: 3, step: 1, subtype: null, ext: "Policy", props: {onTurnStart: {withPlayer: {high_total_cash: {coins: {add: -1}}}}}, path: "Price-of-Power-cash-Policy.png"},
        {nreps: 1, type: "Policy", name: "Price of Power", cost: 4, step: 2, subtype: null, ext: "Policy", props: {onTurnStart: {withPlayer: {high_total_cost: {coins: {add: -2}}}}}, path: "Price-of-Power-property-Policy.png"},
        {nreps: 1, type: "Policy", name: "Price of Power", cost: 5, step: 3, subtype: null, ext: "Policy", props: {onTurnStart: {withPlayer: {high_total_rent: {coins: {add: -3}}}}}, path: "Price-of-Power-rent-Policy.png"},
        {nreps: 2, type: "Temp Policy", name: "Boom Times", cost: null, step: 1, subtype: null, ext: "Policy", props: {buys: {add: 1}, onBuild: {buildAdjust: {add: -2, min: 1}}, cardFields: [ "turnToken", "turnTokenCounter" ], turnToken: 3, turnTokenCounter: {counter: [ "turns left" ]}, onTurnStart: {turnToken: {add: -1, filter: {isOwner: true}}, when: {le: {turnToken: 0}, discard: true}}}, path: "Boom-Times.png"},
        {nreps: 2, type: "Temp Policy", name: "Fuel Shortage", cost: null, step: 2, subtype: null, ext: "Policy", props: {onMove: {dist: {add: -1, min: 1}}, cardFields: [ "turnToken", "turnTokenCounter" ], turnToken: 3, turnTokenCounter: {counter: [ "turns left" ]}, onTurnStart: {turnToken: {add: -1, filter: {isOwner: true}}, when: {le: {turnToken: 0}, discard: true}}}, path: "Fuel-Shortage.png"},
        {nreps: 2, type: "Temp Policy", name: "Road Repair", cost: null, step: 2, subtype: null, ext: "Dir", props: {onMove: {blockedDirAdjust: {include: [ "E", "W" ]}}, cardFields: [ "turnToken", "turnTokenCounter" ], turnToken: 3, turnTokenCounter: {counter: [ "turns left" ]}, onTurnStart: {turnToken: {add: -1, filter: {isOwner: true}}, when: {le: {turnToken: 0}, discard: true}}}, path: "Road-Repair.png"},
        {nreps: 2, type: "Temp Policy", name: "Road Repair", cost: null, step: 2, subtype: null, ext: "Dir", props: {onMove: {blockedDirAdjust: {include: [ "N", "S" ]}}, cardFields: [ "turnToken", "turnTokenCounter" ], turnToken: 3, turnTokenCounter: {counter: [ "turns left" ]}, onTurnStart: {turnToken: {add: -1, filter: {isOwner: true}}, when: {le: {turnToken: 0}, discard: true}}}, path: "Road-Repair.png"},
   ]
  }}
