import {
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs
} from "./proofs";

import { TLV } from "./serialization";

import { NotImplemented } from "./exceptions";
import { IGroup } from "./interfaces";

class BaseSMPMessage {
  static fromTLV(_: TLV): BaseSMPMessage {
    throw new NotImplemented("not implemented");
  }
  toTLV(): TLV {
    throw new NotImplemented("not implemented");
  }
}

/**
 * SMP message 1 is sent by Alice to begin a DH exchange to determine two new generators, g2 and g3.
 * It contains the following mpi values:
 *  g2a
 *    Alice's half of the DH exchange to determine g2.
 *  c2, D2
 *    A zero-knowledge proof that Alice knows the exponent associated with her transmitted value
 *    g2a.
 *  g3a
 *    Alice's half of the DH exchange to determine g3.
 *  c3, D3
 *    A zero-knowledge proof that Alice knows the exponent associated with her transmitted value
 *    g3a.
 */
class SMPMessage1 extends BaseSMPMessage {
  constructor(
    readonly g2a: IGroup,
    readonly g2aProof: ProofDiscreteLog,
    readonly g3a: IGroup,
    readonly g3aProof: ProofDiscreteLog
  ) {
    super();
  }
}

/**
 * SMP message 2 is sent by Bob to complete the DH exchange to determine the new generators,
 * g2 and g3. It also begins the construction of the values used in the final comparison of
 * the protocol. It contains the following mpi values:
 *  g2b
 *    Bob's half of the DH exchange to determine g2.
 *  c2, D2
 *    A zero-knowledge proof that Bob knows the exponent associated with his transmitted value g2b.
 *  g3b
 *    Bob's half of the DH exchange to determine g3.
 *  c3, D3
 *    A zero-knowledge proof that Bob knows the exponent associated with his transmitted value g3b.
 *  Pb, Qb
 *    These values are used in the final comparison to determine if Alice and Bob share the
 *    same secret.
 *  cP, D5, D6
 *    A zero-knowledge proof that Pb and Qb were created according to the protcol given above.
 */
class SMPMessage2 extends BaseSMPMessage {
  constructor(
    readonly g2b: IGroup,
    readonly g2bProof: ProofDiscreteLog,
    readonly g3b: IGroup,
    readonly g3bProof: ProofDiscreteLog,
    readonly pb: IGroup,
    readonly qb: IGroup,
    readonly pbqbProof: ProofEqualDiscreteCoordinates
  ) {
    super();
  }
}

/**
 * SMP message 3 is Alice's final message in the SMP exchange. It has the last of the information
 * required by Bob to determine if x = y. It contains the following mpi values:
 *  Pa, Qa
 *    These values are used in the final comparison to determine if Alice and Bob share the
 *    same secret.
 *  cP, D5, D6
 *    A zero-knowledge proof that Pa and Qa were created according to the protcol given above.
 *  Ra
 *    This value is used in the final comparison to determine if Alice and Bob share
 *    the same secret.
 *  cR, D7
 *    A zero-knowledge proof that Ra was created according to the protcol given above.
 */
class SMPMessage3 extends BaseSMPMessage {
  constructor(
    readonly pa: IGroup,
    readonly qa: IGroup,
    readonly paqaProof: ProofEqualDiscreteCoordinates,
    readonly ra: IGroup,
    readonly raProof: ProofEqualDiscreteLogs
  ) {
    super();
  }
}

/**
 * SMP message 4 is Bob's final message in the SMP exchange. It has the last of the information
 * required by Alice to determine if x = y. It contains the following mpi values:
 *  Rb
 *    This value is used in the final comparison to determine if Alice and Bob share the
 *    same secret.
 *  cR, D7
 *    A zero-knowledge proof that Rb was created according to the protcol given above.
 */
class SMPMessage4 extends BaseSMPMessage {
  constructor(readonly rb: IGroup, readonly rbProof: ProofEqualDiscreteLogs) {
    super();
  }
}

export { BaseSMPMessage, SMPMessage1, SMPMessage2, SMPMessage3, SMPMessage4 };
