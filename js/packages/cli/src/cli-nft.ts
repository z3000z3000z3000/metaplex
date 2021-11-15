import { program } from 'commander';
import log from 'loglevel';
import { mintNFT, updateMetadata } from './commands/mint-nft';
import { web3 } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { arweaveUpload } from './helpers/upload/arweave';
import fs from 'fs';
import { loadCandyProgram, loadWalletKey } from './helpers/accounts';

program.version('0.0.1');
log.setLevel('info');

programCommand('mint')
  .option('-u, --url <string>', 'metadata url')
  .option('-p, --picpath <path>', `Picture`, '')
  .option('-j, --jsonpath <path>', `json file`, '')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const { keypair, env, url, picpath, jsonpath, rpcUrl } = cmd.opts();
    const solConnection = new web3.Connection(web3.clusterApiUrl(env));
    const walletKeyPair = loadWalletKey(keypair);
    let link = url;
    if (picpath !== '' && jsonpath != '') {
      log.info('pic = ', picpath);
      log.info('json = ', jsonpath);

      const walletKeyPair = loadWalletKey(keypair);
      const anchorProgram = await loadCandyProgram(walletKeyPair, env, rpcUrl);
      const manifestContent = fs.readFileSync(jsonpath).toString();
      const manifest = JSON.parse(manifestContent);

      const manifestBuffer = Buffer.from(JSON.stringify(manifest));
      link = await arweaveUpload(
        walletKeyPair,
        anchorProgram,
        env,
        picpath,
        manifestBuffer,
        manifest,
        0,
      );
    } else if (url == '') {
      throw new Error('Set url or pic & json');
    }
    await mintNFT(solConnection, walletKeyPair, link);
  });

programCommand('update-metadata')
  .option('-m, --mint <string>', 'base58 mint key')
  .option('-u, --url <string>', 'metadata url')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const { keypair, env, mint, url } = cmd.opts();
    const mintKey = new PublicKey(mint);
    const solConnection = new web3.Connection(web3.clusterApiUrl(env));
    const walletKeyPair = loadWalletKey(keypair);
    await updateMetadata(mintKey, solConnection, walletKeyPair, url);
  });

function programCommand(name: string) {
  return program
    .command(name)
    .option(
      '-e, --env <string>',
      'Solana cluster env name',
      'devnet', //mainnet-beta, testnet, devnet
    )
    .option(
      '-k, --keypair <path>',
      `Solana wallet location`,
      '--keypair not provided',
    )
    .option(
      '-r, --rpc-url <string>',
      'custom rpc url since this is a heavy command',
    )
    .option('-l, --log-level <string>', 'log level', setLogLevel);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setLogLevel(value, prev) {
  if (value === undefined || value === null) {
    return;
  }
  log.info('setting the log value to: ' + value);
  log.setLevel(value);
}

program.parse(process.argv);
