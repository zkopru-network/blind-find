import { babyJub } from 'circomlib';
import { SNARK_FIELD_SIZE } from 'maci-crypto';

const q = SNARK_FIELD_SIZE;
const G = babyJub.Base8;

export { q, G };
