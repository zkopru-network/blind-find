import { PubKey as ECPoint } from "maci-crypto";
import { BIG_ENDIAN, LITTLE_ENDIAN } from "./constants";
import { TLV } from "./msgs";
import { IGroup } from "./interfaces";

type TypeTLVOrNull = TLV | null;
type TEndian = typeof BIG_ENDIAN | typeof LITTLE_ENDIAN;
type TSecret = number | string | BigInt | Uint8Array;
type THashFunc = (...args: IGroup[]) => BigInt;

export { ECPoint, TEndian, TypeTLVOrNull, TSecret, THashFunc };
