export const LEVELS = 32;
export const ZERO_VALUE = 0;
export const SOCKET_TIMEOUT = 30000;
const TIME_GEN_PROOF = 375000; // ~= 4 * time_to_generate_proof_of_smp_on_my_mac
const TIME_VERIFY_PROOF = 5000; // ~= 10 * time_to_verify_proof_of_smp_on_my_mac
export const TIMEOUT = SOCKET_TIMEOUT + TIME_VERIFY_PROOF;
export const TIMEOUT_LARGE = SOCKET_TIMEOUT + TIME_GEN_PROOF;
export const MAXIMUM_TRIALS = 1000000;
// TODO: Should be changed to wss later when we support https
export const WS_PROTOCOL = "ws";
