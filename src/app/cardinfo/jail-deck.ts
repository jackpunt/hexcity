import { Deck } from '../card'
import { C } from '../basic-intfs'
/** This class and file are auto-generated do not edit. */
export class JailDeck {
   static deck: Deck = {
      name: 'JailDeck',
      cards: [
        {nreps: 2, type: "Event", name: "Busted", cost: null, step: 2, subtype: "Gov", ext: "Event", props: {event: {withPlayer: {this_player: {when: {goTo: {name: "Jail"}}, else: {buys: {set: 0}, builds: {set: 0}, polis: {set: 0}}}}}}, path: "Busted.png"},
        {nreps: 1, type: "Event", name: "Accounting Fraud", cost: null, step: 2, subtype: "Gov", ext: "Event", props: {event: {withPlayer: {high_total_cash: {when: {goTo: {name: "Jail"}}, else: {buys: {set: 0}, builds: {set: 0}, polis: {set: 0}}}}}}, path: "Accounting-Fraud-cash.png"},
        {nreps: 1, type: "Event", name: "Investment Fraud", cost: null, step: 2, subtype: "Gov", ext: "Event", props: {event: {withPlayer: {high_total_cost: {when: {goTo: {name: "Jail"}}, else: {buys: {set: 0}, builds: {set: 0}, polis: {set: 0}}}}}}, path: "Investment-Fraud-property.png"},
        {nreps: 1, type: "Event", name: "Price Gouging", cost: null, step: 2, subtype: "Gov", ext: "Event", props: {event: {withPlayer: {high_total_rent: {when: {goTo: {name: "Jail"}}, else: {buys: {set: 0}, builds: {set: 0}, polis: {set: 0}}}}}}, path: "Price-Gouging-rent.png"},
        {nreps: 1, type: "Event", name: "Construction Fraud", cost: null, step: 2, subtype: "Gov", ext: "Event", props: {event: {withPlayer: {high_total_roads: {when: {goTo: {name: "Jail"}}, else: {buys: {set: 0}, builds: {set: 0}, polis: {set: 0}}}}}}, path: "Construction-Fraud-roads.png"},
   ]
  }}
