import { Stage } from '@thegraid/easeljs-module';
import { stime } from '@thegraid/common-lib';
import { EzPromise } from '@thegraid/ezpromise';
import { S } from './basic-intfs';
import { Card, Deck, Stack } from './card';
import { EventDeck } from './cardinfo/event-deck';
import { HomeDeck } from './cardinfo/home-deck';
import { TileDeck } from './cardinfo/tile-deck';
import { ChooseDir, DirSpec } from './choose-dir';
import { Effects } from './effects';
import { GameSetup } from './game-setup';
import { MainMap } from './main-map';
import { Player } from './player';
import { Table } from './table';

function theCard(deck: Deck, name: string): Card {
  let card = new Card(deck.cards.find(ci => ci.name == name), 1, minTable)
  card.slotInfo = { row: 0, col: 0, cont: null }
  return card
}
var homeCards = new Stack([])
var gameSetup = new GameSetup(null)
var minTable = gameSetup.table
minTable.homeCards = homeCards // no Table.layout
var mainMap = minTable.mainMap = new MainMap({ width: 4, height: 4 })
minTable.stage.addChild(mainMap)
var homeCard = theCard(HomeDeck.deck, "Home-RED")
var ownerCard = theCard(HomeDeck.deck, "Owner-RED-0")
homeCards.pushCards([homeCard, ownerCard])
var minPlayer = new Player(minTable, "RED", null, null)// no dirCards/dirDiscards
minTable.allPlayers.push(minPlayer)
minTable.curPlayerNdx = 0
minTable.curPlayer = minPlayer
minTable.chooseDir = new ChooseDir(minTable)
minPlayer.homeCard = homeCard // although: homeCard has not slotInfo.. is not actually on Table
var atmCard = theCard(TileDeck.deck, "ATM")
mainMap.addCard(homeCard, 1, 1)
mainMap.addCard(atmCard, 2, 2)
minPlayer.curCard = atmCard
atmCard.setOwner(minPlayer)
minPlayer._coins = 20

const chooseDir: ChooseDir = minTable.chooseDir

describe('Effects', () => {
  {
    console.log(stime(), "Time begin")
    let effects: Effects = Effects.effects;
    let card: Card = theCard(EventDeck.deck, "Eminent Domain")
    let atm: Card = atmCard
    atm.rentAdjust = atm.rent
    let inc: number = atm.costn // Eminent Domain pays just the build cost
    let out: number = atm.costn + atm.rent + 2 // re-Purchase costs extra (GamePlay.offerBuyTile)
    let player: Player = minPlayer
    let coins = player.coins
    let cd: ChooseDir = chooseDir
    let buy = true
    let dir = (buy ? S.E : S.W) as keyof DirSpec // East == "Yes", West == "No"

    test('Eminent Domain', () => {
      console.log(stime(), "Time effects Start! rv =", cd.rv)
      effects.doEffectsOfEvent(card, player) // opens ChooseDir
      console.log(stime(), "Time effects Done! rv =", cd.rv)
      console.log(stime(), "Time atm.owner =", atm.owner, "coins =", player.coins, "inc=", inc, "out=", out)
      expect(player.coins).toBe(coins + inc)
      expect(atm.owner).toBeUndefined()
      expect(effects.dataRecs.length).toBe(0)      // addDR & removeDR
      setTimeout(() => cd.buttonClickDir(dir), 50) // Click button: East == "Yes", West == "No"
    })
    test(buy ? 'buyIt' : 'notBuy', (done) => {
      console.debug(stime(), buy, "rv=", cd.rv)
      return cd.rv.then((cd: ChooseDir) => {
        console.log(stime(), `player.coins = ${player.coins} atm.owner = ${atm.owner && atm.owner.name} cd.dir=${cd.button} cd.prompt=${cd.buttons[S.N].cost}`)
        setTimeout(() => {
          console.log(stime(), `Time of expects`)
          expect(cd.button).toBe(dir)
          expect(player.coins).toBe(coins + inc - (buy ? out : 0))
          expect(atm.owner).toBe(buy ? player : undefined)
          expect(effects.dataRecs.length).toBe(0)
          console.log(stime(), "Time Check Expectations! rv = ", cd.rv)
          setTimeout(() => done(), 100) // wait for console.log
        }, 300) // wait for post-click effects to run
      })
    }, 1000)    // testTimeout
  }
});
