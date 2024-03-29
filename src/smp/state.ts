/**
 * SMP state and state machine
 */
import {
  InvalidGroupElement,
  InvalidProof,
  ValueError,
  NotImplemented,
  SMPNotFinished
} from "./exceptions";
import { IGroup, ISMPState, ISMPConfig } from "./interfaces";
import { SMPMessage1, SMPMessage2, SMPMessage3, SMPMessage4 } from "./msgs";
import {
  makeProofDiscreteLog,
  verifyProofDiscreteLog,
  makeProofEqualDiscreteLogs,
  verifyProofEqualDiscreteLogs,
  makeProofEqualDiscreteCoordinates,
  verifyProofEqualDiscreteCoordinates,
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs
} from "./proofs";
import { TLV } from "./serialization";
import { TypeTLVOrNull, THashFunc } from "./types";

/**
 * Base class for SMP states. `BaseSMPState` contains configs and provides helper functions.
 * `transit` and `getResult` need to be implemented by the subclasses.
 */
abstract class BaseSMPState implements ISMPState {
  // Public
  readonly q: BigInt;
  readonly g1: IGroup;

  /**
   * Hash function used by SMP protocol. A `version` is prefixed before inputs.
   */
  getHashFunc: (version: number) => THashFunc;
  /**
   * Generate a random integer in scalar's field.
   */
  getRandomSecret: () => BigInt;

  constructor(readonly x: BigInt, readonly config: ISMPConfig) {
    this.q = config.q;
    this.g1 = config.g1;
    this.getHashFunc = config.getHashFunc;
    this.getRandomSecret = config.getRandomSecret;
  }

  abstract transit(msg: TypeTLVOrNull): [ISMPState, TypeTLVOrNull];
  abstract getResult(): boolean | null;

  createSMPMessage1(
    g2a: IGroup,
    g2aProof: ProofDiscreteLog,
    g3a: IGroup,
    g3aProof: ProofDiscreteLog
  ): SMPMessage1 {
    return new this.config.wireFormats.SMPMessage1(
      g2a,
      g2aProof,
      g3a,
      g3aProof
    );
  }
  parseSMPMessage1(msg: TLV) {
    return this.config.wireFormats.SMPMessage1.fromTLV(msg) as SMPMessage1;
  }
  createSMPMessage2(
    g2b: IGroup,
    g2bProof: ProofDiscreteLog,
    g3b: IGroup,
    g3bProof: ProofDiscreteLog,
    pb: IGroup,
    qb: IGroup,
    pbqbProof: ProofEqualDiscreteCoordinates
  ): SMPMessage2 {
    return new this.config.wireFormats.SMPMessage2(
      g2b,
      g2bProof,
      g3b,
      g3bProof,
      pb,
      qb,
      pbqbProof
    );
  }
  parseSMPMessage2(msg: TLV) {
    return this.config.wireFormats.SMPMessage2.fromTLV(msg) as SMPMessage2;
  }
  createSMPMessage3(
    pa: IGroup,
    qa: IGroup,
    paqaProof: ProofEqualDiscreteCoordinates,
    ra: IGroup,
    raProof: ProofEqualDiscreteLogs
  ): SMPMessage3 {
    return new this.config.wireFormats.SMPMessage3(
      pa,
      qa,
      paqaProof,
      ra,
      raProof
    );
  }
  parseSMPMessage3(msg: TLV) {
    return this.config.wireFormats.SMPMessage3.fromTLV(msg) as SMPMessage3;
  }
  createSMPMessage4(rb: IGroup, rbProof: ProofEqualDiscreteLogs): SMPMessage4 {
    return new this.config.wireFormats.SMPMessage4(rb, rbProof);
  }
  parseSMPMessage4(msg: TLV) {
    return this.config.wireFormats.SMPMessage4.fromTLV(msg) as SMPMessage4;
  }

  /**
   * Make Diffie-Hellman public key from secretKey`.
   * @param version - Used when generating the proof.
   * @param secretKey - Our private key.
   */
  makeDHPubkey(version: number, secretKey: BigInt): [IGroup, ProofDiscreteLog] {
    const pubkey = this.g1.exponentiate(secretKey);
    const proof = makeProofDiscreteLog(
      this.getHashFunc(version),
      this.g1,
      secretKey,
      this.getRandomSecret(),
      this.q
    );
    return [pubkey, proof];
  }

