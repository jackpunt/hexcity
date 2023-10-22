import { Event, EventDispatcher } from '@thegraid/easeljs-module';
import { S } from './basic-intfs';
import { Card, SlotInfo } from './card';
import { CardContainer } from './card-container';

/** send a simple value of type to target. */
export class ValueEvent extends Event {
  value: number | string;
  constructor(type: string, value: number | string) {
    super(type, true, true);
    this.value = value;
  }
  static dispatchValueEvent(target: EventDispatcher, type: string, value: number | string): boolean {
    return target.dispatchEvent(new ValueEvent(type, value));
  }
}
/**
 * A Card action of type occuring at row, col of CardContainer.
 *
 * construct & dispatch with: cont.dispatchCardEvent(S_type, row, col)
 */

 export class CardEvent extends ValueEvent implements SlotInfo {
  //card: Card; row: number; col: number; cont: CardContainer; fromNet: boolean = false;
  constructor(type: string, 
    public card: Card, 
    public row: number = 0, public col: number = 0, 
    public cont: CardContainer = undefined, 
    public fromNet = false) {
    super(type, 0);
    this.bubbles = (type === S.dragStart);
  }
}
