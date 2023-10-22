import { Deck } from '../card'
import { C } from '../basic-intfs'
/** This class and file are auto-generated do not edit. */
export class RoadDeck {
   static deck: Deck = {
      name: 'RoadDeck',
      cards: [
        {nreps: 6, type: "Road", name: "Express Lane", cost: 2, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "S", "S", "S", "S" ]}, onStep: {dist: {add: 1}, payOwner: {set: "rentAdjust"}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Express-Lane.png"},
        {nreps: 4, type: "Road", name: "LRLR", cost: 2, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "L", "R", "L", "R" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "LRLR.png"},
        {nreps: 4, type: "Road", name: "RLRL", cost: 2, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "R", "L", "R", "L" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "RLRL.png"},
        {nreps: 3, type: "Road", name: "All Left", cost: 2, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "L", "L", "L", "L" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "All-Left.png"},
        {nreps: 3, type: "Road", name: "All Right", cost: 2, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "R", "R", "R", "R" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "All-Right.png"},
        {nreps: 1, type: "Road", name: "Merge Up S   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "S", "R", "S", "L" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Up-S---.png"},
        {nreps: 1, type: "Road", name: "Merge Up L   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "L", "R", "S", "L" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Up-L---.png"},
        {nreps: 1, type: "Road", name: "Merge Up R   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "R", "R", "S", "L" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Up-R---.png"},
        {nreps: 1, type: "Road", name: "Merge Dn S   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "S", "L", "S", "R" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Dn-S---.png"},
        {nreps: 1, type: "Road", name: "Merge Dn L   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "S", "L", "L", "R" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Dn-L---.png"},
        {nreps: 1, type: "Road", name: "Merge Dn R   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "S", "L", "R", "R" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Dn-R---.png"},
        {nreps: 1, type: "Road", name: "Merge Lt S   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "R", "S", "L", "S" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Lt-S---.png"},
        {nreps: 1, type: "Road", name: "Merge Lt L   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "R", "S", "L", "L" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Lt-L---.png"},
        {nreps: 1, type: "Road", name: "Merge Lt R   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "R", "S", "L", "R" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Lt-R---.png"},
        {nreps: 1, type: "Road", name: "Merge Rt S   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "L", "S", "R", "S" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Rt-S---.png"},
        {nreps: 1, type: "Road", name: "Merge Rt L   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "L", "L", "R", "S" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Rt-L---.png"},
        {nreps: 1, type: "Road", name: "Merge Rt R   ", cost: 3, subtype: "Transit", ext: "Roads", props: {cardFields: "roadSpec", roadSpec: {set: [ "L", "R", "R", "S" ]}, onStep: {dist: {add: 1}, moveDir: {roadDir: "roadSpec"}}, noStop: true}, path: "Merge-Rt-R---.png"},
   ]
  }}
