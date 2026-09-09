import fs                                 from 'fs';
import { chain }                          from 'stream-chain';
import { parser as jsonParser }           from 'stream-json';
import { pick as jsonPick}                from 'stream-json/filters/Pick';
import { streamArray as jsonStreamArray } from 'stream-json/streamers/StreamArray';
//import { verifier as jsonVerifier }       from 'stream-json/utils/Verifier';
// need to wait for next release for verifier

export default function(filePath) {

  const readStream = fs.createReadStream(filePath);
  return chain([
    readStream,
    //jsonVerifier(),
    jsonParser(),
    jsonStreamArray()
  ]);

}
