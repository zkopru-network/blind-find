import { babyJub } from 'circomlib';
import { PubKey as ECPoint, SNARK_FIELD_SIZE } from 'maci-crypto';

const q = SNARK_FIELD_SIZE;
const G = babyJub.Base8 as ECPoint;

export { q, G, ECPoint };
