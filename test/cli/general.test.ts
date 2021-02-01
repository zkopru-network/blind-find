import { expect } from 'chai';
import { exec, parsePrintedObj } from './utils';

describe("General commands", () => {
  it("genKeypair", () => {
    const output = exec('general genKeypair').stdout;
    const obj = parsePrintedObj(output);
    console.log(obj);
    expect(obj.privKey).not.to.be.undefined;
    expect(obj.pubKey).not.to.be.undefined;
    expect(obj.pubKeyInBase64).not.to.be.undefined;
  });
});
