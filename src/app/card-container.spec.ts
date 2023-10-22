import { WH } from './basic-intfs';
import { CardContainer } from './card-container';

describe('DeckContainer', () => {
  it('should create an instance', () => {
    expect(new CardContainer(({width:10, height:20} as WH))).toBeTruthy();
  });
});
