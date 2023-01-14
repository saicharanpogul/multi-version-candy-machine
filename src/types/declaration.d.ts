type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

type XOR<T, U> = T | U extends object
  ? (Without<T, U> & U) | (Without<U, T> & T)
  : T | U;

interface CreatorsEntity {
  address: string;
  verified: boolean;
  share: number;
}

interface AttributesEntity {
  trait_type: string;
  value: string;
}

interface Properties {
  files?: FilesEntity[] | null;
  creators?: CreatorsEntity[] | null;
  category?: null;
}

interface FilesEntity {
  uri: string;
  type: string;
}

interface NFT {
  model: string;
  address: string;
  mintAddress: string;
  updateAuthorityAddress: string;
  json?: null;
  jsonLoaded: boolean;
  name: string;
  symbol: string;
  uri: string;
  isMutable: boolean;
  primarySaleHappened: boolean;
  sellerFeeBasisPoints: number;
  editionNonce: number;
  creators?: CreatorsEntity[] | null;
  tokenStandard: number;
  collection?: null;
  collectionDetails?: null;
  uses?: null;
}

interface Metadata {
  name: string;
  symbol: string;
  description: string;
  seller_fee_basis_points: number;
  image: string;
  attributes?: AttributesEntity[] | null;
  properties: Properties;
}

type Network = "devnet" | "mainnet-beta" | "localnet";
