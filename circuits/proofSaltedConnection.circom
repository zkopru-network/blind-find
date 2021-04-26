include "../node_modules/maci-circuits/circom/verify_signature.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "../node_modules/maci-circuits/circom/trees/incrementalMerkleTree.circom";
include "../node_modules/maci-circuits/circom/hasherPoseidon.circom";
include "./proofOfSMP.circom";

template HubConnectionMsgHash() {
    signal input hubPubkey0[2];
    signal input hubPubkey1[2];
    signal output out;

    component hasher = Hasher5();
    hasher.in[0] <== 15775140326275327636461277643630368659324521625749033424352920874919079558886;
    hasher.in[1] <== hubPubkey0[0];
    hasher.in[2] <== hubPubkey0[1];
    hasher.in[3] <== hubPubkey1[0];
    hasher.in[4] <== hubPubkey1[1];

    out <== hasher.hash;
}

template HubConnectionVerifier() {
    signal input hubPubkey0[2];
    signal input hubSig0R8[2];
    signal input hubSig0S;
    signal input hubPubkey1[2];
    signal input hubSig1R8[2];
    signal input hubSig1S;

    signal output valid;

    component hashedData = HubConnectionMsgHash();
    hashedData.hubPubkey0[0] <== hubPubkey0[0];
    hashedData.hubPubkey0[1] <== hubPubkey0[1];
    hashedData.hubPubkey1[0] <== hubPubkey1[0];
    hashedData.hubPubkey1[1] <== hubPubkey1[1];

    component verifier0 = EdDSAPoseidonVerifier_patched();
    verifier0.Ax <== hubPubkey0[0];
    verifier0.Ay <== hubPubkey0[1];
    verifier0.R8x <== hubSig0R8[0];
    verifier0.R8y <== hubSig0R8[1];
    verifier0.S <== hubSig0S;
    verifier0.M <== hashedData.out;

    component verifier1 = EdDSAPoseidonVerifier_patched();
    verifier1.Ax <== hubPubkey1[0];
    verifier1.Ay <== hubPubkey1[1];
    verifier1.R8x <== hubSig1R8[0];
    verifier1.R8y <== hubSig1R8[1];
    verifier1.S <== hubSig1S;
    verifier1.M <== hashedData.out;

    component res = AND();
    res.a <== verifier0.valid;
    res.b <== verifier1.valid;

    valid <== res.out;
}

template PubkeySelector() {
    signal input pubkey0[2];
    signal input pubkey1[2];
    signal input selector;
    signal output out[2];

    component mux = MultiMux1(2);
    mux.c[0][0] <== pubkey0[0];
    mux.c[1][0] <== pubkey0[1];
    mux.c[0][1] <== pubkey1[0];
    mux.c[1][1] <== pubkey1[1];
    mux.s <== selector;
    out[0] <== mux.out[0];
    out[1] <== mux.out[1];
}

