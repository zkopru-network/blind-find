import { babyJub } from 'circomlib';
import { PubKey as ECPoint } from 'maci-crypto';

const q = babyJub.subOrder as BigInt;
const G = babyJub.Base8 as ECPoint;

export { q, G, ECPoint };
