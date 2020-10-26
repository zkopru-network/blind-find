import { BabyJubPoint } from "../../src/smp/babyJub";
import { G } from "../../src/smp/state";

const gIdentity = new BabyJubPoint([BigInt(0), BigInt(1)]);
const gBase = new BabyJubPoint(G);
const g1 = new BabyJubPoint([
  BigInt(
    "17777552123799933955779906779655732241715742912184938656739573121738514868268"
  ),
  BigInt(
    "2626589144620713026669568689430873010625803728049924121243784502389097019475"
  )
]);
const g2 = new BabyJubPoint([
  BigInt(
    "16540640123574156134436876038791482806971768689494387082833631921987005038935"
  ),
  BigInt(
    "20819045374670962167435360035096875258406992893633759881276124905556507972311"
  )
]);
const g1Add2 = new BabyJubPoint([
  BigInt(
    "7916061937171219682591368294088513039687205273691143098332585753343424131937"
  ),
  BigInt(
    "14035240266687799601661095864649209771790948434046947201833777492504781204499"
  )
]);
const g3 = new BabyJubPoint([
  BigInt(
    "18261725078265092614434811797527239590734399126978701676813159791074850292972"
  ),
  BigInt(
    "538454765038134890313876770948423938647861892610414957151407612591625161882"
  )
]);
const g3Inverse = new BabyJubPoint([
  BigInt(
    "3626517793574182607811593947730035497813965273437332666885044395500958202645"
  ),
  BigInt(
    "538454765038134890313876770948423938647861892610414957151407612591625161882"
  )
]);
const g3Squared = new BabyJubPoint([
  BigInt(
    "514977334629920563682694145743151202274854875685861818727107193152252813031"
  ),
  BigInt(
    "975307299993603730749194759249385604570748703788292498705920558017605567278"
  )
]);

describe("equal", () => {
  test("should be equal if both `n` and `value` are the same", () => {
    expect(g1.equal(g1)).toBeTruthy();
  });
  test("should not be equal if `value`s are not the same", () => {
    expect(g1.equal(g2)).toBeFalsy();
  });
});

describe("isValid", () => {
  test("should be invalid if the value and modulus are not co-prime", () => {
    const gInvalid = new BabyJubPoint([BigInt(1), BigInt(0)]);
    expect(gInvalid.isValid()).toBeFalsy();
  });
  test("should be valid if the value and modulus are co-prime", () => {
    expect(gIdentity.isValid()).toBeTruthy();
    expect(gBase.isValid()).toBeTruthy();
    expect(g1.isValid()).toBeTruthy();
    expect(g2.isValid()).toBeTruthy();
    expect(g1Add2.isValid()).toBeTruthy();
    expect(g3.isValid()).toBeTruthy();
    expect(g3Inverse.isValid()).toBeTruthy();
    expect(g3Squared.isValid()).toBeTruthy();
  });
});

describe("identity", () => {
  test("hardcoded test", () => {
    expect(g1.identity().equal(gIdentity)).toBeTruthy();
  });
  test("every group element with the same modulus shares the same identity", () => {
    expect(g1.identity().equal(g2.identity())).toBeTruthy();
  });
});

describe("inverse", () => {
  test("hardcoded test", () => {
    expect(g3.inverse().equal(g3Inverse)).toBeTruthy();
  });
});

describe("operate", () => {
  test("operate with identity", () => {
    expect(g1.operate(g1.identity()).equal(g1)).toBeTruthy();
  });
  test("operate with inverse", () => {
    expect(g3.operate(g3.inverse()).equal(g3.identity())).toBeTruthy();
  });
  test("hardcoded test", () => {
    expect(g1.operate(g2).equal(g1Add2)).toBeTruthy();
  });
});

describe("exponentiate", () => {
  test("hardcoded test", () => {
    expect(g3.exponentiate(BigInt(2)).equal(g3Squared)).toBeTruthy();
  });
  test("exponentiate 0", () => {
    expect(g3.exponentiate(BigInt(0)).equal(g3.identity())).toBeTruthy();
  });
  test("exponentiation equals continuous multiplications", () => {
    expect(g3.exponentiate(BigInt(1)).equal(g3)).toBeTruthy();
    expect(g3.exponentiate(BigInt(2)).equal(g3.operate(g3))).toBeTruthy();
  });
  test("exponentiate negative integers", () => {
    expect(
      g3.exponentiate(BigInt(-2)).equal(g3.exponentiate(BigInt(2)).inverse())
    ).toBeTruthy();
  });
});
