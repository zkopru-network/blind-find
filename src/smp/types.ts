import { BIG_ENDIAN, LITTLE_ENDIAN } from "./constants";
import { IGroup } from "./interfaces";
import { TLV } from "./serialization";

type TypeTLVOrNull = TLV | null;
type TEndian = typeof BIG_ENDIAN | typeof LITTLE_ENDIAN;
type TSecret = number | string | BigInt | Uint8Array;
type THashFunc = (...args: IGroup[]) => BigInt;

export { TEndian, TypeTLVOrNull, TSecret, THashFunc };
