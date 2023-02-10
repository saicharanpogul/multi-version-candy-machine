import { clusterApiUrl } from "@solana/web3.js";

export const truncateAddress = (address: string) => {
  return address.slice(0, 4) + ".." + address.slice(-4);
};

export const NETWORK: Network = "localnet";
export const getUrls = (
  network: Network | undefined,
  sig?: string,
  type?: "tx" | "address"
) => {
  if (network === "devnet") {
    return {
      rpc: clusterApiUrl("devnet"),
      bundlrAddress: "https://devnet.bundlr.network",
      bundlrProviderUrl: clusterApiUrl("devnet"),
      explorer: `https://explorer.solana.com/${type}/${sig}?cluster=devnet`,
    };
  } else if (network === "mainnet-beta") {
    return {
      // rpc: clusterApiUrl("mainnet-beta"),
      rpc: "https://api.metaplex.solana.com/",
      bundlrAddress: "https://node1.bundlr.network",
      bundlrProviderUrl: clusterApiUrl("mainnet-beta"),
      explorer: `https://explorer.solana.com/${type}/${sig}`,
    };
  } else {
    return {
      rpc: "http://127.0.0.1:8899",
      bundlrAddress: "https://devnet.bundlr.network",
      bundlrProviderUrl: clusterApiUrl("devnet"),
      explorer: `https://explorer.solana.com/${type}/${sig}?cluster=custom`,
    };
  }
};
