import { BabyJubPoint } from "../../src/smp/v4/babyJub";
import { G } from "../../src/smp/v4/state";

import { expect } from 'chai';

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
  it("should be equal if both `n` and `value` are the same", () => {
    expect(g1.equal(g1)).to.be.true;
  });
  it("should not be equal if `value`s are not the same", () => {
    expect(g1.equal(g2)).to.be.false;
  });
});

describe("isValid", () => {
  it("should be invalid if the value and modulus are not co-prime", () => {
    const gInvalid = new BabyJubPoint([BigInt(1), BigInt(0)]);
    expect(gInvalid.isValid()).to.be.false;
  });
  it("should be valid if the value and modulus are co-prime", () => {
    expect(gIdentity.isValid()).to.be.true;
    expect(gBase.isValid()).to.be.true;
    expect(g1.isValid()).to.be.true;
    expect(g2.isValid()).to.be.true;
    expect(g1Add2.isValid()).to.be.true;
    expect(g3.isValid()).to.be.true;
    expect(g3Inverse.isValid()).to.be.true;
    expect(g3Squared.isValid()).to.be.true;
  });
});

describe("identity", () => {
  it("hardcoded test", () => {
    expect(g1.identity().equal(gIdentity)).to.be.true;
  });
  it("every group element with the same modulus shares the same identity", () => {
    expect(g1.identity().equal(g2.identity())).to.be.true;
  });
});

describe("inverse", () => {
  it("hardcoded test", () => {
    expect(g3.inverse().equal(g3Inverse)).to.be.true;
  });
});

describe("operate", () => {
  it("operate with identity", () => {
    expect(g1.operate(g1.identity()).equal(g1)).to.be.true;
  });
  it("operate with inverse", () => {
    expect(g3.operate(g3.inverse()).equal(g3.identity())).to.be.true;
  });
  it("hardcoded test", () => {
    expect(g1.operate(g2).equal(g1Add2)).to.be.true;
  });
});

describe("exponentiate", () => {
  it("hardcoded test", () => {
    expect(g3.exponentiate(BigInt(2)).equal(g3Squared)).to.be.true;
  });
  it("exponentiate 0", () => {
    expect(g3.exponentiate(BigInt(0)).equal(g3.identity())).to.be.true;
  });
  it("exponentiation equals continuous multiplications", () => {
    expect(g3.exponentiate(BigInt(1)).equal(g3)).to.be.true;
    expect(g3.exponentiate(BigInt(2)).equal(g3.operate(g3))).to.be.true;
  });
  it("exponentiate negative integers", () => {
    expect(
      g3.exponentiate(BigInt(-2)).equal(g3.exponentiate(BigInt(2)).inverse())
    ).to.be.true;
  });
});
