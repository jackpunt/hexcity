import { Deck } from '../card'
import { C } from '../basic-intfs'
/** This class and file are auto-generated do not edit. */
export class TileDeck {
   static deck: Deck = {
      name: 'TileDeck',
      cards: [
        {nreps: 6, type: "Financial", name: "ATM", color: "rgb(185,83,0)", cost: 1, step: 1, stop: 1, rent: 1, vp: null, subtype: "Bank", ext: "Base", props: null, text: null, extras: [ {coin: 1} ], path: "ATM.png"},
        {nreps: 5, type: "Financial", name: "Bank", color: "rgb(185,83,0)", cost: 3, step: 2, stop: 1, rent: 1, vp: null, subtype: "Bank", ext: "Base", props: null, text: null, extras: [ {coin: 2} ], path: "Bank.png"},
        {nreps: 4, type: "Financial", name: "Brokerage", color: "rgb(185,83,0)", cost: 6, step: 3, stop: 2, rent: 2, vp: null, subtype: "Bank", ext: "Base", props: null, text: null, extras: [ {coin: 3} ], path: "Brokerage.png"},
        {nreps: 3, type: "Financial", name: "Stock Exchange", color: "rgb(185,83,0)", cost: 9, step: 5, stop: 2, rent: 3, vp: 1, subtype: "Bank", ext: "Base", props: null, text: null, extras: [ {coin: 5} ], path: "Stock-Exchange.png"},
        {nreps: 12, type: "Residential", name: "Housing", color: "rgb(21,180,0)", cost: 2, step: 0, stop: 0, rent: "*", vp: null, subtype: null, ext: "Base", props: {rent: 0, vp: 0, onStep: {when: {isOwner: true, dist: {add: -2}}, else: {dist: {add: -1}}}}, text: {key0: "-1 Distance (Owner -2)", size: 45}, extras: [ {vp: [ "VP", 0, 0, "CENTER", 50, "TEXTFONT", "WHITE" ]}, {line: [ 305, "BLACK", 35, 4 ]}, {text: [ "Cost", 23, 350, "LEFTJ", 40, "TEXTFONT", "BLACK", {nlh: 50} ]}, {text: [ "2\n5\n8\n11\n14", 80, 396, "RIGHTJ", 40, "TEXTFONT", "BLACK", {nlh: 50} ]}, {text: [ "House . . . . . .\nTriplex . . . . .\nApartment .\nHigh Rise . .\nTower . . . . . .", 110, 396, "LEFTJ", 40, "TEXTFONT", "BLACK", {nlh: 50} ]}, {text: [ "VP", 370, 350, "RIGHTJ", 40, "TEXTFONT", "BLACK", {nlh: 50} ]}, {text: [ "1\n3\n6\n10\n15", 370, 396, "RIGHTJ", 40, "TEXTFONT", "BLACK", {nlh: 50} ]}, {text: [ "*Rent", -124, 350, "LEFTJ", 40, "TEXTFONT", "BLACK", {nlh: 50} ]}, {text: [ ".5\n1\n2\n4\n8", -60, 396, "CENTER", 40, "TEXTFONT", "BLACK", {nlh: 50} ]} ], path: "Housing.png"},
        {nreps: 4, type: "Industrial", name: "Construction", color: "rgb(185,83,0)", cost: 1, step: 0, stop: 2, rent: 1, vp: null, subtype: "Build", ext: "Base", props: {onStep: {builds: {add: 1}}, onBuild: {buildAdjust: [ {add: -2}, {min: 1}, {filter: {onCard: true}} ]}}, text: "+1 Build", extras: [ {textLow: "- $2 on any Build.\nNot less than 1"} ], path: "Construction.png"},
        {nreps: 4, type: "Industrial", name: "Warehouse", color: "rgb(185,83,0)", cost: 2, step: 1, stop: 1, rent: 1, vp: null, subtype: "Build", ext: "Base", props: {onStep: {builds: {add: 1}}, onBuild: {buildAdjust: [ {add: -2}, {min: 1}, {filter: {key0 : [ {onCard: true}, {isOwner: true}, {range: 1}, {type: "Commercial"} ]}} ]}}, text: "+1 Build", extras: [ {textLow: "Owner:\n- $2 to Build\nCommercial adjacent.\nNot less than 1"} ], path: "Warehouse.png"},
        {nreps: 4, type: "Industrial", name: "Heavy Equipment", color: "rgb(185,83,0)", cost: 4, step: 2, stop: 2, rent: 2, vp: null, subtype: "Build", ext: "Base", props: {onStep: {builds: {add: 1}}, onBuild: {buildAdjust: [ {add: -2}, {min: 1}, {filter: {key0 : [ {onCard: true}, {isOwner: true}, {subtype: "Transit"} ]}} ]}}, text: "+1 Build", extras: [ {textLow: "Owner:\n- $2 to Build Transit\nNot less than 1"} ], path: "Heavy-Equipment.png"},
        {nreps: 4, type: "Industrial", name: "Factory", color: "rgb(185,83,0)", cost: 6, step: 3, stop: 2, rent: 3, vp: null, subtype: "Build", ext: "Base", props: {onStep: {builds: {add: 1}}, onBuild: {buildAdjust: [ {add: -2}, {min: 1}, {filter: {key0 : [ {onCard: true}, {isOwner: true}, {not: {type: [ "Residential", "Municipal" ]}} ]}} ]}}, text: "+1 Build", extras: [ {textLow: "Owner:\n- $2 to Build\nnon-Res/Muni\nNot less than 1"} ], path: "Factory.png"},
        {nreps: 4, type: "Commercial", name: "Restaurant", color: "rgb(185,83,0)", cost: 3, step: -1, stop: 1, rent: 1, vp: null, subtype: "Bar", ext: "Base", props: {onStep: {buys: {add: 1}}, onMove: {dist: [ {add: -1}, {min: 1} ]}}, text: "+1 Buy", extras: [ {textLow: "-1 Distance (min 1)\nwhen leaving."}, {image: null} ], path: "Restaurant.png"},
        {nreps: 4, type: "Commercial", name: "Bar", color: "rgb(185,83,0)", cost: 4, step: -1, stop: 2, rent: 1, vp: null, subtype: "Bar", ext: "Base", props: {onStep: {buys: {add: 1}}, onMove: {dist: {add: -1}}}, text: "+1 Buy", extras: [ {textLow: "-1 Distance\nwhen leaving."}, {image: [ null, "center", 288, 118, 187 ]} ], path: "Bar.png"},
        {nreps: 4, type: "Commercial", name: "Night Club", color: "rgb(185,83,0)", cost: 5, step: -1, stop: 2, rent: 2, vp: null, subtype: "Bar", ext: "Base", props: {onStep: {buys: {add: 1}}, onMove: {dist: {add: -2}}}, text: "+1 Buy", extras: [ {textLow: "-2 Distance\nwhen leaving."} ], path: "Night-Club.png"},
        {nreps: 4, type: "Commercial", name: "Casino", color: "rgb(185,83,0)", cost: 6, step: -2, stop: 2, rent: 2, vp: null, subtype: "Bar", ext: "Base", props: {onStep: {buys: {add: 1}}, onMove: {dist: {set: 1}}}, text: "+1 Buy", extras: [ {textLow: "Distance = 1\nwhen leaving."}, {image: [ null, "center", 320 ]} ], path: "Casino.png"},
        {nreps: 4, type: "Commercial", name: "Grocery", color: "rgb(185,83,0)", cost: 2, step: 0, stop: 1, rent: 1, vp: null, subtype: "Shop", ext: "Base", props: {onStep: {dist: {add: -1}}}, text: "-1 Distance", extras: [ {image: [ null, "fit", "center", null, "xs" ]} ], path: "Grocery.png"},
        {nreps: 3, type: "Commercial", name: "Law Office", color: "rgb(185,83,0)", cost: 3, step: -1, stop: 1, rent: 2, vp: null, subtype: "Shop", ext: "Policy", props: {onStep: {polis: {add: 1}}, onBuild: {costAdjust: [ {add: -3}, {filter: {key0 : [ {onCard: true}, {type: "Policy"} ]}} ]}}, text: "+1 Policy", extras: [ {textLow: "- $3 on Policy actions."} ], path: "Law-Office.png"},
        {nreps: 4, type: "Commercial", name: "Cineplex", color: "rgb(185,83,0)", cost: 4, step: -1, stop: 2, rent: 2, vp: null, subtype: "Shop", ext: "Base", props: {onMove: {dist: {add: -1}}}, text: null, extras: [ {textLow: "-1 Distance\nwhen leaving."}, {image: [ null, "fit", "top", null, "xs" ]} ], path: "Cineplex.png"},
        {nreps: 4, type: "Commercial", name: "Dept Store", color: "rgb(185,83,0)", cost: 5, step: -1, stop: 3, rent: 1, vp: null, subtype: "Shop", ext: "Base", props: {onStep: {buys: {add: 1}}, onMove: {dist: {add: -2}}}, text: "+1 Buy", extras: [ {textLow: "-2 Distance\nwhen leaving."} ], path: "Dept-Store.png"},
        {nreps: 4, type: "Commercial", name: "Mall", color: "rgb(185,83,0)", cost: 6, step: -1, stop: "4*", rent: 2, vp: null, subtype: "Shop", ext: "Base", props: {stop: 4, onStop: {saveDir: "reverseDir"}, onMove: {moveDir: {set: "saveDir"}}}, text: null, extras: [ {image: [ null, "fit", "fit" ]}, {text: [ "*Exit in\nDirection\nentered", "center", "center" ]} ], path: "Mall.png"},
        {nreps: 3, type: "Commercial", name: "Stadium", color: "rgb(185,83,0)", cost: 7, step: -2, stop: 5, rent: 2, vp: null, subtype: "Municipal", ext: "Base", props: {onMove: {dist: {add: -2}}}, text: null, extras: [ {textLow: "-2 Distance\nwhen leaving."}, {image: null} ], path: "Stadium.png"},
        {nreps: 4, type: "Municipal", name: "Plaza", color: "rgb(185,83,0)", cost: 3, step: 0, stop: 0, rent: 1, vp: null, subtype: null, ext: "Base", props: {onStep: {dist: {add: -2}}, onBuild: {rentAdjust: {add: 1, filter: {range: 1, type: "Commercial"}}, stopAdjust: {add: 1, filter: {range: 1, type: "Commercial"}}}}, text: "-2 Distance", extras: [ {image: null}, {textLow: "+ $1 Rent, + $1 Wages\nfor adjacent Commercial"} ], path: "Plaza.png"},
        {nreps: 4, type: "Municipal", name: "Playground", color: "rgb(185,83,0)", cost: 2, step: -1, stop: 0, rent: 0, vp: null, subtype: "Park", ext: "Base", props: {onStep: {dist: {add: -1}}, onBuild: {rentAdjust: [ {add: 1}, {filter: {key0 : [ {range: 1}, {type: "Residential"} ]}} ]}}, text: "-1 Distance", extras: [ {image: [ null, "fit" ]}, {textLow: "+ $1 Rent adj Residential"} ], path: "Playground.png"},
        {nreps: 4, type: "Municipal", name: "Park", color: "rgb(185,83,0)", cost: 4, step: 0, stop: 0, rent: 1, vp: 1, subtype: "Park", ext: "Base", props: {rent: 0, onStep: {dist: {add: -1}}, onBuild: {rentAdjust: [ {add: 1}, {filter: {range: 1}} ]}}, text: "-1 Distance", extras: [ {image: [ null, "fit" ]}, {textLow: "+ $1 Rent adj Properties"} ], path: "Park.png"},
        {nreps: 4, type: "Municipal", name: "School", color: "rgb(185,83,0)", cost: 5, step: 1, stop: 1, rent: 1, vp: 1, subtype: null, ext: "Base", props: {onStep: {dist: {add: -1}}, onBuild: {rentAdjust: [ {add: 1}, {filter: {key0 : [ {range: 1}, {type: "Residential"} ]}} ]}}, text: "-1 Distance", extras: [ {textLow: "+ $1 Rent adj Residential"}, {image: [ null, "fit", "center", null, "xs" ]} ], path: "School.png"},
        {nreps: 4, type: "Municipal", name: "Lake", color: "rgb(185,83,0)", cost: 7, step: null, stop: null, rent: null, vp: 2, subtype: "Park", ext: "Base", props: {step: 0, stop: 0, rent: 0, noStop: true, onStep: {dist: {set: 1}}, onBuild: {rentAdjust: [ {add: 2}, {filter: {range: 1}} ]}}, text: "Distance = 1", extras: [ {textLow: "+ $2 Rent\nfor adjacent Properties"}, {image: [ null, "fit" ]}, {text: [ "No Stopping", "center", 300, "CENTER", 50, "TEXTFONT", "RED", {wght: "bold"} ]} ], path: "Lake.png"},
        {nreps: 2, type: "Government", name: "Jail", color: "rgb(232,115,255)", cost: 1, step: -1, stop: "0*", rent: 1, vp: 1, subtype: null, ext: "Base", props: {stop: 0, onStop: {dist: {set: 0}, buys: {add: -1}, builds: {add: -1}, moves: {add: -1}, polis: {add: -1}, noRent: {set: true}}, onBuild: {rangeAdjustTurn: [ {add: -1}, {filter: {onCard: true}} ]}, onMove: {noRent: {set: false}}}, text: "* -1 Buy   \n-1 Build\n-1 Move\n-1 Policy", extras: [ {textLow: "-1 Range\nCollect no Rent."} ], path: "Jail.png"},
        {nreps: 4, type: "Government", name: "County Recorder", color: "rgb(232,115,255)", cost: 3, step: 0, stop: 0, rent: 1, vp: 1, subtype: null, ext: "Base", props: {onStep: {buys: {add: 1}, builds: {add: 1}, rangeAdjustTurn: {add: 1}}, onBuild: {buildAdjust: [ {add: -3}, {filter: {onCard: true}} ]}}, text: "+1 Buy\n+1 Build\n+1 Range", extras: [ {textLow: "- $3 on Build"} ], path: "County-Recorder.png"},
        {nreps: 4, type: "Government", name: "Enterprise Zone", color: "rgb(232,115,255)", cost: 4, step: 0, stop: 2, rent: 1, vp: 1, subtype: null, ext: "Base", props: {rent: 0, onStep: {buys: {add: 1}, builds: {add: 1}}, onBuild: {buildAdjust: {add: -1, filter: {onCard: true}}, rentAdjust: {add: 1, filter: {range: 1, not: {type: "Residential"}}}}}, text: "+1 Buy\n+1 Build", extras: [ {textLow: "- $1 to Build\nadjacent Property.\n+ $1 Rent on adjacent\nnon-Residential Property."} ], path: "Enterprise-Zone.png"},
        {nreps: 1, type: "Government", name: "Court House", color: "rgb(232,115,255)", cost: 5, step: 0, stop: 0, rent: 1, vp: 2, subtype: null, ext: "Policy", props: {onStep: {buys: {add: 1}, builds: {add: 1}}, onBuild: {polisAdjust: {add: 1, filter: {onCard: true}}, costAdjust: {add: -3, filter: {onCard: true, type: "Policy"}}}}, text: "+1 Buy\n+1 Build", extras: [ {textLow: "+1 Policy\n- $3 on Policy actions"} ], path: "Court-House.png"},
        {nreps: 1, type: "Government", name: "City Hall", color: "rgb(232,115,255)", cost: 6, step: 0, stop: "*", rent: 1, vp: 2, subtype: null, ext: "Policy", props: {stop: 0, onStep: {buys: {add: 1}, rangeAdjustTurn: {add: 1}}, onBuild: {polisAdjust: {add: 1, filter: {onCard: true}}, costAdjust: {add: -3, filter: {onCard: true, type: "Policy"}}}}, text: "* +1 Buy  \n+1 Range", extras: [ {textLow: "+1 Policy\n- $3 on Policy actions"} ], path: "City-Hall.png"},
   ]
  }}
