import { CmClient } from "./cm-client"

describe('cm-client test', () => {
  it('should be an instance', ()=>{
    expect(new CmClient()).toBeTruthy()
  })
})