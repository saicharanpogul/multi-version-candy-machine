import React, { useCallback, useEffect, useState } from "react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  fetchCandyGuard,
  fetchCandyMachine,
  mplCandyMachine,
  safeFetchCandyMachine,
} from "@metaplex-foundation/mpl-candy-machine";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { getUrls } from "@/utils";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { PublicKey } from "@solana/web3.js";
import { publicKey } from "@metaplex-foundation/umi";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";

const useUmi = (changed?: () => void) => {
  const walletAdapter = useWallet();
  const toast = useToast();
  const [network, setNetwork] = useState<Network>();
  const [umi, setUmi] = useState<any>();
  const router = useRouter();

  useEffect(() => {
    const _network = localStorage.getItem("network") as Network;
    if (_network && walletAdapter) {
      setNetwork(_network);

      setUmi(
        createUmi(getUrls(_network).rpc)
          .use(mplCandyMachine())
          .use(walletAdapterIdentity(walletAdapter))
      );
    } else {
      setNetwork("devnet");
      setUmi(
        createUmi(getUrls("devnet").rpc)
          .use(mplCandyMachine())
          .use(walletAdapterIdentity(walletAdapter))
      );
    }
  }, [walletAdapter]);

  const changeNetwork = useCallback(
    (network: Network) => {
      localStorage.setItem("network", network);
      setNetwork(network);
      setUmi(
        createUmi(getUrls(network).rpc)
          .use(mplCandyMachine())
          .use(walletAdapterIdentity(walletAdapter))
      );
      router.replace("/");
      changed && changed();
    },
    [changed, router, walletAdapter]
  );

  const isV3 = useCallback((model: string) => {
    return model === "candyMachine" ? true : false;
  }, []);

  const getCandyMachineV3 = useCallback(
    async (cmId: PublicKey) => {
      try {
        const candyMachinePublicKey = publicKey(fromWeb3JsPublicKey(cmId));
        const candyMachine = await fetchCandyMachine(
          umi,
          candyMachinePublicKey
        );
        const candyGuard = await fetchCandyGuard(
          umi,
          candyMachine.mintAuthority
        );
        toast({
          title: "candy machine v3",
          status: "success",
          duration: 6000,
        });
        return {
          candyMachine,
          candyGuard,
        };
      } catch (error) {
        console.log(error);
        toast({
          title: "invalid cm",
          description: "provided id is neither cm v2 or v3.",
          status: "error",
          duration: 6000,
        });
        throw error;
      }
    },
    [umi, toast]
  );

  const getCandyMachine = useCallback(
    async (cmId: PublicKey) => {
      try {
        const candyMachinePublicKey = publicKey(fromWeb3JsPublicKey(cmId));
        console.log(
          "CM V3:",
          toWeb3JsPublicKey(candyMachinePublicKey).toBase58()
        );
        const candyMachine = await safeFetchCandyMachine(
          umi,
          candyMachinePublicKey
        );
        const candyGuard = await fetchCandyGuard(
          umi,
          candyMachine!.mintAuthority
        );
        console.log("CMV3:", candyMachine);
        console.log("CGV3:", candyGuard);
        toast({
          title: "candy machine v3",
          status: "success",
          duration: 6000,
        });
        return { candyMachine, candyGuard };
      } catch (error) {
        // return getCandyMachineV3(cmId);
        throw error;
      }
    },
    [umi, toast]
  );

  return {
    umi,
    getCandyMachine,
    isV3,
    getUrls,
    network,
    changeNetwork,
  };
};

export default useUmi;
