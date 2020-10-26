import { PubKey as ECPoint } from "maci-crypto";
import { BIG_ENDIAN, LITTLE_ENDIAN } from "./constants";
import { TLV } from "./msgs";

type TypeTLVOrNull = TLV | null;
type TEndian = typeof BIG_ENDIAN | typeof LITTLE_ENDIAN;

export { ECPoint, TEndian, TypeTLVOrNull };
