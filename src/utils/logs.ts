/**
 * A helper function to parse contract events from the tx logs.
 *
 * @param contract TruffleContract instance
 * @param log Raw event log from Web3 tx receipt
 * @param eventName Event name in the contract ABI
 */
export function decodeEvent(contract: any, log: any, eventName: string): any {
  const { web3 } = contract;

  // Iterate through al events and pick ours
  const event = Object.values(contract.events).find((eventData: any) => eventData.name === eventName) as any;
  if (!event) {
    throw new Error(`Missing in the eventABI" ${eventName}`);
  }

  // Need to remove the first topic that is the event signature
  return web3.eth.abi.decodeLog(event.inputs, log.data, log.topics.slice(1));
}

/*
    Using inputs {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: 'address',
          name: 'staker',
          type: 'address'
        },
        {
          indexed: false,
          internalType: 'uint256',
          name: 'stakeId',
          type: 'uint256'
        },
        {
          indexed: false,
          internalType: 'uint256',
          name: 'amount',
          type: 'uint256'
        },
        {
          indexed: false,
          internalType: 'uint256',
          name: 'endsAt',
          type: 'uint256'
        }
      ],
      name: 'Staked',
      type: 'event',
      constant: undefined,
      payable: undefined,
      signature: '0xb4caaf29adda3eefee3ad552a8e85058589bf834c7466cae4ee58787f70589ed'
       Result {
      '0': '0xa8E85058589BF834c7466Cae4ee58787f70589eD',
      '1': '1',
      '2': '1000',
      '3': '1585842651',
      __length__: 4,
      staker: '0xa8E85058589BF834c7466Cae4ee58787f70589eD',
      stakeId: '1',
      amount: '1000',
      endsAt: '1585842651'
    }
*/