  /**
   * Verify a Diffie-Hellman public key with its proof, generated by `makeDHPubkey`.
   */
  verifyDHPubkey(
    version: number,
    pubkey: IGroup,
    proof: ProofDiscreteLog
  ): boolean {
    return verifyProofDiscreteLog(
      this.getHashFunc(version),
      proof,
      this.g1,
      pubkey
    );
  }

  /**
   * Generate the Diffie-Hellman shared secret with our private key and the public key
   *  from the other.
   * @param g - Public key from the other.
   * @param secretKey - Our private key.
   */
  makeDHSharedSecret(g: IGroup, secretKey: BigInt): IGroup {
    return g.exponentiate(secretKey);
  }

  /**
   * Check if a group element is valid for SMP protocol.
   * @param g - A group element used in SMP protocol.
   */
  verifyGroup(g: IGroup): boolean {
    return g.isValid();
  }

  /**
   * Generate our partial `P` and `Q`. They are `Pa` and `Qa` in the spec if we are an initiator,
   *  otherwise, `Pb` and `Qb`. A `ProofEqualDiscreteCoordinates` is generated altogether.
   *
   * @param version - The prefixed version, used when generating the proof.
   * @param g2 - `g2` in the spec.
   * @param g3 - `g3` in the spec.
   * @param r4 - `r4` in the spec.
   */
  makePLQL(
    version: number,
    g2: IGroup,
    g3: IGroup,
    r4: BigInt
  ): [IGroup, IGroup, ProofEqualDiscreteCoordinates] {
    const pL = g3.exponentiate(r4);
    const qL = this.g1.exponentiate(r4).operate(g2.exponentiate(this.x));
    const proof = makeProofEqualDiscreteCoordinates(
      this.getHashFunc(version),
      g3,
      this.g1,
      g2,
      r4,
      this.x,
      this.getRandomSecret(),
      this.getRandomSecret(),
      this.q
    );
    return [pL, qL, proof];
  }

  /**
   * Verify `P` and `Q` from the remote with its the proof, generated by `makePLQL`.
   *
   * @param version - The prefixed version, used when verifying the proof.
   * @param g2 - `g2` in the spec.
   * @param g3 - `g3` in the spec.
   * @param pR - `P` from the remote.
   * @param qR - `Q` from the remote.
   * @param proof - The zk proof for `pR` and `qR`.
   */
  verifyPRQRProof(
    version: number,
    g2: IGroup,
    g3: IGroup,
    pR: IGroup,
    qR: IGroup,
    proof: ProofEqualDiscreteCoordinates
  ): boolean {
    return verifyProofEqualDiscreteCoordinates(
      this.getHashFunc(version),
      g3,
      this.g1,
      g2,
      pR,
      qR,
      proof
    );
  }

  /**
   * Generate our partial `R`. It is `Ra`in the spec if we are an initiator, otherwise, `Rb`.
   *
   * @param version - The prefixed version, used when generating the proof.
   * @param s3 - Our 3rd secret.
   * @param qa - `Qa` in the spec.
   * @param qb - `Qb` in the sepc.
   */
  makeRL(
    version: number,
    s3: BigInt,
    qa: IGroup,
    qb: IGroup
  ): [IGroup, ProofEqualDiscreteLogs] {
    const qaDivQb = qa.operate(qb.inverse());
    const rL = qaDivQb.exponentiate(s3);
    const raProof = makeProofEqualDiscreteLogs(
      this.getHashFunc(version),
      this.g1,
      qaDivQb,
      s3,
      this.getRandomSecret(),
      this.q
    );
    return [rL, raProof];
  }

