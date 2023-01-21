import Navbar from "@/components/Navbar";
import useMetaplex from "@/hooks/useMetaplex";
import { truncateAddress } from "@/utils";
import { Box, Container, Flex, Heading, Text } from "@chakra-ui/layout";
import {
  Button,
  FormControl,
  FormErrorMessage,
  Input,
  useToast,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  CandyMachine,
  CandyMachineV2,
  DefaultCandyGuardSettings,
  Nft,
  NftWithToken,
  Sft,
  SftWithToken,
} from "@metaplex-foundation/js";
import { Roboto } from "@next/font/google";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {} from "@project-serum/anchor";

const roboto = Roboto({ weight: "400", subsets: ["latin"] });

const schema = yup.object({
  cmId: yup
    .string()
    .test({
      name: "isValidPublicKey",
      message: "Invalid public key.",
      test: (val) => {
        if (!val) return true;
        try {
          return PublicKey.isOnCurve(val as string);
        } catch (error) {
          return false;
        }
      },
    })
    .required("candy machine id is required."),
});

export default function Home() {
  const [cmId, setCmId] = useState("");
  const [cm, setCm] = useState<
    CandyMachine<DefaultCandyGuardSettings> | CandyMachineV2
  >();
  const [tokenMint, setTokenMint] = useState<PublicKey>();
  const [tokenMintMetadata, setTokenMintMetadata] = useState<
    Sft | SftWithToken | Nft | NftWithToken
  >();
  const [ticker, setTicker] = useState("sol");
  const [isChanged, setIsChanged] = useState(false);
  const [price, setPrice] = useState(0);
  const change = () => {
    setIsChanged((_prev) => !_prev);
  };
  const { getCandyMachine, isV3, metaplex } = useMetaplex(change);
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [setting, setSetting] = useState(false);
  const [mintButton, setMintButton] = useState<{
    title: string;
    disabled: boolean;
  }>({ title: "insufficient balance", disabled: true });
  const toast = useToast();
  const walletAdapter = useWallet();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      cmId: "",
    },
  });
  const cmStatusRefresh = useCallback(
    async (_cmId: PublicKey) => {
      getCandyMachine(_cmId)
        .then(async (_cm) => {
          setCm(_cm);
          // console.log(_cm);
          if (isV3(_cm.model)) {
            console.log("V3");
            // @ts-ignore
            if (_cm.candyGuard.guards.solPayment) {
              setPrice(
                // @ts-ignore
                _cm.candyGuard.guards.solPayment.amount.basisPoints.toNumber() /
                  LAMPORTS_PER_SOL
              );
              const _balance = await connection.getBalance(
                walletAdapter.publicKey as PublicKey
              );
              if (
                _balance <=
                // @ts-ignore
                _cm.candyGuard.guards.solPayment.amount.basisPoints.toNumber()
              ) {
                setMintButton({
                  title: "Insufficient Balance",
                  disabled: true,
                });
              } else {
                setMintButton({
                  title: "Mint",
                  disabled: false,
                });
              }
            }
            // @ts-ignore
            if (_cm.candyGuard.guards.tokenPayment) {
              setPrice(
                // @ts-ignore
                _cm.candyGuard.guards.tokenPayment.amount.basisPoints.toNumber() /
                  LAMPORTS_PER_SOL
              );
              // @ts-ignore
              const mint = _cm.candyGuard.guards.tokenPayment.mint;
              setTokenMint(mint);
              const nft = await metaplex
                ?.nfts()
                // @ts-ignore
                .findByMint({
                  mintAddress: mint as PublicKey,
                });
              setTokenMintMetadata(nft);
              setTicker(nft!.symbol.toLowerCase());
              const tokenAccounts =
                await connection.getParsedTokenAccountsByOwner(
                  walletAdapter.publicKey as PublicKey,
                  // @ts-ignore
                  { mint: mint }
                );
              if (tokenAccounts.value.length === 0) {
                setMintButton({ title: "No Bonk Account", disabled: true });
              } else {
                const tokenAccount = await getAssociatedTokenAddress(
                  // @ts-ignore
                  mint,
                  walletAdapter.publicKey as PublicKey
                );
                const tokenBalance = await connection.getTokenAccountBalance(
                  tokenAccount
                );
                if (
                  // @ts-ignore
                  tokenBalance.value.uiAmount <
                  // @ts-ignore
                  _cm.candyGuard.guards.tokenPayment.amount.basisPoints.toNumber() /
                    LAMPORTS_PER_SOL
                ) {
                  setMintButton({
                    title: "Insufficient Bonk Balance",
                    disabled: true,
                  });
                } else {
                  setMintButton({
                    title: "Mint",
                    disabled: false,
                  });
                }
              }
            }
          } else {
            console.log("V2");
            // @ts-ignore
            if (_cm.tokenMintAddress) {
              // @ts-ignore
              setTokenMint(_cm.tokenMintAddress);
              // @ts-ignore
              // console.log(_cm.tokenMintAddress);
              const nft = await metaplex
                ?.nfts()
                // @ts-ignore
                .findByMint({ mintAddress: _cm.tokenMintAddress as PublicKey });
              setTokenMintMetadata(nft);
              // console.log(nft);
              setTicker(nft!.symbol.toLowerCase());
              const tokenAccounts =
                await connection.getParsedTokenAccountsByOwner(
                  walletAdapter.publicKey as PublicKey,
                  // @ts-ignore
                  { mint: _cm.tokenMintAddress }
                );
              if (tokenAccounts.value.length === 0) {
                setMintButton({ title: "No Bonk Account", disabled: true });
              } else {
                // @ts-ignore
                setPrice(_cm?.price.basisPoints.toNumber() / LAMPORTS_PER_SOL);
                const tokenAccount = await getAssociatedTokenAddress(
                  // @ts-ignore
                  _cm.tokenMintAddress,
                  walletAdapter.publicKey as PublicKey
                );
                const tokenBalance = await connection.getTokenAccountBalance(
                  tokenAccount
                );
                if (
                  // @ts-ignore
                  tokenBalance.value.uiAmount <
                  // @ts-ignore
                  _cm?.price?.basisPoints.toNumber() / LAMPORTS_PER_SOL
                ) {
                  setMintButton({
                    title: "Insufficient Bonk Balance",
                    disabled: true,
                  });
                } else {
                  setMintButton({
                    title: "Mint",
                    disabled: false,
                  });
                }
              }
            } else {
              // @ts-ignore
              setPrice(_cm?.price.basisPoints.toNumber() / LAMPORTS_PER_SOL);
              const _balance = await connection.getBalance(
                walletAdapter.publicKey as PublicKey
              );
              if (
                _balance <=
                // @ts-ignore
                _cm?.price.basisPoints.toNumber()
              ) {
                setMintButton({
                  title: "Insufficient Bonk Balance",
                  disabled: true,
                });
              } else {
                setMintButton({
                  title: "Mint",
                  disabled: false,
                });
              }
            }
          }
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          setSetting(false);
        });
    },
    [cm, connection, getCandyMachine, isV3, metaplex, walletAdapter.publicKey]
  );

  const onSubmit = useCallback(
    async (data: { cmId: string }) => {
      setTicker("sol");
      if (!walletAdapter || !walletAdapter.publicKey) {
        return toast({ title: "Connect wallet", status: "info" });
      }
      setSetting(true);
      setCmId(data.cmId);
      await cmStatusRefresh(new PublicKey(data.cmId));
    },
    [cmStatusRefresh, toast, walletAdapter]
  );

  const mint = useCallback(async () => {
    try {
      if (!cmId && !cm && !walletAdapter.connected) return;
      setLoading(true);
      if (cm && isV3(cm?.model)) {
        const mint = await metaplex!.candyMachines().mint({
          candyMachine: cm as CandyMachine<DefaultCandyGuardSettings>,
          collectionUpdateAuthority: cm?.authorityAddress as PublicKey,
        });
        console.log(mint);
        toast({
          title: `Minted: ${mint.nft.name}`,
          description: `Mint Address: ${truncateAddress(
            mint.nft.address.toBase58()
          )}`,
          duration: 10000,
        });
      } else {
        const mint = await metaplex!.candyMachinesV2().mint({
          candyMachine: cm as CandyMachineV2,
        });
        console.log(mint);
        toast({
          title: `Minted: ${mint.nft.name}`,
          description: `Mint Address: ${truncateAddress(
            mint.nft.address.toBase58()
          )}`,
          duration: 10000,
        });
      }
      await cmStatusRefresh(new PublicKey(cmId));
    } catch (error: any) {
      console.log(error);
      toast({
        title: "something went wrong.",
        description: error.message,
        status: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [
    cm,
    cmId,
    cmStatusRefresh,
    isV3,
    metaplex,
    toast,
    walletAdapter.connected,
  ]);

  // const isMintDisabled = useCallback(async () => {
  //   if (!walletAdapter || !connection || !walletAdapter?.publicKey) return;
  //   if (tokenMint) return;
  //   if (!cm) return;
  //   // @ts-ignore
  //   if (isV3(cm?.model)) {
  //     const tokenAccount = await getAssociatedTokenAddress(
  //       // @ts-ignore
  //       cm.candyGuard.guards.tokenPayment.mint,
  //       walletAdapter.publicKey as PublicKey
  //     );
  //     const tokenBalance = await connection.getTokenAccountBalance(
  //       tokenAccount
  //     );
  //     return (
  //       // @ts-ignore
  //       tokenBalance.value.uiAmount <=
  //       // @ts-ignore
  //       cm?.candyGuard.guards.tokenPayment.amount.basisPoints.toNumber() /
  //         LAMPORTS_PER_SOL
  //     );
  //   } else {
  //     return (
  //       (await connection.getBalance(walletAdapter?.publicKey as PublicKey)) <=
  //       // @ts-ignore
  //       cm?.price.basisPoints.toNumber()
  //     );
  //   }
  //   // return (
  //   //   (await connection.getBalance(walletAdapter?.publicKey as PublicKey)) <
  //   //   // @ts-ignore
  //   //   (isV3(cm?.model)
  //   //     ? // @ts-ignore
  //   //       cm?.accountInfo?.lamports.basisPoints.toNumber()
  //   //     : // @ts-ignore
  //   //       cm?.price?.basisPoints.toNumber())
  //   // );
  // }, [cm, connection, isV3, tokenMint, walletAdapter]);

  // useEffect(() => {
  //   isMintDisabled().then((isDisabled) => {
  //     if (isDisabled) {
  //       setMintButton({ title: "insufficient balance", disabled: true });
  //     } else {
  //       setMintButton({ title: "mint", disabled: false });
  //     }
  //   });
  // }, [isMintDisabled]);

  useEffect(() => {
    if (!watch("cmId")) {
      setCm(undefined);
      setCmId("");
      setTicker("sol");
    }
  }, [isChanged, metaplex, watch]);
  return (
    <div className={roboto.className}>
      <Head>
        <title>multi-version cm</title>
        <meta
          name="description"
          content="set cm id from any of localnet, devnet, & mainnet-beta network and mint."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Container maxW="container.xl">
        <Navbar />
      </Container>
      <Container>
        <Heading color="whitesmoke" mt="10" textAlign="center">
          multi-version cm
        </Heading>
        <Box>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* @ts-ignore */}
            <FormControl isInvalid={errors.cmId}>
              <Input
                variant={"filled"}
                id="cmId"
                mt="4"
                placeholder="candy machine id"
                color={"white"}
                backgroundColor="black"
                borderColor={"gray.500"}
                focusBorderColor="gray.500"
                _hover={{
                  backgroundColor: "black",
                }}
                _placeholder={{
                  color: "gray.500",
                }}
                autoComplete={"off"}
                {...register("cmId")}
              />
              <FormErrorMessage>
                {errors.cmId && errors.cmId.message}
              </FormErrorMessage>
            </FormControl>
            <Button
              mt="4"
              w="full"
              type="submit"
              loadingText="setting..."
              isLoading={setting}
            >
              set
            </Button>
          </form>
        </Box>
        {cm && cm.address.toBase58() === cmId && cmId === watch("cmId") && (
          <Box>
            <Flex
              mt="4"
              borderColor="gray.400"
              borderStyle="solid"
              borderWidth={"1px"}
              borderRadius="4"
              p="2"
              justifyContent={"space-between"}
            >
              <Flex alignItems="center">
                <Text
                  color="gray.500"
                  textAlign="center"
                  fontWeight={"500"}
                  fontSize="md"
                  mr="2"
                >
                  {`available:`}
                </Text>
                <Text
                  color="whitesmoke"
                  textAlign="center"
                  fontWeight={"700"}
                  fontSize="xl"
                >
                  {cm?.itemsRemaining.toNumber()}
                </Text>
              </Flex>
              <Text
                color="whitesmoke"
                textAlign="center"
                fontWeight={"700"}
                fontSize="xl"
              >
                {isV3(cm.model) ? "v3" : "v2"}
              </Text>

              <Flex alignItems="center">
                <Text
                  color="gray.500"
                  textAlign="center"
                  fontWeight={"500"}
                  fontSize="md"
                  mr="2"
                >
                  {`total:`}
                </Text>
                <Text
                  color="whitesmoke"
                  textAlign="center"
                  fontWeight={"700"}
                  fontSize="xl"
                >
                  {cm?.itemsAvailable.toNumber()}
                </Text>
              </Flex>
            </Flex>
            <Flex
              mt="4"
              borderColor="gray.400"
              borderStyle="solid"
              borderWidth={"1px"}
              borderRadius="4"
              p="2"
              justifyContent={"space-between"}
            >
              <Text
                color="gray.500"
                textAlign="center"
                fontWeight={"500"}
                fontSize="md"
              >
                price:
              </Text>
              <Text
                color="whitesmoke"
                textAlign="center"
                fontWeight={"700"}
                fontSize="xl"
              >
                {`${price} ${ticker}`}
              </Text>
            </Flex>
            <Button
              mt="4"
              w="full"
              loadingText="minting..."
              disabled={
                !walletAdapter.connected || loading || mintButton.disabled
              }
              isLoading={loading}
              onClick={mint}
            >
              {mintButton.title}
            </Button>
          </Box>
        )}
      </Container>
    </div>
  );
}
