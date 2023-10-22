import { Deck } from '../card'
import { C } from '../basic-intfs'
/** This class and file are auto-generated do not edit. */
export class TileDeck {
   static deck: Deck = {
      name: 'TileDeck',
      cards: [
        {nreps: 6, type: "Financial", name: "ATM", cost: 1, step: 1, stop: 1, rent: 1, vp: null, subtype: "Bank", ext: "Base", props: null, path: "ATM.png"},
        {nreps: 5, type: "Financial", name: "Bank", cost: 3, step: 2, stop: 1, rent: 1, vp: null, subtype: "Bank", ext: "Base", props: null, path: "Bank.png"},
        {nreps: 4, type: "Financial", name: "Brokerage", cost: 6, step: 3, stop: 2, rent: 2, vp: null, subtype: "Bank", ext: "Base", props: null, path: "Brokerage.png"},
        {nreps: 3, type: "Financial", name: "Stock Exchange", cost: 9, step: 5, stop: 2, rent: 3, vp: 1, subtype: "Bank", ext: "Base", props: null, path: "Stock-Exchange.png"},
        {nreps: 12, type: "Residential", name: "Housing", cost: 2, step: 0, stop: 0, rent: 0, vp: "VP", subtype: null, ext: "Base", props: {vp: 0, onStep: {when: {isOwner: true, dist: {add: -2}}, else: {dist: {add: -1}}}}, path: "Housing.png"},
        {nreps: 4, type: "Industrial", name: "Construction", cost: 1, step: 0, stop: 2, rent: 1, vp: null, subtype: "Build", ext: "Base", props: {onStep: {builds: {add: 1}}, onBuild: {buildAdjust: {add: -2, min: 1, filter: {onCard: true}}}}, path: "Construction.png"},
        {nreps: 4, type: "Industrial", name: "Warehouse", cost: 2, step: 1, stop: 1, rent: 1, vp: null, subtype: "Build", ext: "Base", props: {onStep: {builds: {add: 1}}, onBuild: {buildAdjust: {add: -2, min: 1, filter: {onCard: true, isOwner: true, range: 1, type: "Commercial"}}}}, path: "Warehouse.png"},
        {nreps: 4, type: "Industrial", name: "Heavy Equipment", cost: 4, step: 2, stop: 2, rent: 2, vp: null, subtype: "Build", ext: "Base", props: {onStep: {builds: {add: 1}}, onBuild: {buildAdjust: {add: -2, min: 1, filter: {onCard: true, isOwner: true, subtype: "Transit"}}}}, path: "Heavy-Equipment.png"},
        {nreps: 4, type: "Industrial", name: "Factory", cost: 6, step: 3, stop: 2, rent: 3, vp: null, subtype: "Build", ext: "Base", props: {onStep: {builds: {add: 1}}, onBuild: {buildAdjust: {add: -2, min: 1, filter: {onCard: true, isOwner: true, not: {type: [ "Residential", "Municipal" ]}}}}}, path: "Factory.png"},
        {nreps: 4, type: "Commercial", name: "Restaurant", cost: 3, step: -1, stop: 1, rent: 1, vp: null, subtype: "Bar", ext: "Base", props: {onStep: {buys: {add: 1}}, onMove: {dist: {add: -1, min: 1}}}, path: "Restaurant.png"},
        {nreps: 4, type: "Commercial", name: "Bar", cost: 4, step: -1, stop: 2, rent: 1, vp: null, subtype: "Bar", ext: "Base", props: {onStep: {buys: {add: 1}}, onMove: {dist: {add: -1}}}, path: "Bar.png"},
        {nreps: 4, type: "Commercial", name: "Night Club", cost: 5, step: -1, stop: 2, rent: 2, vp: null, subtype: "Bar", ext: "Base", props: {onStep: {buys: {add: 1}}, onMove: {dist: {add: -2}}}, path: "Night-Club.png"},
        {nreps: 4, type: "Commercial", name: "Casino", cost: 6, step: -2, stop: 2, rent: 2, vp: null, subtype: "Bar", ext: "Base", props: {onStep: {buys: {add: 1}}, onMove: {dist: {set: 1}}}, path: "Casino.png"},
        {nreps: 4, type: "Commercial", name: "Grocery", cost: 2, step: 0, stop: 1, rent: 1, vp: null, subtype: "Shop", ext: "Base", props: {onStep: {dist: {add: -1}}}, path: "Grocery.png"},
        {nreps: 3, type: "Commercial", name: "Law Office", cost: 3, step: -1, stop: 1, rent: 2, vp: null, subtype: "Shop", ext: "Policy", props: {onStep: {polis: {add: 1}}, onBuild: {costAdjust: {add: -3, filter: {onCard: true, type: "Policy"}}}}, path: "Law-Office.png"},
        {nreps: 4, type: "Commercial", name: "Cineplex", cost: 4, step: -1, stop: 2, rent: 2, vp: null, subtype: "Shop", ext: "Base", props: {onMove: {dist: {add: -1}}}, path: "Cineplex.png"},
        {nreps: 4, type: "Commercial", name: "Dept Store", cost: 5, step: -1, stop: 3, rent: 1, vp: null, subtype: "Shop", ext: "Base", props: {onStep: {buys: {add: 1}}, onMove: {dist: {add: -2}}}, path: "Dept-Store.png"},
        {nreps: 4, type: "Commercial", name: "Mall", cost: 6, step: -1, stop: 4, rent: 2, vp: null, subtype: "Shop", ext: "Base", props: {onStop: {saveDir: "reverseDir"}, onMove: {moveDir: {set: "saveDir"}}}, path: "Mall.png"},
        {nreps: 3, type: "Commercial", name: "Stadium", cost: 7, step: -2, stop: 5, rent: 2, vp: null, subtype: "Municipal", ext: "Base", props: {onMove: {dist: {add: -2}}}, path: "Stadium.png"},
        {nreps: 4, type: "Municipal", name: "Plaza", cost: 3, step: 0, stop: 0, rent: 1, vp: null, subtype: null, ext: "Base", props: {onStep: {dist: {add: -2}}, onBuild: {rentAdjust: {add: 1, filter: {range: 1, type: "Commercial"}}, stopAdjust: {add: 1, filter: {range: 1, type: "Commercial"}}}}, path: "Plaza.png"},
        {nreps: 4, type: "Municipal", name: "Playground", cost: 2, step: -1, stop: 0, rent: 0, vp: null, subtype: "Park", ext: "Base", props: {onStep: {dist: {add: -1}}, onBuild: {rentAdjust: {add: 1, filter: {range: 1, type: "Residential"}}}}, path: "Playground.png"},
        {nreps: 4, type: "Municipal", name: "Park", cost: 4, step: 0, stop: 0, rent: 0, vp: 1, subtype: "Park", ext: "Base", props: {onStep: {dist: {add: -1}}, onBuild: {rentAdjust: {add: 1, filter: {range: 1}}}}, path: "Park.png"},
        {nreps: 4, type: "Municipal", name: "School", cost: 5, step: 1, stop: 1, rent: 1, vp: 1, subtype: null, ext: "Base", props: {onStep: {dist: {add: -1}}, onBuild: {rentAdjust: {add: 1, filter: {range: 1, type: "Residential"}}}}, path: "School.png"},
        {nreps: 4, type: "Municipal", name: "Lake", cost: 7, step: 0, stop: 0, rent: 0, vp: 2, subtype: "Park", ext: "Base", props: {noStop: true, onStep: {dist: {set: 1}}, onBuild: {rentAdjust: {add: 2, filter: {range: 1}}}}, path: "Lake.png"},
        {nreps: 2, type: "Government", name: "Jail", cost: 1, step: -1, stop: 0, rent: 1, vp: 1, subtype: null, ext: "Base", props: {onStop: {dist: {set: 0}, buys: {add: -1}, builds: {add: -1}, moves: {add: -1}, polis: {add: -1}, noRent: {set: true}}, onBuild: {rangeAdjustTurn: {add: -1, filter: {onCard: true}}}, onMove: {noRent: {set: false}}}, path: "Jail.png"},
        {nreps: 4, type: "Government", name: "County Recorder", cost: 3, step: 0, stop: 0, rent: 1, vp: 1, subtype: null, ext: "Base", props: {onStep: {buys: {add: 1}, builds: {add: 1}, rangeAdjustTurn: {add: 1}}, onBuild: {buildAdjust: {add: -3, filter: {onCard: true}}}}, path: "County-Recorder.png"},
        {nreps: 4, type: "Government", name: "Enterprise Zone", cost: 4, step: 0, stop: 2, rent: 0, vp: 1, subtype: null, ext: "Base", props: {onStep: {buys: {add: 1}, builds: {add: 1}}, onBuild: {buildAdjust: {add: -1, filter: {onCard: true}}, rentAdjust: {add: 1, filter: {range: 1, not: {type: "Residential"}}}}}, path: "Enterprise-Zone.png"},
        {nreps: 1, type: "Government", name: "Court House", cost: 5, step: 0, stop: 0, rent: 1, vp: 2, subtype: null, ext: "Policy", props: {onStep: {buys: {add: 1}, builds: {add: 1}}, onBuild: {polisAdjust: {add: 1, filter: {onCard: true}}, costAdjust: {add: -3, filter: {onCard: true, type: "Policy"}}}}, path: "Court-House.png"},
        {nreps: 1, type: "Government", name: "City Hall", cost: 6, step: 0, stop: 0, rent: 1, vp: 2, subtype: null, ext: "Policy", props: {onStep: {buys: {add: 1}, rangeAdjustTurn: {add: 1}}, onBuild: {polisAdjust: {add: 1, filter: {onCard: true}}, costAdjust: {add: -3, filter: {onCard: true, type: "Policy"}}}}, path: "City-Hall.png"},
   ]
  }}
