import { ValueError } from "../../src/smp/exceptions";
import {
  concatUint8Array,
  bigIntMod,
  bigIntToNumber
} from "../../src/smp/utils";

describe("concatUint8Array", () => {
  test("hardcoded", () => {
    expect(
      concatUint8Array(new Uint8Array([1, 2]), new Uint8Array([3, 4]))
    ).toEqual(new Uint8Array([1, 2, 3, 4]));
    // Empty arrays
    expect(concatUint8Array(new Uint8Array([]), new Uint8Array([1]))).toEqual(
      new Uint8Array([1])
    );
    expect(concatUint8Array(new Uint8Array([1]), new Uint8Array([]))).toEqual(
      new Uint8Array([1])
    );
    expect(concatUint8Array(new Uint8Array([]), new Uint8Array([]))).toEqual(
      new Uint8Array([])
    );
  });
});

describe("bigIntMod", () => {
  const q = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
  );

  test("hardcoded", () => {
    const a = BigInt(
      "12350799673640152078144389212123809330647896951221663664769859697924356047240"
    );
    const b = BigInt(
      "18371887503246000182496039228355926204464651690265472044185703954782114646193"
    );
    const expectedRes = BigInt(
      "8834444305046877038394022695222460446564184241071101365257359466130662197816"
    );
    expect(bigIntMod(a + b, q)).toEqual(expectedRes);
  });

  test("negative", () => {
    const a = BigInt(-1);
    const expectedRes = BigInt(q) - BigInt(1);
    expect(bigIntMod(a, q)).toEqual(expectedRes);
  });
});

describe("bigIntToNumber", () => {
  test("succeeds", () => {
    bigIntToNumber(BigInt(Number.MAX_SAFE_INTEGER));
    bigIntToNumber(BigInt(0));
    bigIntToNumber(BigInt(Number.MIN_SAFE_INTEGER));
  });

  test("fails", () => {
    expect(() => {
      bigIntToNumber(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1));
    }).toThrowError(ValueError);
    expect(() => {
      bigIntToNumber(BigInt(Number.MIN_SAFE_INTEGER) - BigInt(1));
    }).toThrowError(ValueError);
  });
});
