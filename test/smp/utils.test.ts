import { ValueError } from "../../src/smp/exceptions";
import {
  concatUint8Array,
  bigIntMod,
  bigIntToNumber
} from "../../src/smp/utils";

import { expect } from 'chai';

describe("concatUint8Array", () => {
  it("hardcoded", () => {
    expect(
      concatUint8Array(new Uint8Array([1, 2]), new Uint8Array([3, 4]))
    ).to.eql(new Uint8Array([1, 2, 3, 4]));
    // Empty arrays
    expect(concatUint8Array(new Uint8Array([]), new Uint8Array([1]))).to.eql(
      new Uint8Array([1])
    );
    expect(concatUint8Array(new Uint8Array([1]), new Uint8Array([]))).to.eql(
      new Uint8Array([1])
    );
    expect(concatUint8Array(new Uint8Array([]), new Uint8Array([]))).to.eql(
      new Uint8Array([])
    );
  });
});

describe("bigIntMod", () => {
  const q = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
  );

  it("hardcoded", () => {
    const a = BigInt(
      "12350799673640152078144389212123809330647896951221663664769859697924356047240"
    );
    const b = BigInt(
      "18371887503246000182496039228355926204464651690265472044185703954782114646193"
    );
    const expectedRes = BigInt(
      "8834444305046877038394022695222460446564184241071101365257359466130662197816"
    );
    expect(bigIntMod(a + b, q)).to.eql(expectedRes);
  });

  it("negative", () => {
    const a = BigInt(-1);
    const expectedRes = BigInt(q) - BigInt(1);
    expect(bigIntMod(a, q)).to.eql(expectedRes);
  });
});

describe("bigIntToNumber", () => {
  it("succeeds", () => {
    bigIntToNumber(BigInt(Number.MAX_SAFE_INTEGER));
    bigIntToNumber(BigInt(0));
    bigIntToNumber(BigInt(Number.MIN_SAFE_INTEGER));
  });

  it("fails", () => {
    expect(() => {
      bigIntToNumber(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1));
    }).to.throw(ValueError);
    expect(() => {
      bigIntToNumber(BigInt(Number.MIN_SAFE_INTEGER) - BigInt(1));
    }).to.throw(ValueError);
  });
});
