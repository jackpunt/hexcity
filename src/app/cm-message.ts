import { json } from '@thegraid/common-lib';
import { IGgMessage, Rost } from '@thegraid/wspbclient';
import { CmMsgBase, CmSlot, CmType, KVpair, TypedMsg } from '../proto/CmProto';

export { CmSlot, CmType, KVpair, Rost, TypedMsg };

type CmObjType = ReturnType<CmMsgBase['toObject']>
type CMMK = keyof CmObjType
/** keys to supply to new CmMessage() --> new CmMsgBase() */
export type CmMessageOpts = Partial<Pick<CmMsgBase, CMMK>>
/** keys CmMessage sans 'type' */
export type CmMessageOptT = Partial<Pick<CmMsgBase, Exclude<CMMK, 'type'>>>

/** typeof internal msgObject */
type CmMessageOptsX = CmObjType & { msgType: string }
/** typeof CmMessage.msgObject */
export type CmMessageOptsW = { -readonly [key in keyof CmMessageOptsX] : CmMessageOptsX[key] }

type CmConsType = { -readonly [key in keyof Partial<Pick<CmMsgBase, CMMK>>] : CmMsgBase[key] }


export class CmMessage extends CmMsgBase implements IGgMessage {

  constructor(opts: CmConsType) {
    super(opts)
  }
  //declare toObject: () => ReturnType<CmMsgBase['toObject']>
  override toObject(): ReturnType<CmMsgBase['toObject']> { return super.toObject()}
  client_from: number
  get msgType() { return CmType[this.type] }
  /**
   * like toObject(), but only the supplied fields
   * and replace 'type: number' with 'msgType: string'
   */
  get msgObject(): {} {
    let msgObject = { msgType: `${this.msgType}(${this.type})`} as CmMessageOptsW
    if (this.has_name) msgObject.name = this.name
    if (this.has_inform) msgObject.inform = this.inform
    if (this.has_player) msgObject.player = this.player
    if (this.has_srcSlot) msgObject.srcSlot = this.srcSlot
    if (this.has_dstSlot) msgObject.dstSlot = this.dstSlot
    if (this.has_count) msgObject.count = this.count
    if (this.has_client_to) msgObject.client_to = this.client_to
    // Note: roster only meaningful when msgType == 'join(8)'
    if (this.has_roster && this.roster.length > 0) msgObject.roster = this.roster.map((item: Rost) => item.toObject())
    if (this.has_params && this.params.length > 0) msgObject.params = this.params
    return msgObject
  }
  get msgString() { return json(this.msgObject) }

  static override deserialize<CmMessage>(data: Uint8Array) {
    let newMsg = undefined as CmMessage
    if (data == undefined) return newMsg
    newMsg = CmMsgBase.deserialize(data) as any as CmMessage
    if (newMsg instanceof CmMsgBase) {
      Object.setPrototypeOf(newMsg, CmMessage.prototype)
    }
    return newMsg
  }
}
