import { program } from 'commander';
import log from 'loglevel';
import { mintNFT, updateMetadata } from './commands/mint-nft';
import { web3 } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { arweaveUpload } from './helpers/upload/arweave';
import fs from 'fs';
import { loadCandyProgram, loadWalletKey } from './helpers/accounts';
import fetch from 'node-fetch';

program.version('0.0.1');
log.setLevel('info');

programCommand('mint')
  .option('-u, --url <string>', 'metadata url')
  .option('-p, --picpath <path>', 'Picture', '')
  .option('-j, --jsonpath <path>', 'json file', '')
  .option('-o, --owner <pubkey>', '', '')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const { keypair, env, url, picpath, jsonpath, owner, rpcUrl } = cmd.opts();
    if (rpcUrl) console.log('USING CUSTOM URL', rpcUrl);
    const solConnection = new web3.Connection(
      rpcUrl || web3.clusterApiUrl(env),
    );
    const walletKeyPair = loadWalletKey(keypair);
    let link = url;
    //    let ll = "https://arweave.net/VGa-4DbXKuPdff0iIWpGUPm-NfhKKku-ai-YmciY0jo";
    //    let metadata = await (await fetch(ll, { method: 'GET' })).json();
    //          if (
    //            !metadata.name ||
    //            !metadata.image ||
    //            isNaN(metadata.seller_fee_basis_points) ||
    //            !metadata.properties ||
    //            !Array.isArray(metadata.properties.creators)
    //          ) {
    //            log.error('Invalid metadata file', metadata);
    //          }
    //    log.info("metadata:", metadata);
    if (picpath !== '' && jsonpath != '') {
      log.info('pic = ', picpath);
      log.info('json = ', jsonpath);

      const walletKeyPair = loadWalletKey(keypair);
      const anchorProgram = await loadCandyProgram(walletKeyPair, env, rpcUrl);
      const manifestContent = fs.readFileSync(jsonpath).toString();
      const manifest = JSON.parse(manifestContent);

      const manifestBuffer = Buffer.from(JSON.stringify(manifest));
      let imgLink;
      [link, imgLink] = await arweaveUpload(
        walletKeyPair,
        anchorProgram,
        env,
        picpath,
        manifestBuffer,
        manifest,
        0,
      );
      console.log('imglink = ', imgLink);
    } else if (url == '') {
      throw new Error('Set url or pic & json');
    }

    // ...
    let tosleep = 1000;
    let waitingTime = 0;
    for (let it = 0; it < 14; it++) {
      let metadata;
      try {
        log.info('>>>', it, ' link=', link, ', waiting = ', waitingTime);
        metadata = await (await fetch(link, { method: 'GET' })).json();
        if (
          !metadata.name ||
          !metadata.image ||
          isNaN(metadata.seller_fee_basis_points) ||
          !metadata.properties ||
          !Array.isArray(metadata.properties.creators)
        ) {
          log.error('Invalid metadata file', metadata);
        } else {
          log.info('metadata file ok:', metadata);
          break;
        }
      } catch (e) {
        log.debug(e);
        log.error('Invalid metadata at', link, 'just wait...');
      }
      await new Promise(f => setTimeout(f, tosleep));
      waitingTime += tosleep;
      tosleep *= 2;
    }
    await mintNFT(solConnection, owner, walletKeyPair, link);
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