  /**
   * Verify the partial `R` from the remote. It is `Rb` in the spec if we are an initiator,
   *  otherwise, `Ra`.
   *
   * @param version - The prefixed version, used when verifying the proof.
   * @param g3R - The Diffie-Hellman public key from remote, which is used to generate `g3`.
   * @param rR - Partial `R` from the remote. It is `Rb` in the spec if we are an initiator,
   *  otherwise, `Ra`.
   * @param proof - The proof for the partial `R`, which is generated by `makeRL` from remote.
   * @param qa - `Qa` in the spec.
   * @param qb - `Qb` in the spec.
   */
  verifyRR(
    version: number,
    g3R: IGroup,
    rR: IGroup,
    proof: ProofEqualDiscreteLogs,
    qa: IGroup,
    qb: IGroup
  ): boolean {
    return verifyProofEqualDiscreteLogs(
      this.getHashFunc(version),
      this.g1,
      qa.operate(qb.inverse()),
      g3R,
      rR,
      proof
    );
  }

  /**
   * Generate `Rab` in the spec.
   * @param s3 - The 3rd secret in the spec.
   * @param rR - Partial `R` from the remote. It is `Rb` in the spec if we are an initiator,
   *  otherwise, `Ra`.
   */
  makeRab(s3: BigInt, rR: IGroup): IGroup {
    return rR.exponentiate(s3);
  }
}

class SMPState1 extends BaseSMPState {
  s2: BigInt;
  s3: BigInt;
  r4?: BigInt;

  constructor(x: BigInt, config: ISMPConfig) {
    super(x, config);
    this.s2 = this.getRandomSecret();
    this.s3 = this.getRandomSecret();
  }
  getResult(): boolean | null {
    return null;
  }
  transit(tlv: TypeTLVOrNull): [ISMPState, TypeTLVOrNull] {
    if (tlv === null) {
      /* Step 0: Alice initaites smp, sending `g2a`, `g3a` to Bob. */
      const [g2a, g2aProof] = this.makeDHPubkey(1, this.s2);
      const [g3a, g3aProof] = this.makeDHPubkey(2, this.s3);
      const msg = this.createSMPMessage1(g2a, g2aProof, g3a, g3aProof);
      const state = new SMPState2(
        this.x,
        this.config,
        this.s2,
        this.s3,
        g2a,
        g3a
      );
      return [state, msg.toTLV()];
    } else {
      /*
        Step 1: Bob verifies received data, makes its slice of DH, and sends
        `g2b`, `g3b`, `Pb`, `Qb` to Alice.
      */
      const msg = this.parseSMPMessage1(tlv);
      // Verify pubkey's value
      if (!this.verifyGroup(msg.g2a) || !this.verifyGroup(msg.g3a)) {
        throw new InvalidGroupElement();
      }
      // Verify the proofs
      if (!this.verifyDHPubkey(1, msg.g2a, msg.g2aProof)) {
        throw new InvalidProof();
      }
      if (!this.verifyDHPubkey(2, msg.g3a, msg.g3aProof)) {
        throw new InvalidProof();
      }
      const [g2b, g2bProof] = this.makeDHPubkey(3, this.s2);
      const [g3b, g3bProof] = this.makeDHPubkey(4, this.s3);
      const g2 = this.makeDHSharedSecret(msg.g2a, this.s2);
      const g3 = this.makeDHSharedSecret(msg.g3a, this.s3);
      // Make `Pb` and `Qb`
      const r4 = this.getRandomSecret();
      this.r4 = r4;
      const [pb, qb, pbqbProof] = this.makePLQL(5, g2, g3, r4);

      const msg2 = this.createSMPMessage2(
        g2b,
        g2bProof,
        g3b,
        g3bProof,
        pb,
        qb,
        pbqbProof
      );
      const state = new SMPState3(
        this.x,
        this.config,
        this.s2,
        this.s3,
        g2b,
        g3b,
        g2,
        g3,
        msg.g2a,
        msg.g3a,
        pb,
        qb
      );
      return [state, msg2.toTLV()];
    }
  }
}

class SMPState2 extends BaseSMPState {
  r4?: BigInt;

  constructor(
    x: BigInt,
    config: ISMPConfig,
    readonly s2: BigInt,
    readonly s3: BigInt,
    readonly g2L: IGroup,
    readonly g3L: IGroup
  ) {
    super(x, config);
  }
  getResult(): boolean | null {
    return null;
  }

