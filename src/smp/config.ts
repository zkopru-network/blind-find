import { babyJub } from 'circomlib';
import { PubKey as Point, SNARK_FIELD_SIZE } from 'maci-crypto';

const q = SNARK_FIELD_SIZE;
const G = babyJub.Base8 as Point;

export { q, G, Point };