template ProofSaltedConnection(levels) {
    // Salted Identities: `hash(Pubkey)` matches.
    // Hub Registry: Merkle Proofs for hub 0
    // Hub Connection: Merkle Proof

    signal private input hubPubkey0[2];
    signal private input hubPubkey1[2];

    // Merkle proof for creator's hub registry.
    signal private input creatorHubRegistryMerklePathElements[levels][1];
    signal private input creatorHubRegistryMerklePathIndices[levels];
    signal private input creatorHubRegistrySigR8[2];
    signal private input creatorHubRegistrySigS;

    // Hub Connection Registry
    signal private input sigHubConnection0R8[2];
    signal private input sigHubConnection0S;
    signal private input sigHubConnection1R8[2];
    signal private input sigHubConnection1S;
    signal private input hubConnectionMerklePathElements[levels][1];
    signal private input hubConnectionMerklePathIndices[levels];

    // Public

    // Indicate which pubkey is the proof creator.
    // It is 0 when hubPukbey0 is the proof creator, ...etc.
    signal input creator;
    signal input adminAddress;

    signal input hubRegistryTreeMerkleRoot;
    signal input hubConnectionTreeMerkleRoot;

    signal input saltedHubPubkey0;
    signal input saltedHubPubkey1;

    signal output valid;

    // creator must be boolean
    creator * (1 - creator) === 0;
    component creatorPubkeySelector = PubkeySelector();
    creatorPubkeySelector.pubkey0[0] <== hubPubkey0[0];
    creatorPubkeySelector.pubkey0[1] <== hubPubkey0[1];
    creatorPubkeySelector.pubkey1[0] <== hubPubkey1[0];
    creatorPubkeySelector.pubkey1[1] <== hubPubkey1[1];
    creatorPubkeySelector.selector <== creator;

    component hubRegistryVerifier = HubRegistryVerifier(levels);
    hubRegistryVerifier.merkleRoot <== hubRegistryTreeMerkleRoot;
    hubRegistryVerifier.pubkeyHub[0] <== creatorPubkeySelector.out[0];
    hubRegistryVerifier.pubkeyHub[1] <== creatorPubkeySelector.out[1];
    hubRegistryVerifier.sigHubR8[0] <== creatorHubRegistrySigR8[0];
    hubRegistryVerifier.sigHubR8[1] <== creatorHubRegistrySigR8[1];
    hubRegistryVerifier.sigHubS <== creatorHubRegistrySigS;
    hubRegistryVerifier.adminAddress <== adminAddress;
    for (var i = 0; i < levels; i++) {
        hubRegistryVerifier.merklePathIndices[i] <== creatorHubRegistryMerklePathIndices[i];
        hubRegistryVerifier.merklePathElements[i][0] <== creatorHubRegistryMerklePathElements[i][0];
    }
    hubRegistryVerifier.valid === 1;

    component hubConnectionVerifier = HubConnectionVerifier();
    hubConnectionVerifier.hubPubkey0[0] <== hubPubkey0[0];
    hubConnectionVerifier.hubPubkey0[1] <== hubPubkey0[1];
    hubConnectionVerifier.hubSig0R8[0] <== sigHubConnection0R8[0];
    hubConnectionVerifier.hubSig0R8[1] <== sigHubConnection0R8[1];
    hubConnectionVerifier.hubSig0S <== sigHubConnection0S;

    hubConnectionVerifier.hubPubkey1[0] <== hubPubkey1[0];
    hubConnectionVerifier.hubPubkey1[1] <== hubPubkey1[1];
    hubConnectionVerifier.hubSig1R8[0] <== sigHubConnection1R8[0];
    hubConnectionVerifier.hubSig1R8[1] <== sigHubConnection1R8[1];
    hubConnectionVerifier.hubSig1S <== sigHubConnection1S;
    hubConnectionVerifier.valid === 1;

    // Verify that the hub entry matches its merkle proof
    component hasher = Hasher11();
    hasher.in[0] <== sigHubConnection0R8[0];
    hasher.in[1] <== sigHubConnection0R8[1];
    hasher.in[2] <== sigHubConnection0S;
    hasher.in[3] <== hubPubkey0[0];
    hasher.in[4] <== hubPubkey0[1];
    hasher.in[5] <== sigHubConnection1R8[0];
    hasher.in[6] <== sigHubConnection1R8[1];
    hasher.in[7] <== sigHubConnection1S;
    hasher.in[8] <== hubPubkey1[0];
    hasher.in[9] <== hubPubkey1[1];
    hasher.in[10] <== 0;

    component leafVerifier = LeafExists(levels);
    leafVerifier.leaf <== hasher.hash;
    leafVerifier.root <== hubConnectionTreeMerkleRoot;
    for (var i = 0; i < levels; i++) {
        leafVerifier.path_index[i] <== hubConnectionMerklePathIndices[i];
        leafVerifier.path_elements[i][0] <== hubConnectionMerklePathElements[i][0];
    }

    component res = AND();
    res.a <== hubRegistryVerifier.valid;
    res.b <== hubConnectionVerifier.valid;

    valid <== res.out;
}
