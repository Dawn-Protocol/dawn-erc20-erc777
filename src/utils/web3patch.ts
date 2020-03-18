import Web3 from 'web3';

export function initWeb3(web3): Web3 {
  web3.eth.send = function (args) {
    console.log(args);
  };

  web3.eth.extend({
    methods: [
      {
        name: 'send',
        call: 'eth_chainId',
        outputFormatter: web3.utils.hexToNumber,
      },
    ],
  });

  return web3;
}
