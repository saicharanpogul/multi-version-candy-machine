import Head from "next/head";
import Image from "next/image";
import { Roboto } from "@next/font/google";
import styles from "@/styles/Home.module.css";
import { Box, Container, Flex, Heading, Text } from "@chakra-ui/layout";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  Button,
  FormControl,
  FormErrorMessage,
  Input,
  useToast,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import useMetaplex from "@/hooks/useMetaplex";
import {
  CandyMachine,
  CandyMachineV2,
  DefaultCandyGuardSettings,
} from "@metaplex-foundation/js";
import Navbar from "@/components/Navbar";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { truncateAddress } from "@/utils";

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
  const { getCandyMachine, isV3, metaplex } = useMetaplex();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
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
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      cmId: "",
    },
  });
  const onSubmit = (data: { cmId: string }) => {
    setCmId(data.cmId);
    getCandyMachine(new PublicKey(data.cmId))
      .then((_cm) => {
        setCm(_cm);
      })
      .catch((error) => {
        console.error(error);
      });
  };
  const mint = useCallback(async () => {
    try {
      if (!cmId && !cm && !walletAdapter.connected) return;
      setLoading(true);
      if (cm && isV3(cm?.model)) {
        const mint = await metaplex.candyMachines().mint({
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
        const mint = await metaplex.candyMachinesV2().mint({
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
      getCandyMachine(new PublicKey(cmId))
        .then((_cm) => {
          setCm(_cm);
        })
        .catch((error) => {
          console.error(error);
        });
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
  }, [cm, isV3, metaplex, toast, walletAdapter.connected]);
  const isMintDisabled = useCallback(async () => {
    if (!walletAdapter || !connection || !walletAdapter?.publicKey) return;
    return (
      (await connection.getBalance(walletAdapter?.publicKey as PublicKey)) <
      // @ts-ignore
      (isV3(cm?.model)
        ? // @ts-ignore
          cm?.accountInfo?.lamports.basisPoints.toNumber()
        : // @ts-ignore
          cm?.price?.basisPoints.toNumber())
    );
  }, []);
  useEffect(() => {
    isMintDisabled().then((isDisabled) => {
      if (isDisabled) {
        setMintButton({ title: "insufficient balance", disabled: true });
      } else {
        setMintButton({ title: "mint", disabled: false });
      }
    });
  }, [isMintDisabled]);
  return (
    <div className={roboto.className}>
      <Head>
        <title>multi-version cm</title>
        <meta name="description" content="set cm id from any of localnet, devnet, & mainnet-beta network and mint." />
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
            <Button mt="4" w="full" type="submit">
              set
            </Button>
          </form>
        </Box>
        {cm && (
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
                {isV3(cm.model)
                  ? `${
                      // @ts-ignore
                      cm?.accountInfo?.lamports.basisPoints.toNumber() /
                      LAMPORTS_PER_SOL
                    } sol`
                  : `${
                      // @ts-ignore
                      cm?.price.basisPoints.toNumber() / LAMPORTS_PER_SOL
                    } sol`}
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
