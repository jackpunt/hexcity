import { Deck } from '../card'
import { C } from '../basic-intfs'
/** This class and file are auto-generated do not edit. */
export class PolicyDeck {
   static deck: Deck = {
      name: 'PolicyDeck',
      cards: [
        {nreps: 2, type: "Policy", name: "Increase Distance", color: "rgb(255,255,0)", cost: 3, step: 2, subtype: null, ext: "Policy", props: {onMove: {dist: {add: 1}}}, text: "+1 Distance on each Move", textLow: null, extras: [ {ext: "Policy"}, {step: 2}, {step: 2}, {cardProps: {onMove: {dist: {add: 1}}}} ], path: "Increase-Distance-Policy.png"},
        {nreps: 2, type: "Policy", name: "Adjust Distance 1", color: "rgb(255,255,0)", cost: 4, step: 3, subtype: null, ext: "Policy", props: {onBuild: {distAdjust: {distChoice: [ {high: 1}, {low: -1} ]}}}, text: "+1 Distance\nor\n-1 Distance", textLow: "Not less than 1.", extras: [ {ext: "Policy"}, {step: 3}, {step: 3}, {cardProps: {onBuild: {distAdjust: {distChoice: {key0 : [ {high: 1}, {low: -1} ]}}}}} ], path: "Adjust-Distance-1-Policy.png"},
        {nreps: 2, type: "Policy", name: "Adjust Distance 2", color: "rgb(255,255,0)", cost: 5, step: 3, subtype: null, ext: "Policy", props: {onBuild: {distAdjust: {distChoice: [ {high: 2}, {low: -1} ]}}}, text: "+2 Distance\nor\n-2 Distance", textLow: "Not less than 1.", extras: [ {ext: "Policy"}, {step: 3}, {step: 3}, {cardProps: {onBuild: {distAdjust: {distChoice: {key0 : [ {high: 2}, {low: -1} ]}}}}} ], path: "Adjust-Distance-2-Policy.png"},
        {nreps: 2, type: "Policy", name: "Buy More", color: "rgb(255,255,0)", cost: 5, step: 3, subtype: null, ext: "Policy", props: {buys: {add: 1}, onTurnStart: {buys: {add: 1}}}, text: "+1 Buy each turn.", textLow: null, extras: [ {ext: "Policy"}, {step: 3}, {step: 3}, {cardProps: [ {buys: {add: 1}}, {onTurnStart: {buys: {add: 1}}} ]} ], path: "Buy-More-Policy.png"},
        {nreps: 2, type: "Policy", name: "Build More", color: "rgb(255,255,0)", cost: 4, step: 3, subtype: null, ext: "Policy", props: {builds: {add: 1}, onTurnStart: {builds: {add: 1}}}, text: "+1 Build each turn.", textLow: null, extras: [ {ext: "Policy"}, {step: 3}, {step: 3}, {cardProps: [ {builds: {add: 1}}, {onTurnStart: {builds: {add: 1}}} ]} ], path: "Build-More-Policy.png"},
        {nreps: 2, type: "Policy", name: "Build Farther", color: "rgb(255,255,0)", cost: null, step: 2, subtype: null, ext: "Policy", props: {onBuild: {rangeAdjust: {add: 1}}}, text: "+1 Range of Action", textLow: null, extras: [ {ext: "Policy"}, {step: 2}, {step: 2}, {cardProps: {onBuild: {rangeAdjust: {add: 1}}}} ], path: "Build-Farther-Policy.png"},
        {nreps: 2, type: "Policy", name: "Build Nearer", color: "rgb(255,255,0)", cost: null, step: 2, subtype: null, ext: "Policy", props: {onBuild: {rangeAdjust: [ {add: -1}, {min: 1} ]}}, text: "-1 Range of Action", textLow: "Not less than 1.", extras: [ {ext: "Policy"}, {step: 2}, {step: 2}, {cardProps: {onBuild: {rangeAdjust: {key0 : [ {add: -1}, {min: 1} ]}}}} ], path: "Build-Nearer-Policy.png"},
        {nreps: 2, type: "Policy", name: "Fuel Rationing", color: "rgb(255,255,0)", cost: null, step: 2, subtype: null, ext: "Policy", props: {onMove: {dist: [ {add: -1}, {min: 1} ]}}, text: "-1 Distance on each Move", textLow: "Not less than 1.", extras: [ {ext: "Policy"}, {step: 2}, {step: 2}, {cardProps: {onMove: {dist: {key0 : [ {add: -1}, {min: 1} ]}}}} ], path: "Fuel-Rationing-Policy.png"},
        {nreps: 2, type: "Policy", name: "Draw Another", color: "rgb(255,255,0)", cost: 4, step: 3, subtype: null, ext: "Policy", props: {onBuild: {coins: {add: -1}, drawNAdjust: {add: 1}}}, text: "Pay $1 and Draw another card\nwhen you Draw.", textLow: "Process drawn cards in any order.", extras: [ {ext: "Policy"}, {step: 3}, {step: 3}, {cardProps: {onBuild: {key0 : [ {coins: {add: -1}}, {drawNAdjust: {add: 1}} ]}}} ], path: "Draw-Another-Policy.png"},
        {nreps: 2, type: "Policy", name: "Draw Again", color: "rgb(255,255,0)", cost: 4, step: 3, subtype: null, ext: "Policy", props: {onTurnStart: {coins: {add: -1}, draws: {add: 1}}}, text: "Pay $1 and get +1 Draw\nat start of each turn.", textLow: "whether or not you use the Draw", extras: [ {ext: "Policy"}, {step: 3}, {step: 3}, {cardProps: {onTurnStart: {key0 : [ {coins: {add: -1}}, {draws: {add: 1}} ]}}} ], path: "Draw-Again-Policy.png"},
        {nreps: 2, type: "Policy", name: "Move Again", color: "rgb(255,255,0)", cost: 4, step: 2, subtype: null, ext: "Policy", props: {onTurnStart: {coins: {add: -1}, moves: {add: 1}}}, text: "Pay $1 and get +1 Move Action\nat start each turn.", textLow: null, extras: [ {ext: "Policy"}, {step: 2}, {step: 2}, {cardProps: {onTurnStart: {key0 : [ {coins: {add: -1}}, {moves: {add: 1}} ]}}} ], path: "Move-Again-Policy.png"},
        {nreps: 2, type: "Policy", name: "Flexible Itenerary", color: "rgb(255,255,0)", cost: 3, step: 2, subtype: null, ext: "Policy", props: {onGetDist: {when: [ {offerChoice: "Flip second dist?"}, {dist: {set: "nextDistance"}} ]}}, text: "When you flip a first Distance card\nyou may flip a second Distance card.", textLow: null, extras: [ {ext: "Policy"}, {step: 2}, {step: 2}, {cardProps: {onGetDist: {when: {key0 : [ {offerChoice: "Flip second dist?"}, {dist: {set: "nextDistance"}} ]}}}} ], path: "Flexible-Itenerary-Policy.png"},
        {nreps: 2, type: "Policy", name: "Road Repair", color: "rgb(255,255,0)", cost: null, step: 2, subtype: null, ext: "Dir", props: {onBuild: {blockedDirAdjust: {include: [ "N" ]}}}, text: "Movement N is blocked.", textLow: null, extras: [ {ext: "Dir"}, {step: 2}, {xname: "-N"}, {ext: "Dir"}, {step: 2}, {cardProps: {onBuild: {blockedDirAdjust: {include: [ "N" ]}}}} ], path: "Road-Repair-N-Policy.png"},
        {nreps: 2, type: "Policy", name: "Road Repair", color: "rgb(255,255,0)", cost: null, step: 2, subtype: null, ext: "Dir", props: {onBuild: {blockedDirAdjust: {include: [ "E" ]}}}, text: "Movement E is blocked.", textLow: null, extras: [ {ext: "Dir"}, {step: 2}, {xname: "-E"}, {ext: "Dir"}, {step: 2}, {cardProps: {onBuild: {blockedDirAdjust: {include: [ "E" ]}}}} ], path: "Road-Repair-E-Policy.png"},
        {nreps: 2, type: "Policy", name: "Road Repair", color: "rgb(255,255,0)", cost: null, step: 2, subtype: null, ext: "Dir", props: {onBuild: {blockedDirAdjust: {include: [ "S" ]}}}, text: "Movement S is blocked.", textLow: null, extras: [ {ext: "Dir"}, {step: 2}, {xname: "-S"}, {ext: "Dir"}, {step: 2}, {cardProps: {onBuild: {blockedDirAdjust: {include: [ "S" ]}}}} ], path: "Road-Repair-S-Policy.png"},
        {nreps: 2, type: "Policy", name: "Road Repair", color: "rgb(255,255,0)", cost: null, step: 2, subtype: null, ext: "Dir", props: {onBuild: {blockedDirAdjust: {include: [ "W" ]}}}, text: "Movement W is blocked.", textLow: null, extras: [ {ext: "Dir"}, {step: 2}, {xname: "-W"}, {ext: "Dir"}, {step: 2}, {cardProps: {onBuild: {blockedDirAdjust: {include: [ "W" ]}}}} ], path: "Road-Repair-W-Policy.png"},
        {nreps: 2, type: "Policy", name: "Discount to Build", color: "rgb(255,255,0)", cost: null, step: 1, subtype: null, ext: "Policy", props: {onBuild: {buildAdjust: [ {add: -1}, {min: 1} ]}}, text: "- $1 on each Build", textLow: "Not less than 1.", extras: [ {ext: "Policy"}, {step: 1}, {step: 1}, {cardProps: {onBuild: {buildAdjust: {key0 : [ {add: -1}, {min: 1} ]}}}} ], path: "Discount-to-Build-Policy.png"},
        {nreps: 2, type: "Policy", name: "Bail Bond", color: "rgb(255,255,0)", cost: null, step: 1, subtype: null, ext: "Policy", props: {special: {suppressCard: "Jail"}}, text: "No effects when you Stop in Jail", textLow: null, extras: [ {ext: "Policy"}, {step: 1}, {step: 1}, {cardProps: {special: {suppressCard: "Jail"}}} ], path: "Bail-Bond-Policy.png"},
        {nreps: 2, type: "Policy", name: "Overtime Penalty", color: "rgb(255,255,0)", cost: null, step: 1, subtype: null, ext: "Policy", props: {onStop: {when: [ {gt: {distMoved: 4}}, {coins: {add: -2}}, {moves: {add: -1}} ]}}, text: "-1 Move\n- $2\nIf you move Distance 5 or more.", textLow: null, extras: [ {ext: "Policy"}, {step: 1}, {step: 1}, {cardProps: {onStop: {when: {key0 : [ {gt: {distMoved: 4}}, {coins: {add: -2}}, {moves: {add: -1}} ]}}}} ], path: "Overtime-Penalty-Policy.png"},
        {nreps: 2, type: "Policy", name: "Overtime Bonus", color: "rgb(255,255,0)", cost: null, step: 1, subtype: null, ext: "Policy", props: {onStop: {when: [ {gt: {distMoved: 4}}, {coins: {add: 2}} ]}}, text: "+ $2\nIf you move Distance 5 or more.", textLow: null, extras: [ {ext: "Policy"}, {step: 1}, {step: 1}, {cardProps: {onStop: {when: {key0 : [ {gt: {distMoved: 4}}, {coins: {add: 2}} ]}}}} ], path: "Overtime-Bonus-Policy.png"},
        {nreps: 2, type: "Policy", name: "Speed Limit", color: "rgb(255,255,0)", cost: null, step: 1, subtype: null, ext: "Policy", props: {onMove: {dist: {max: 4}}}, text: "Maximum Distance = 4.", textLow: null, extras: [ {ext: "Policy"}, {step: 1}, {step: 1}, {cardProps: {onMove: {dist: {max: 4}}}} ], path: "Speed-Limit-Policy.png"},
        {nreps: 2, type: "Policy", name: "Minimum Wage", color: "rgb(255,255,0)", cost: 2, step: 2, subtype: null, ext: "Policy", props: {onBuild: {stopAdjust: {min: 2}}}, text: " $2 min Wages", textLow: null, extras: [ {ext: "Policy"}, {step: 2}, {step: 2}, {cardProps: {onBuild: {stopAdjust: {min: 2}}}} ], path: "Minimum-Wage-Policy.png"},
        {nreps: 2, type: "Policy", name: "Labor Shortage", color: "rgb(255,255,0)", cost: 3, step: 2, subtype: null, ext: "Policy", props: {onBuild: {stopAdjust: {add: 2}}}, text: "+ $2 to all Wages", textLow: null, extras: [ {ext: "Policy"}, {step: 2}, {step: 2}, {cardProps: {onBuild: {stopAdjust: {add: 2}}}} ], path: "Labor-Shortage-Policy.png"},
        {nreps: 2, type: "Policy", name: "Urban Renewal", color: "rgb(255,255,0)", cost: 4, step: 3, subtype: null, ext: "Policy", props: {special: {doUrbanRenewal: 2}}, text: "Pay $2 to build on eligible* lot.", textLow: "*not owned by other player & VP = 0", extras: [ {ext: "Policy"}, {step: 3}, {step: 3}, {cardProps: {special: {doUrbanRenewal: 2}}} ], path: "Urban-Renewal-Policy.png"},
        {nreps: 2, type: "Policy", name: "Zoning: No Houses", color: "rgb(255,255,0)", cost: null, step: 2, subtype: null, ext: "Policy", props: {special: {configBuy: "NoHouse"}}, text: "May not build Houses.\n(on Residential)", textLow: null, extras: [ {ext: "Policy"}, {step: 2}, {step: 2}, {cardProps: {special: {configBuy: "NoHouse"}}} ], path: "Zoning:-No-Houses-Policy.png"},
        {nreps: 2, type: "Policy", name: "Zoning: Only Houses", color: "rgb(255,255,0)", cost: null, step: 2, subtype: null, ext: "Policy", props: {special: {configBuy: "OnlyHouse"}}, text: "May only build Houses.\n(on Residential)", textLow: null, extras: [ {ext: "Policy"}, {step: 2}, {step: 2}, {cardProps: {special: {configBuy: "OnlyHouse"}}} ], path: "Zoning:-Only-Houses-Policy.png"},
        {nreps: 1, type: "Policy", name: "Price of Power", color: "rgb(255,255,0)", cost: 3, step: 1, subtype: null, ext: "Policy", props: {onTurnStart: {withPlayer: [ "high_total_cash", {coins: {add: -1}} ]}}, text: "- $1 at start of turn\nfrom Player with highest\nCash on hand.", textLow: null, extras: [ {ext: "Policy"}, {step: 1}, {xname: "-cash"}, {step: 1}, {cardProps: {onTurnStart: {withPlayer: {high_total_cash: {coins: {add: -1}}}}}} ], path: "Price-of-Power-cash-Policy.png"},
        {nreps: 1, type: "Policy", name: "Price of Power", color: "rgb(255,255,0)", cost: 4, step: 2, subtype: null, ext: "Policy", props: {onTurnStart: {withPlayer: [ "high_total_cost", {coins: {add: -2}} ]}}, text: "- $2 at start of turn\nfrom Player with highest\nProperty Cost.", textLow: null, extras: [ {ext: "Policy"}, {step: 2}, {xname: "-property"}, {step: 2}, {cardProps: {onTurnStart: {withPlayer: {high_total_cost: {coins: {add: -2}}}}}} ], path: "Price-of-Power-property-Policy.png"},
        {nreps: 1, type: "Policy", name: "Price of Power", color: "rgb(255,255,0)", cost: 5, step: 3, subtype: null, ext: "Policy", props: {onTurnStart: {withPlayer: [ "high_total_rent", {coins: {add: -3}} ]}}, text: "- $3 at start of turn\nfrom Player with highest\ntotal Rent.", textLow: null, extras: [ {ext: "Policy"}, {step: 3}, {xname: "-rent"}, {step: 3}, {cardProps: {onTurnStart: {withPlayer: {high_total_rent: {coins: {add: -3}}}}}} ], path: "Price-of-Power-rent-Policy.png"},
        {nreps: 2, type: "Temp Policy", name: "Boom Times", color: "rgb(255,128,0)", cost: null, step: 1, subtype: null, ext: "Policy", props: {buys: {add: 1}, onBuild: {buildAdjust: [ {add: -2}, {min: 1} ]}, cardFields: [ "turnToken", "turnTokenCounter" ], turnToken: 3, turnTokenCounter: {counter: [ "turns left" ]}, onTurnStart: {turnToken: {add: -1, filter: {isOwner: true}}, when: {le: {turnToken: 0}, discard: true}}}, text: "+1 Buy\n- $2 to Build.\nNot less than 1.", textLow: "Place 3 owner tokens on this card. At start of your turn\nremove one. When all are gone discard this card.", extras: [ {ext: "Policy"}, {step: 1}, {ext: "Policy"}, {step: 1}, {cardProps: [ {buys: {add: 1}}, {onBuild: {buildAdjust: {key0 : [ {add: -2}, {min: 1} ]}}}, {cardFields: [ "turnToken", "turnTokenCounter" ]}, {turnToken: 3}, {turnTokenCounter: {counter: [ "turns left" ]}}, {onTurnStart: {key0 : [ {turnToken: {key0 : [ {add: -1}, {filter: {isOwner: true}} ]}}, {when: {key0 : [ {le: {turnToken: 0}}, {discard: true} ]}} ]}} ]} ], path: "Boom-Times.png"},
        {nreps: 2, type: "Temp Policy", name: "Fuel Shortage", color: "rgb(255,128,0)", cost: null, step: 2, subtype: null, ext: "Policy", props: {onMove: {dist: [ {add: -1}, {min: 1} ]}, cardFields: [ "turnToken", "turnTokenCounter" ], turnToken: 3, turnTokenCounter: {counter: [ "turns left" ]}, onTurnStart: {turnToken: {add: -1, filter: {isOwner: true}}, when: {le: {turnToken: 0}, discard: true}}}, text: "-1 Distance.\nNot less than 1.", textLow: "Place 3 owner tokens on this card. At start of your turn\nremove one. When all are gone discard this card.", extras: [ {ext: "Policy"}, {step: 2}, {ext: "Policy"}, {step: 2}, {cardProps: [ {onMove: {dist: {key0 : [ {add: -1}, {min: 1} ]}}}, {cardFields: [ "turnToken", "turnTokenCounter" ]}, {turnToken: 3}, {turnTokenCounter: {counter: [ "turns left" ]}}, {onTurnStart: {key0 : [ {turnToken: {key0 : [ {add: -1}, {filter: {isOwner: true}} ]}}, {when: {key0 : [ {le: {turnToken: 0}}, {discard: true} ]}} ]}} ]} ], path: "Fuel-Shortage.png"},
        {nreps: 2, type: "Temp Policy", name: "Road Repair", color: "rgb(255,128,0)", cost: null, step: 2, subtype: null, ext: "Dir", props: {onMove: {blockedDirAdjust: {include: [ "E", "W" ]}}, cardFields: [ "turnToken", "turnTokenCounter" ], turnToken: 3, turnTokenCounter: {counter: [ "turns left" ]}, onTurnStart: {turnToken: {add: -1, filter: {isOwner: true}}, when: {le: {turnToken: 0}, discard: true}}}, text: "EW movement is blocked", textLow: "Place 3 owner tokens on this card. At start of your turn\nremove one. When all are gone discard this card.", extras: [ {ext: "Dir"}, {step: 2}, {ext: "Dir"}, {step: 2}, {cardProps: [ {onMove: {blockedDirAdjust: {include: [ "E", "W" ]}}}, {cardFields: [ "turnToken", "turnTokenCounter" ]}, {turnToken: 3}, {turnTokenCounter: {counter: [ "turns left" ]}}, {onTurnStart: {key0 : [ {turnToken: {key0 : [ {add: -1}, {filter: {isOwner: true}} ]}}, {when: {key0 : [ {le: {turnToken: 0}}, {discard: true} ]}} ]}} ]} ], path: "Road-Repair.png"},
        {nreps: 2, type: "Temp Policy", name: "Road Repair", color: "rgb(255,128,0)", cost: null, step: 2, subtype: null, ext: "Dir", props: {onMove: {blockedDirAdjust: {include: [ "N", "S" ]}}, cardFields: [ "turnToken", "turnTokenCounter" ], turnToken: 3, turnTokenCounter: {counter: [ "turns left" ]}, onTurnStart: {turnToken: {add: -1, filter: {isOwner: true}}, when: {le: {turnToken: 0}, discard: true}}}, text: "NS movement is blocked", textLow: "Place 3 owner tokens on this card. At start of your turn\nremove one. When all are gone discard this card.", extras: [ {ext: "Dir"}, {step: 2}, {ext: "Dir"}, {step: 2}, {cardProps: [ {onMove: {blockedDirAdjust: {include: [ "N", "S" ]}}}, {cardFields: [ "turnToken", "turnTokenCounter" ]}, {turnToken: 3}, {turnTokenCounter: {counter: [ "turns left" ]}}, {onTurnStart: {key0 : [ {turnToken: {key0 : [ {add: -1}, {filter: {isOwner: true}} ]}}, {when: {key0 : [ {le: {turnToken: 0}}, {discard: true} ]}} ]}} ]} ], path: "Road-Repair.png"},
   ]
  }}
