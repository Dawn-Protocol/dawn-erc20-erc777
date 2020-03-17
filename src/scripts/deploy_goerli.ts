/**
 * Deploy all mock contracts to Goerli testnet.
 */


// Store your private key for the deployment account in this file
const privateKey = await(await fs.readFile('secrets/goerli-private-key.txt', 'utf-8')).trim();
