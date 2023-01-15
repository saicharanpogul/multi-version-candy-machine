import { useToast } from "@chakra-ui/react";
import {
  bundlrStorage,
  Metaplex,
  walletAdapterIdentity,
} from "@metaplex-foundation/js";
import { useWallet } from "@solana/wallet-adapter-react";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getUrls } from "../utils";

const useMetaplex = (changed?: () => void) => {
  const walletAdapter = useWallet();
  const toast = useToast();
  const [network, setNetwork] = useState<Network>();
  const [metaplex, setMetaplex] = useState<Metaplex>();
  const router = useRouter();

  useEffect(() => {
    const _network = localStorage.getItem("network") as Network;
    if (_network && walletAdapter) {
      setNetwork(_network);
      setMetaplex(
        Metaplex.make(new Connection(getUrls(_network).rpc))
          .use(walletAdapterIdentity(walletAdapter))
          .use(
            bundlrStorage({
              // @ts-ignore
              address: getUrls(_network)?.bundlrAddress,
              // @ts-ignore
              providerUrl: getUrls(_network)?.rpc,
              timeout: 60000,
            })
          )
      );
    } else {
      setNetwork("devnet");
      setMetaplex(
        Metaplex.make(new Connection(clusterApiUrl("devnet")))
          .use(walletAdapterIdentity(walletAdapter))
          .use(
            bundlrStorage({
              // @ts-ignore
              address: "https://devnet.bundlr.network",
              // @ts-ignore
              providerUrl: clusterApiUrl("devnet"),
              timeout: 60000,
            })
          )
      );
    }
  }, [walletAdapter]);

  const changeNetwork = useCallback(
    (network: Network) => {
      localStorage.setItem("network", network);
      setNetwork(network);
      setMetaplex(
        Metaplex.make(new Connection(getUrls(network).rpc))
          .use(walletAdapterIdentity(walletAdapter))
          .use(
            bundlrStorage({
              // @ts-ignore
              address: getUrls(network)?.bundlrAddress,
              // @ts-ignore
              providerUrl: getUrls(network)?.rpc,
              timeout: 60000,
            })
          )
      );
      router.replace("/");
      changed && changed();
    },
    [changed, walletAdapter]
  );

  const isV3 = useCallback((model: string) => {
    return model === "candyMachine" ? true : false;
  }, []);

  const getCandyMachine = useCallback(
    async (cmId: PublicKey) => {
      try {
        const _cm = await metaplex!
          .candyMachines()
          .findByAddress({ address: cmId });

        toast({
          title: "candy machine v3",
          status: "success",
          duration: 6000,
        });
        return _cm;
      } catch (error) {
        try {
          const _cm = await metaplex!
            .candyMachinesV2()
            .findByAddress({ address: cmId });
          toast({
            title: "candy machine v2",
            status: "success",
            duration: 6000,
          });
          return _cm;
        } catch (error) {
          toast({
            title: "invalid cm",
            description: "provided id is neither cm v2 or v3.",
            status: "error",
            duration: 6000,
          });
          throw error;
        }
      }
    },
    [metaplex, toast]
  );

  return { metaplex, getCandyMachine, isV3, getUrls, network, changeNetwork };
};

export default useMetaplex;
