import { BIG_ENDIAN, LITTLE_ENDIAN } from "./constants";
import { PubKey as ECPoint } from "maci-crypto";

type TEndian = typeof BIG_ENDIAN | typeof LITTLE_ENDIAN;

export { ECPoint, TEndian };