  transit(tlv: TypeTLVOrNull): [ISMPState, TypeTLVOrNull] {
    if (tlv === null) {
      throw new ValueError();
    }
    const msg = this.parseSMPMessage2(tlv);
    /*
      Step 2: Alice receives bob's DH slices, P Q, and their proofs.
    */
    // Verify
    if (
      !this.verifyGroup(msg.g2b) ||
      !this.verifyGroup(msg.g3b) ||
      !this.verifyGroup(msg.pb) ||
      !this.verifyGroup(msg.qb)
    ) {
      throw new InvalidGroupElement();
    }
    if (!this.verifyDHPubkey(3, msg.g2b, msg.g2bProof)) {
      throw new InvalidProof();
    }
    if (!this.verifyDHPubkey(4, msg.g3b, msg.g3bProof)) {
      throw new InvalidProof();
    }
    // Perform DH
    const g2 = this.makeDHSharedSecret(msg.g2b, this.s2);
    const g3 = this.makeDHSharedSecret(msg.g3b, this.s3);
    if (!this.verifyPRQRProof(5, g2, g3, msg.pb, msg.qb, msg.pbqbProof)) {
      throw new InvalidProof();
    }
    // Save r4 for generating `Pa` in the circuit.
    const r4 = this.getRandomSecret();
    this.r4 = r4;
    // Calculate `Pa` and `Qa`
    const [pa, qa, paqaProof] = this.makePLQL(6, g2, g3, r4);
    // Calculate `Ra`
    const [ra, raProof] = this.makeRL(7, this.s3, qa, msg.qb);

    const msg3 = this.createSMPMessage3(pa, qa, paqaProof, ra, raProof);
    // Advance the step
    const state = new SMPState4(
      this.x,
      this.config,
      this.s2,
      this.s3,
      this.g2L,
      this.g3L,
      msg.g2b,
      msg.g3b,
      g2,
      g3,
      pa,
      qa,
      msg.pb,
      msg.qb,
      ra
    );

    return [state, msg3.toTLV()];
  }
}

class SMPState3 extends BaseSMPState {
  constructor(
    x: BigInt,
    config: ISMPConfig,
    readonly s2: BigInt,
    readonly s3: BigInt,
    readonly g2L: IGroup,
    readonly g3L: IGroup,
    readonly g2: IGroup,
    readonly g3: IGroup,
    readonly g2R: IGroup,
    readonly g3R: IGroup,
    readonly pL: IGroup,
    readonly qL: IGroup
  ) {
    super(x, config);
  }
  getResult(): boolean | null {
    return null;
  }
  transit(tlv: TypeTLVOrNull): [ISMPState, TypeTLVOrNull] {
    if (tlv === null) {
      throw new ValueError();
    }
    const msg = this.parseSMPMessage3(tlv);
    // const msg = deserialize(tlv, SMPMessage3);
    /*
      Step 3: Bob receives `Pa`, `Qa`, `Ra` along with their proofs,
      calculates `Rb` and `Rab` accordingly.
    */
    // Verify
    if (
      !this.verifyGroup(msg.pa) ||
      !this.verifyGroup(msg.qa) ||
      !this.verifyGroup(msg.ra)
    ) {
      throw new InvalidGroupElement();
    }
    if (
      !this.verifyPRQRProof(6, this.g2, this.g3, msg.pa, msg.qa, msg.paqaProof)
    ) {
      throw new InvalidProof();
    }
    // `Ra`
    if (!this.verifyRR(7, this.g3R, msg.ra, msg.raProof, msg.qa, this.qL)) {
      throw new InvalidProof();
    }
    const [rb, rbProof] = this.makeRL(8, this.s3, msg.qa, this.qL);
    const msg4 = this.createSMPMessage4(rb, rbProof);
    const rab = this.makeRab(this.s3, msg.ra);
    const state = new SMPStateFinished(
      this.x,
      this.config,
      msg.pa,
      this.pL,
      rab
    );
    return [state, msg4.toTLV()];
  }
}

