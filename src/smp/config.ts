import { babyJub } from "circomlib";
import { ECPoint } from "./types";

const q = babyJub.subOrder as BigInt;
const G = babyJub.Base8 as ECPoint;

export { q, G, ECPoint };
