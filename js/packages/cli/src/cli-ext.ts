import { program } from 'commander';
import log from 'loglevel';

import * as fs from 'fs';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { arweaveUpload } from './helpers/upload/arweave';
import { loadCandyProgram, loadWalletKey } from './helpers/accounts';
program.version('1.1.0');
log.setLevel('info');

programCommand('arweaveupload')
  .option('-p, --picpath <path>', 'Picture', '')
  .option('-j, --jsonpath <path>', 'json file', '')
  .option(
    '-r, --rpc-url <string>',
    'custom rpc url since this is a heavy command',
  )
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const { keypair, env, picpath, jsonpath, rpcUrl } = cmd.opts();
    if (rpcUrl) console.log('USING CUSTOM URL', rpcUrl);
    if (picpath == '' && jsonpath == '') {
      throw new Error('Set url or pic & json');
    }
    log.info('pic = ', picpath);
    log.info('json = ', jsonpath);
    const imghash = crypto
      .createHash('md5')
      .update(fs.readFileSync(picpath))
      .digest('hex');
    console.log('img md5 = ', imghash);

    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram = await loadCandyProgram(walletKeyPair, env, rpcUrl);
    const manifestContent = fs.readFileSync(jsonpath).toString();
    const manifest = JSON.parse(manifestContent);

    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const [link, imgLink] = await arweaveUpload(
      walletKeyPair,
      anchorProgram,
      env,
      picpath,
      manifestBuffer,
      manifest,
      'image',
    );
    //console.log('imglink = ', imgLink);

    let tosleep = 1000;
    let waitingTime = 0;
    let verified = false;

    for (let it = 0; it < 8; it++) {
      let metadata;
      let imgdata;
      let isOk = true;
      try {
        log.info(
          'verify iter=',
          it,
          ' link=',
          link,
          ', waiting = ',
          waitingTime,
        );
        metadata = await (await fetch(link, { method: 'GET' })).json();
        if (
          !metadata.name ||
          !metadata.image ||
          !(
            metadata.image == imgLink ||
            metadata.image.substring(12) == imgLink.substring(8)
          ) ||
          isNaN(metadata.seller_fee_basis_points) ||
          !metadata.properties ||
          !Array.isArray(metadata.properties.creators)
        ) {
          log.error('= ', metadata.image);
          log.error('= ', imgLink);
          log.error('Invalid metadata file', metadata);
          isOk = false;
        } else {
          log.info('metadata file ok:', metadata);
        }
        imgdata = await (await fetch(imgLink, { method: 'GET' })).buffer();
        if (
          !imgdata ||
          imghash != crypto.createHash('md5').update(imgdata).digest('hex')
        ) {
          log.error('Invalid image file', imgdata);
          log.error(
            'hash: ',
            imghash,
            ' inet hash = ',
            crypto.createHash('md5').update(imgdata).digest('hex'),
          );
          isOk = false;
        } else {
          log.info('Image file ok:', imgLink);
        }
        if (isOk) {
          verified = true;
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
    if (verified) {
      console.log('Upload json+img done, link=', link, imgLink);
    } else {
      console.log(
        '(not verified) Upload json+img FAILED, link=',
        link,
        imgLink,
      );
    }
    // await mintNFT(solConnection, owner, walletKeyPair, link);
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