class SMPState4 extends BaseSMPState {
  constructor(
    x: BigInt,
    config: ISMPConfig,
    readonly s2: BigInt,
    readonly s3: BigInt,
    readonly g2L: IGroup,
    readonly g3L: IGroup,
    readonly g2R: IGroup,
    readonly g3R: IGroup,
    readonly g2: IGroup,
    readonly g3: IGroup,
    readonly pL: IGroup,
    readonly qL: IGroup,
    readonly pR: IGroup,
    readonly qR: IGroup,
    readonly rL: IGroup
  ) {
    super(x, config);
  }
  getResult(): boolean | null {
    return null;
  }

  transit(tlv: TypeTLVOrNull): [ISMPState, TypeTLVOrNull] {
    /*
      Step 4: Alice receives `Rb` and calculate `Rab` as well.
    */
    // Verify
    if (tlv === null) {
      throw new ValueError();
    }
    const msg = this.parseSMPMessage4(tlv);
    if (!this.verifyGroup(msg.rb)) {
      throw new InvalidGroupElement();
    }
    if (!this.verifyRR(8, this.g3R, msg.rb, msg.rbProof, this.qL, this.qR)) {
      throw new InvalidProof();
    }
    const rab = this.makeRab(this.s3, msg.rb);
    const state = new SMPStateFinished(
      this.x,
      this.config,
      this.pL,
      this.pR,
      rab
    );
    return [state, null];
  }
}

class SMPStateFinished extends BaseSMPState {
  constructor(
    x: BigInt,
    config: ISMPConfig,
    readonly pa: IGroup,
    readonly pb: IGroup,
    readonly rab: IGroup
  ) {
    super(x, config);
  }
  getResult(): boolean {
    return this.rab.equal(this.pa.operate(this.pb.inverse()));
  }
  transit(_: TypeTLVOrNull): [ISMPState, TypeTLVOrNull] {
    throw new NotImplemented();
  }
}

/**
 * SMP state machine in the spec. `SMPStateMachine` is initialized, performs state transition with
 *  the supplied SMP messages, and returns the final result when the protocol is complete.
 *
 * NOTE: It is slightly deviated from the spec for implementation reason:
 *  - state transition "SMP Abort" which is used to reset the state to `SMPState1` is omitted.
 *    It's because we can just initialize another `SMPStateMachine` to restart from `SMPState1`.
 *    Check out "SMP Abort Message" in the spec for more details.
 *  - `SMPStateFinished` is the final state, instead of `SMPState1` in the spec. It's the same
 *    reason as above since we don't need to reuse `SMPStateMachine`.
 *
 * TODO: Refactor: It seems `SMPStateFinished` is not necessary. We know SMP protocol is finished
 *  when `transit` returns `null`.
 */
abstract class BaseSMPStateMachine {
  state: ISMPState;
  /**
   * @param x - Our secret to be compared in SMP protocol.
   */
  constructor(state: ISMPState) {
    this.state = state;
  }

  // TODO: Add initiate, which makes `transit` get rid of `null`.

  /**
   * Transit our state based on the current state and the input SMP messages.
   *
   * @param msg - Either a `TLV` type SMP message or `null` are accepted. `null` indicates we are
   *  the initiator of the SMP protocol.
   * @returns A `TLV` type SMP message or `null`. `null` is returned when there is nothing to
   *  return.
   *
   * TODO: Probably we don't even need to expose `TLV`. Just make `SMPStateMachine` output or
   *  consume from `Uint8Array`.
   */
  transit(msg: TypeTLVOrNull): TypeTLVOrNull {
    const [newState, retMsg] = this.state.transit(msg);
    this.state = newState;
    return retMsg;
  }

  /**
   * Return the final result.
   *
   * @throws `SMPNotFinished` when SMP protocol is not complete yet.
   */
  getResult(): boolean {
    const result = this.state.getResult();
    if (result === null) {
      throw new SMPNotFinished();
    }
    return result;
  }

  /**
   * Return whether SMP protocol is complete.
   */
  isFinished(): boolean {
    return this.state.getResult() !== null;
  }
}

export {
  BaseSMPStateMachine,
  SMPState1,
  SMPState2,
  SMPState3,
  SMPState4,
  SMPStateFinished
};
