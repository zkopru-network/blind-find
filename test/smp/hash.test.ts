import { smpHash } from "../../src/smp/hash";

describe("smpHash", () => {
  const version1 = 1;
  const version2 = 2;
  const args1 = [BigInt(1), BigInt(2)];
  const args2 = [BigInt(2), BigInt(2)];

  test("hardcoded test", () => {
    // empty args
    expect(smpHash(version1)).toEqual(
      BigInt(
        "1231546096371168494082113088531506742407339160233558919701883037413902805264"
      )
    );
    // with args
    expect(smpHash(version1, ...args1)).toEqual(
      BigInt(
        "6431233368660948447398021585791581974263666768886972060586608603232799868977"
      )
    );
  });

  test("same versions and args", () => {
    const res1 = smpHash(version1, ...args1);
    const res2 = smpHash(version1, ...args1);
    expect(res1).toEqual(res2);
  });

  test("same versions but different args", () => {
    const res1 = smpHash(version1, ...args1);
    const res2 = smpHash(version1, ...args2);
    expect(res1).not.toEqual(res2);
  });

  test("different versions and same args", () => {
    const res1 = smpHash(version1, ...args1);
    const res2 = smpHash(version2, ...args1);
    expect(res1).not.toEqual(res2);
  });

  test("different versions and different args", () => {
    const res1 = smpHash(version1, ...args1);
    const res2 = smpHash(version2, ...args2);
    expect(res1).not.toEqual(res2);
  });
});
