import { useToast } from "@chakra-ui/react";
import {
  bundlrStorage,
  Metaplex,
  walletAdapterIdentity,
  isCandyMachine,
  isCandyMachineV2,
  CandyMachine,
  DefaultCandyGuardSettings,
  CandyMachineV2,
} from "@metaplex-foundation/js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useMemo } from "react";
import { getUrls, NETWORK } from "../utils";
import useNetwork from "./useNetwork";

const useMetaplex = () => {
  const { connection } = useConnection();
  const walletAdapter = useWallet();
  const toast = useToast();
  const { network } = useNetwork();
  const metaplex = useMemo(
    () =>
      Metaplex.make(connection)
        .use(walletAdapterIdentity(walletAdapter))
        .use(
          bundlrStorage({
            // @ts-ignore
            address: getUrls(network)?.bundlrAddress,
            // @ts-ignore
            providerUrl: getUrls(network)?.rpc,
            timeout: 60000,
          })
        ),
    [connection, network, walletAdapter]
  );

  const isV3 = useCallback((model: string) => {
    return model === "candyMachine" ? true : false;
  }, []);

  const getCandyMachine = useCallback(
    async (cmId: PublicKey) => {
      try {
        const _cm = await metaplex
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
          const _cm = await metaplex
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
    [metaplex]
  );
  return { metaplex, getCandyMachine, isV3 };
};

export default useMetaplex;
