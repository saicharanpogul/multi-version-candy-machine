import Navbar from "@/components/Navbar";
import useMetaplex from "@/hooks/useMetaplex";
import { getUrls, truncateAddress } from "@/utils";
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
  CandyMachineV2,
  DefaultCandyGuardSettings,
  Nft,
  NftWithToken,
  Sft,
  SftWithToken,
  sol,
} from "@metaplex-foundation/js";
import { Roboto } from "@next/font/google";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import {
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {} from "@project-serum/anchor";
import useUmi from "@/hooks/useUmi";
import {
  generateSigner,
  some,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import { setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";
import {
  mintV2,
  mint as mintV1,
  CandyMachine,
  CandyGuard,
  DefaultGuardSet,
} from "@metaplex-foundation/mpl-candy-machine";
import {
  fetchDigitalAsset,
  Metadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { getMint } from "@solana/spl-token";

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
  const [cm, setCm] = useState<{
    candyMachine: CandyMachine;
    candyGuard: CandyGuard<DefaultGuardSet>;
  }>();
  const [tokenMint, setTokenMint] = useState<PublicKey>();
  const [tokenMintMetadata, setTokenMintMetadata] = useState<Metadata>();
  const [ticker, setTicker] = useState("sol");
  const [isChanged, setIsChanged] = useState(false);
  const [price, setPrice] = useState(0);
  const change = () => {
    setIsChanged((_prev) => !_prev);
  };
  const { getCandyMachine, isV3, umi, network } = useUmi(change);
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
      try {
        const { candyMachine, candyGuard } = await getCandyMachine(_cmId);
        if (candyMachine && candyGuard) {
          debugger;
          setCm({
            candyMachine: candyMachine as CandyMachine,
            candyGuard: candyGuard as CandyGuard<DefaultGuardSet>,
          });

          // TODO: SOL PAYMENT
          if (candyGuard.guards.solPayment.__option === "Some") {
            const solBasisPointsPrice = parseInt(
              candyGuard.guards.solPayment.value.lamports.basisPoints.toString()
            );
            setPrice(solBasisPointsPrice / LAMPORTS_PER_SOL);
            const _solBalance = await connection.getBalance(
              walletAdapter.publicKey as PublicKey
            );
            if (_solBalance < solBasisPointsPrice) {
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

          // TODO: TOKEN PAYMENT
          if (candyGuard.guards.tokenPayment.__option === "Some") {
            const tokenPayment = candyGuard.guards.tokenPayment.value;
            const mint = toWeb3JsPublicKey(tokenPayment.mint);
            const amount = tokenPayment.amount;
            const tokenBasisPointsPrice = parseInt(amount.toString());
            setTokenMint(mint);
            const mintDetails = await getMint(connection, mint);
            setPrice(tokenBasisPointsPrice / 10 ** mintDetails.decimals);
            try {
              const asset = await fetchDigitalAsset(
                umi,
                fromWeb3JsPublicKey(mint)
              );
              setTokenMintMetadata(asset.metadata);
              setTicker(asset.metadata.symbol.toLowerCase());
            } catch (error) {
              setTicker("unknown");
            }
            const ata = getAssociatedTokenAddressSync(
              mint,
              walletAdapter.publicKey as PublicKey
            );
            console.log(ata.toBase58());
            const tokenAccounts =
              await connection.getParsedTokenAccountsByOwner(
                walletAdapter.publicKey as PublicKey,
                { mint: mint }
              );
            if (tokenAccounts.value.length === 0) {
              return setMintButton({
                title: "No Token Account",
                disabled: true,
              });
            }
            const _tokenPaymentBalance =
              await connection.getTokenAccountBalance(ata);
            console.log(_tokenPaymentBalance.value.uiAmount);
            if (
              (_tokenPaymentBalance.value.uiAmount as number) <
              tokenBasisPointsPrice
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

          // TODO: TOKEN BURN
          if (candyGuard.guards.tokenBurn.__option === "Some") {
            const tokenBurn = candyGuard.guards.tokenBurn.value;
            const mint = toWeb3JsPublicKey(tokenBurn.mint);
            const expectedAmount = parseInt(tokenBurn.amount.toString());
            setTokenMint(mint);
            const mintDetails = await getMint(connection, mint);
            setPrice(expectedAmount / 10 ** mintDetails.decimals);
            try {
              const asset = await fetchDigitalAsset(
                umi,
                fromWeb3JsPublicKey(mint)
              );
              setTokenMintMetadata(asset.metadata);
              setTicker(asset.metadata.symbol.toLowerCase());
            } catch (error) {
              setTicker("unknown");
            }
            const ata = getAssociatedTokenAddressSync(
              mint,
              walletAdapter.publicKey as PublicKey
            );
            const _tokenBurnBalance = await connection.getTokenAccountBalance(
              ata
            );
            const tokenAccounts =
              await connection.getParsedTokenAccountsByOwner(
                walletAdapter.publicKey as PublicKey,
                { mint }
              );
            if (tokenAccounts.value.length === 0) {
              setMintButton({ title: "No Token Account", disabled: true });
            }
            if ((_tokenBurnBalance.value.uiAmount as number) < expectedAmount) {
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
        }

        // setCm(_cm);
        // console.log(candyMachine);
        // if (isV3(_cm.model)) {
        //   console.log("V3");
        //   // @ts-ignore
        //   if (_cm.candyGuard.guards.solPayment) {
        //     setPrice(
        //       // @ts-ignore
        //       _cm.candyGuard.guards.solPayment.amount.basisPoints.toNumber() /
        //         LAMPORTS_PER_SOL
        //     );
        //     const _balance = await connection.getBalance(
        //       walletAdapter.publicKey as PublicKey
        //     );
        //     if (
        //       _balance <=
        //       // @ts-ignore
        //       _cm.candyGuard.guards.solPayment.amount.basisPoints.toNumber()
        //     ) {
        //       setMintButton({
        //         title: "Insufficient Balance",
        //         disabled: true,
        //       });
        //     } else {
        //       setMintButton({
        //         title: "Mint",
        //         disabled: false,
        //       });
        //     }
        //   }
        //   // @ts-ignore
        //   if (_cm.candyGuard.guards.tokenPayment) {
        //     const token = await metaplex?.tokens().findMintByAddress({
        //       // @ts-ignore
        //       address: _cm.candyGuard.guards.tokenPayment.mint,
        //     });
        //     const decimals = token?.currency.decimals;
        //     setPrice(
        //       // @ts-ignore
        //       _cm.candyGuard.guards.tokenPayment.amount.basisPoints.toNumber() /
        //         10 ** (decimals as number)
        //     );
        //     // @ts-ignore
        //     const mint = _cm.candyGuard.guards.tokenPayment.mint;
        //     setTokenMint(mint);
        //     const nft = await metaplex
        //       ?.nfts()
        //       // @ts-ignore
        //       .findByMint({
        //         mintAddress: mint as PublicKey,
        //       });
        //     setTokenMintMetadata(nft);
        //     setTicker(nft!.symbol.toLowerCase());
        //     const tokenAccounts =
        //       await connection.getParsedTokenAccountsByOwner(
        //         walletAdapter.publicKey as PublicKey,
        //         // @ts-ignore
        //         { mint: mint }
        //       );
        //     if (tokenAccounts.value.length === 0) {
        //       setMintButton({ title: "No Token Account", disabled: true });
        //     } else {
        //       const tokenAccount = await getAssociatedTokenAddress(
        //         // @ts-ignore
        //         mint,
        //         walletAdapter.publicKey as PublicKey
        //       );
        //       const tokenBalance = await connection.getTokenAccountBalance(
        //         tokenAccount
        //       );
        //       if (
        //         // @ts-ignore
        //         tokenBalance.value.uiAmount <
        //         // @ts-ignore
        //         _cm.candyGuard.guards.tokenPayment.amount.basisPoints.toNumber() /
        //           10 ** (decimals as number)
        //       ) {
        //         setMintButton({
        //           title: "Insufficient Token Balance",
        //           disabled: true,
        //         });
        //       } else {
        //         setMintButton({
        //           title: "Mint",
        //           disabled: false,
        //         });
        //       }
        //     }
        //   }
        // } else {
        //   console.log("V2");
        //   // @ts-ignore
        //   if (_cm.tokenMintAddress) {
        //     // @ts-ignore
        //     setTokenMint(_cm.tokenMintAddress);
        //     // @ts-ignore
        //     // console.log(_cm.tokenMintAddress);
        //     const nft = await metaplex
        //       ?.nfts()
        //       // @ts-ignore
        //       .findByMint({ mintAddress: _cm.tokenMintAddress as PublicKey });
        //     setTokenMintMetadata(nft);
        //     // console.log(nft);
        //     setTicker(nft!.symbol.toLowerCase());
        //     const tokenAccounts =
        //       await connection.getParsedTokenAccountsByOwner(
        //         walletAdapter.publicKey as PublicKey,
        //         // @ts-ignore
        //         { mint: _cm.tokenMintAddress }
        //       );
        //     setPrice(
        //       // @ts-ignore
        //       _cm?.price.basisPoints.toNumber() /
        //         // @ts-ignore
        //         10 ** _cm?.price.currency.decimals
        //     );
        //     if (tokenAccounts.value.length === 0) {
        //       setMintButton({ title: "No Token Account", disabled: true });
        //     } else {
        //       const tokenAccount = await getAssociatedTokenAddress(
        //         // @ts-ignore
        //         _cm.tokenMintAddress,
        //         walletAdapter.publicKey as PublicKey
        //       );
        //       const tokenBalance = await connection.getTokenAccountBalance(
        //         tokenAccount
        //       );
        //       if (
        //         // @ts-ignore
        //         tokenBalance.value.uiAmount <
        //         // @ts-ignore
        //         _cm?.price?.basisPoints.toNumber() /
        //           // @ts-ignore
        //           10 ** _cm?.price.currency.decimals
        //       ) {
        //         setMintButton({
        //           title: "Insufficient Token Balance",
        //           disabled: true,
        //         });
        //       } else {
        //         setMintButton({
        //           title: "Mint",
        //           disabled: false,
        //         });
        //       }
        //     }
        //   } else {
        //     // @ts-ignore
        //     setPrice(_cm?.price.basisPoints.toNumber() / LAMPORTS_PER_SOL);
        //     const _balance = await connection.getBalance(
        //       walletAdapter.publicKey as PublicKey
        //     );
        //     console.log("balance:", _balance);
        //     if (
        //       _balance <=
        //       // @ts-ignore
        //       _cm?.price.basisPoints.toNumber()
        //     ) {
        //       setMintButton({
        //         title: "Insufficient Token Balance",
        //         disabled: true,
        //       });
        //     } else {
        //       setMintButton({
        //         title: "Mint",
        //         disabled: false,
        //       });
        //     }
        //   }
        // }
      } catch (error) {
        console.error(error);
      } finally {
        setSetting(false);
      }
    },
    [connection, getCandyMachine, umi, walletAdapter.publicKey]
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
      const nftMint = generateSigner(umi);
      const { signature } = await transactionBuilder()
        .add(setComputeUnitLimit(umi, { units: 800_000 }))
        .add(
          mintV2(umi, {
            candyMachine: cm!.candyMachine!.publicKey,
            nftMint,
            candyGuard: cm!.candyGuard.publicKey,
            collectionMint: cm!.candyMachine!.collectionMint,
            collectionUpdateAuthority: cm!.candyMachine!.authority,
            mintArgs: {
              addressGate:
                cm!.candyGuard.guards.addressGate.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.addressGate.value,
                    })
                  : null,
              allocation:
                cm!.candyGuard.guards.allocation.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.allocation.value,
                    })
                  : null,
              allowList:
                cm!.candyGuard.guards.allowList.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.allowList.value,
                    })
                  : null,
              botTax:
                cm!.candyGuard.guards.botTax.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.botTax.value,
                    })
                  : null,
              endDate:
                cm!.candyGuard.guards.endDate.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.endDate.value,
                    })
                  : null,
              freezeSolPayment:
                cm!.candyGuard.guards.freezeSolPayment.__option === "Some"
                  ? some({ ...cm!.candyGuard.guards.freezeSolPayment.value })
                  : null,
              freezeTokenPayment:
                cm!.candyGuard.guards.freezeTokenPayment.__option === "Some"
                  ? some({ ...cm!.candyGuard.guards.freezeTokenPayment.value })
                  : null,
              gatekeeper:
                cm!.candyGuard.guards.gatekeeper.__option === "Some"
                  ? some({
                      // TODO: tokenAccount missing
                      ...cm!.candyGuard.guards.gatekeeper.value,
                    })
                  : null,
              mintLimit:
                cm!.candyGuard.guards.mintLimit.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.mintLimit.value,
                    })
                  : null,

              // @ts-ignore TODO: mint, tokenStandard & tokenAccount missing
              nftBurn:
                cm!.candyGuard.guards.nftBurn.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.nftBurn.value,
                    })
                  : null,
              // @ts-ignore TODO: mint & tokenAccount missing
              nftGate:
                cm!.candyGuard.guards.nftGate.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.nftGate.value,
                    })
                  : null,
              // @ts-ignore TODO: mint, tokenStandard, ruleSet & tokenAccount missing
              nftPayment:
                cm!.candyGuard.guards.nftPayment.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.nftPayment.value,
                    })
                  : null,
              programGate:
                cm!.candyGuard.guards.programGate.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.programGate.value,
                    })
                  : null,
              redeemedAmount:
                cm!.candyGuard.guards.redeemedAmount.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.redeemedAmount.value,
                    })
                  : null,
              solPayment:
                cm!.candyGuard.guards.solPayment.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.solPayment.value,
                    })
                  : null,
              startDate:
                cm!.candyGuard.guards.startDate.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.startDate.value,
                    })
                  : null,
              // @ts-ignore TODO: signer missing
              thirdPartySigner:
                cm!.candyGuard.guards.thirdPartySigner.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.thirdPartySigner.value,
                    })
                  : null,
              token2022Payment:
                cm!.candyGuard.guards.token2022Payment.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.token2022Payment.value,
                    })
                  : null,
              tokenBurn:
                cm!.candyGuard.guards.tokenBurn.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.tokenBurn.value,
                    })
                  : null,
              tokenGate:
                cm!.candyGuard.guards.tokenGate.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.tokenGate.value,
                    })
                  : null,
              tokenPayment:
                cm!.candyGuard.guards.tokenPayment.__option === "Some"
                  ? some({
                      ...cm!.candyGuard.guards.tokenPayment.value,
                    })
                  : null,
            },
          })
        )
        .sendAndConfirm(umi, {
          send: { skipPreflight: false, commitment: "finalized" },
        });
      const [sig] = base58.deserialize(signature);
      console.log(getUrls(network, sig, "tx").explorer);
      //   if (cm && isV3(cm?.model)) {
      //     const mint = await metaplex!.candyMachines().mint({
      //       candyMachine: cm as CandyMachine<DefaultCandyGuardSettings>,
      //       collectionUpdateAuthority: cm?.authorityAddress as PublicKey,
      //     });
      //     console.log(mint);
      //     toast({
      //       title: `Minted: ${mint.nft.name}`,
      //       description: `Mint Address: ${truncateAddress(
      //         mint.nft.address.toBase58()
      //       )}`,
      //       duration: 10000,
      //     });
      //   } else {
      //     const mint = await metaplex!.candyMachinesV2().mint({
      //       candyMachine: cm as CandyMachineV2,
      //     });
      //     console.log(mint);
      //     toast({
      //       title: `Minted: ${mint.nft.name}`,
      //       description: `Mint Address: ${truncateAddress(
      //         mint.nft.address.toBase58()
      //       )}`,
      //       duration: 10000,
      //     });
      //   }
      toast({
        title: `Mint Successful!`,
        duration: 10000,
      });
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
  }, [cmId, cm, walletAdapter.connected, umi, network, toast, cmStatusRefresh]);

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
  }, [isChanged, umi, watch]);
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
          <FormControl isInvalid={!!errors.cmId}>
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
            onClick={handleSubmit(onSubmit)}
          >
            set
          </Button>
        </Box>
        {cm &&
          toWeb3JsPublicKey(cm.candyMachine.publicKey).toBase58() === cmId &&
          cmId === watch("cmId") && (
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
                    {parseInt(cm.candyMachine.data.itemsAvailable.toString()) -
                      parseInt(cm.candyMachine.itemsRedeemed.toString())}
                  </Text>
                </Flex>
                <Text
                  color="whitesmoke"
                  textAlign="center"
                  fontWeight={"700"}
                  fontSize="xl"
                >
                  {"v3"}
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
                    {cm.candyMachine.data.itemsAvailable.toString()}
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
