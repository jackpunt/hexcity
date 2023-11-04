import { Deck } from '../card'
import { C } from '../basic-intfs'
/** This class and file are auto-generated do not edit. */
export class TechDeck {
   static deck: Deck = {
      name: 'TechDeck',
      cards: [
        {nreps: 1, type: "Industrial", name: "High Tech", color: "rgb(185,83,0)", cost: "9+", step: 2, stop: "*3*", rent: "2*", vp: 1, subtype: "Social Network", ext: "High Tech", props: {stop: 3, rent: 2, cost: 9, cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ], valueToken: 0, valueTokenCounter: {counter: [ "Value", 93, -20 ]}, stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}, onStep: {valueToken: {add: 1, max: 6}, rent: {set: 2, add: "valueToken"}, stop: {set: 3, add2: "valueToken"}}, onBuild: {costAdjust: {add: 2, filter: {name: "High Tech"}}, buildAdjust: {add: 2, filter: {name: "High Tech"}}, rentAdjust: {add: 1, filter: {type: [ "Commercial", "Residential" ], range: 2}}}}, text: "+1 Value Token\n(max 6)\n\n* + $1 per Value Token", textLow: "+ $1 Rent to Com/Res (Range:2)\n+ $2 Cost for other High Tech", extras: [ {textLow: "+ $1 Rent to Com/Res (Range:2)\n+ $2 Cost for other High Tech"}, {vp: 1}, {subtype: "Social Network"}, {filen: "High Tech Social Network"}, {ext: "High Tech"}, {cardProps: [ {stop: 3}, {rent: 2}, {cost: 9}, {cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ]}, {valueToken: 0}, {valueTokenCounter: {counter: [ "Value", 93, -20 ]}}, {stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}}, {onStep: {key0 : [ {valueToken: {key0 : [ {add: 1}, {max: 6} ]}}, {rent: {key0 : [ {set: 2}, {add: "valueToken"} ]}}, {stop: {key0 : [ {set: 3}, {add2: "valueToken"} ]}} ]}}, {onBuild: {key0 : [ {costAdjust: {key0 : [ {add: 2}, {filter: {name: "High Tech"}} ]}}, {buildAdjust: {key0 : [ {add: 2}, {filter: {name: "High Tech"}} ]}}, {rentAdjust: {key0 : [ {add: 1}, {filter: {key0 : [ {type: [ "Commercial", "Residential" ]}, {range: 2} ]}} ]}} ]}} ]} ], path: "High-Tech-Social-Network.png"},
        {nreps: 1, type: "Industrial", name: "High Tech", color: "rgb(185,83,0)", cost: "9+", step: 2, stop: "*3*", rent: "2*", vp: 1, subtype: "Shiny Devices", ext: "High Tech", props: {stop: 3, rent: 2, cost: 9, cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ], valueToken: 0, valueTokenCounter: {counter: [ "Value", 93, -20 ]}, stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}, onStep: {valueToken: {add: 1, max: 6}, rent: {set: 2, add: "valueToken"}, stop: {set: 3, add2: "valueToken"}}, onBuild: {costAdjust: {add: 2, filter: {name: "High Tech"}}, buildAdjust: {add: 2, filter: {name: "High Tech"}}, rentAdjust: {add: 1, filter: {type: [ "Commercial", "Residential" ], range: 2}}}}, text: "+1 Value Token\n(max 6)\n\n* + $1 per Value Token", textLow: "+ $1 Rent to Com/Res (Range:2)\n+ $2 Cost for other High Tech", extras: [ {textLow: "+ $1 Rent to Com/Res (Range:2)\n+ $2 Cost for other High Tech"}, {vp: 1}, {subtype: "Shiny Devices"}, {filen: "High Tech Shiny Devices"}, {ext: "High Tech"}, {cardProps: [ {stop: 3}, {rent: 2}, {cost: 9}, {cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ]}, {valueToken: 0}, {valueTokenCounter: {counter: [ "Value", 93, -20 ]}}, {stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}}, {onStep: {key0 : [ {valueToken: {key0 : [ {add: 1}, {max: 6} ]}}, {rent: {key0 : [ {set: 2}, {add: "valueToken"} ]}}, {stop: {key0 : [ {set: 3}, {add2: "valueToken"} ]}} ]}}, {onBuild: {key0 : [ {costAdjust: {key0 : [ {add: 2}, {filter: {name: "High Tech"}} ]}}, {buildAdjust: {key0 : [ {add: 2}, {filter: {name: "High Tech"}} ]}}, {rentAdjust: {key0 : [ {add: 1}, {filter: {key0 : [ {type: [ "Commercial", "Residential" ]}, {range: 2} ]}} ]}} ]}} ]} ], path: "High-Tech-Shiny-Devices.png"},
        {nreps: 1, type: "Industrial", name: "High Tech", color: "rgb(185,83,0)", cost: "9+", step: 2, stop: "*3*", rent: "2*", vp: 1, subtype: "Online Shopping", ext: "High Tech", props: {stop: 3, rent: 2, cost: 9, cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ], valueToken: 0, valueTokenCounter: {counter: [ "Value", 93, -20 ]}, stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}, onStep: {valueToken: {add: 1, max: 6}, rent: {set: 2, add: "valueToken"}, stop: {set: 3, add2: "valueToken"}}, onBuild: {costAdjust: {add: 2, filter: {name: "High Tech"}}, buildAdjust: {add: 2, filter: {name: "High Tech"}}, rentAdjust: {add: 1, filter: {type: [ "Commercial", "Residential" ], range: 2}}}}, text: "+1 Value Token\n(max 6)\n\n* + $1 per Value Token", textLow: "+ $1 Rent to Com/Res (Range:2)\n+ $2 Cost for other High Tech", extras: [ {textLow: "+ $1 Rent to Com/Res (Range:2)\n+ $2 Cost for other High Tech"}, {vp: 1}, {subtype: "Online Shopping"}, {filen: "High Tech Online Shopping"}, {ext: "High Tech"}, {cardProps: [ {stop: 3}, {rent: 2}, {cost: 9}, {cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ]}, {valueToken: 0}, {valueTokenCounter: {counter: [ "Value", 93, -20 ]}}, {stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}}, {onStep: {key0 : [ {valueToken: {key0 : [ {add: 1}, {max: 6} ]}}, {rent: {key0 : [ {set: 2}, {add: "valueToken"} ]}}, {stop: {key0 : [ {set: 3}, {add2: "valueToken"} ]}} ]}}, {onBuild: {key0 : [ {costAdjust: {key0 : [ {add: 2}, {filter: {name: "High Tech"}} ]}}, {buildAdjust: {key0 : [ {add: 2}, {filter: {name: "High Tech"}} ]}}, {rentAdjust: {key0 : [ {add: 1}, {filter: {key0 : [ {type: [ "Commercial", "Residential" ]}, {range: 2} ]}} ]}} ]}} ]} ], path: "High-Tech-Online-Shopping.png"},
        {nreps: 1, type: "Industrial", name: "High Tech", color: "rgb(185,83,0)", cost: "9+", step: 2, stop: "*3*", rent: "2*", vp: 1, subtype: "Streaming Video", ext: "High Tech", props: {stop: 3, rent: 2, cost: 9, cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ], valueToken: 0, valueTokenCounter: {counter: [ "Value", 93, -20 ]}, stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}, onStep: {valueToken: {add: 1, max: 6}, rent: {set: 2, add: "valueToken"}, stop: {set: 3, add2: "valueToken"}}, onBuild: {costAdjust: {add: 2, filter: {name: "High Tech"}}, buildAdjust: {add: 2, filter: {name: "High Tech"}}, rentAdjust: {add: 1, filter: {type: [ "Commercial", "Residential" ], range: 2}}}}, text: "+1 Value Token\n(max 6)\n\n* + $1 per Value Token", textLow: "+ $1 Rent to Com/Res (Range:2)\n+ $2 Cost for other High Tech", extras: [ {textLow: "+ $1 Rent to Com/Res (Range:2)\n+ $2 Cost for other High Tech"}, {vp: 1}, {subtype: "Streaming Video"}, {filen: "High Tech Streaming Video"}, {ext: "High Tech"}, {cardProps: [ {stop: 3}, {rent: 2}, {cost: 9}, {cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ]}, {valueToken: 0}, {valueTokenCounter: {counter: [ "Value", 93, -20 ]}}, {stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}}, {onStep: {key0 : [ {valueToken: {key0 : [ {add: 1}, {max: 6} ]}}, {rent: {key0 : [ {set: 2}, {add: "valueToken"} ]}}, {stop: {key0 : [ {set: 3}, {add2: "valueToken"} ]}} ]}}, {onBuild: {key0 : [ {costAdjust: {key0 : [ {add: 2}, {filter: {name: "High Tech"}} ]}}, {buildAdjust: {key0 : [ {add: 2}, {filter: {name: "High Tech"}} ]}}, {rentAdjust: {key0 : [ {add: 1}, {filter: {key0 : [ {type: [ "Commercial", "Residential" ]}, {range: 2} ]}} ]}} ]}} ]} ], path: "High-Tech-Streaming-Video.png"},
        {nreps: 1, type: "Industrial", name: "High Tech", color: "rgb(185,83,0)", cost: "9+", step: 2, stop: "*3*", rent: "2*", vp: 1, subtype: "Internet Ads", ext: "High Tech", props: {stop: 3, rent: 2, cost: 9, cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ], valueToken: 0, valueTokenCounter: {counter: [ "Value", 93, -20 ]}, stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}, onStep: {valueToken: {add: 1, max: 6}, rent: {set: 2, add: "valueToken"}, stop: {set: 3, add2: "valueToken"}}, onBuild: {costAdjust: {add: 2, filter: {name: "High Tech"}}, buildAdjust: {add: 2, filter: {name: "High Tech"}}, rentAdjust: {add: 1, filter: {type: [ "Commercial", "Residential" ], range: 2}}}}, text: "+1 Value Token\n(max 6)\n\n* + $1 per Value Token", textLow: "+ $1 Rent to Com/Res (Range:2)\n+ $2 Cost for other High Tech", extras: [ {textLow: "+ $1 Rent to Com/Res (Range:2)\n+ $2 Cost for other High Tech"}, {vp: 1}, {subtype: "Internet Ads"}, {filen: "High Tech Internet Ads"}, {ext: "High Tech"}, {cardProps: [ {stop: 3}, {rent: 2}, {cost: 9}, {cardFields: [ "valueToken", "valueTokenCounter", "stopCounter" ]}, {valueToken: 0}, {valueTokenCounter: {counter: [ "Value", 93, -20 ]}}, {stopCounter: {counter: [ 0, 0, -104.5, C.coinGold ]}}, {onStep: {key0 : [ {valueToken: {key0 : [ {add: 1}, {max: 6} ]}}, {rent: {key0 : [ {set: 2}, {add: "valueToken"} ]}}, {stop: {key0 : [ {set: 3}, {add2: "valueToken"} ]}} ]}}, {onBuild: {key0 : [ {costAdjust: {key0 : [ {add: 2}, {filter: {name: "High Tech"}} ]}}, {buildAdjust: {key0 : [ {add: 2}, {filter: {name: "High Tech"}} ]}}, {rentAdjust: {key0 : [ {add: 1}, {filter: {key0 : [ {type: [ "Commercial", "Residential" ]}, {range: 2} ]}} ]}} ]}} ]} ], path: "High-Tech-Internet-Ads.png"},
   ]
  }}
