import useNetwork from "@/hooks/useNetwork";
import {
  Box,
  Button,
  Divider,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  useDisclosure,
  useMediaQuery,
  useToast,
} from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletName } from "@solana/wallet-adapter-wallets";
import React, { useCallback, useEffect, useState } from "react";
import usePhantom from "../hooks/usePhantom";
import { NETWORK, truncateAddress } from "../utils";

interface WithChildren {
  children: React.ReactNode;
  onChildClick: () => void;
  style?: {};
}

interface WithoutChildren {}

type Props = XOR<WithChildren, WithoutChildren>;

const ConnectWalletButton: React.FC<Props> = ({
  children,
  onChildClick,
  style,
}) => {
  const isPhantom = usePhantom();
  const { network, changeNetwork } = useNetwork();
  const { connected, connect, select, disconnect, publicKey, wallet } =
    useWallet();
  const [base58, setBase58] = useState("");
  const toast = useToast();
  const { onClose, isOpen, onOpen } = useDisclosure();
  const [isMobileOrTablet] = useMediaQuery("(min-width: 600px)");
  const isWindowContext = typeof window !== "undefined";
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();

  useEffect(() => {}, [isPhantom]);

  useEffect(() => {
    wallet?.adapter.addListener("error", (error) => {
      toast({
        title: error.name,
        description: error.message,
        duration: 5000,
        status: "error",
        isClosable: true,
      });
    });
    return () => {
      wallet?.adapter.removeListener("error");
    };
  }, [wallet]);
  useEffect(() => {
    if (connected && publicKey) {
      setBase58(publicKey.toBase58());
    }
  }, [connected]);
  const connectWallet = useCallback(async () => {
    if (!connected) {
      try {
        select(PhantomWalletName);
        await connect().catch((e) => console.error(e));
        onClose();
      } catch (error) {}
    } else {
      onChildClick && onChildClick();
    }
  }, [connected]);
  const disconnectWallet = useCallback(async () => {
    if (connected) {
      await disconnect();
      onClose();
      localStorage.removeItem("walletCmdNfts");
    }
  }, [connected]);
  const copyAddress = useCallback(async () => {
    if (connected) {
      await navigator.clipboard.writeText(base58);
      toast({
        title: "Copied Address",
        description: "Address copied to clipboard",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
      onClose();
    }
  }, [base58, connected, onClose, toast]);
  return (
    <Box {...style}>
      <Popover
        placement="bottom-end"
        onClose={onClose}
        isOpen={isOpen}
        onOpen={onOpen}
      >
        <PopoverTrigger>
          <Button
            color={"black"}
            backgroundColor="whitesmoke"
            border="1px"
            _hover={{ backgroundColor: "whitesmoke" }}
            _active={{ backgroundColor: "whitesmoke" }}
            onClick={
              isPhantom
                ? connectWallet
                : () => {
                    if (!isMobileOrTablet) {
                      return window.open(
                        `https://phantom.app/ul/browse/https://tatvos.saicharanpogul.xyz`
                      );
                    }
                    return window.open("https://phantom.app");
                  }
            }
          >
            {children
              ? children
              : isPhantom
              ? connected
                ? truncateAddress(base58)
                : "connect wallet"
              : "install phantom"}
          </Button>
        </PopoverTrigger>
        {isPhantom && connected && !children && (
          <PopoverContent background={"black"} maxWidth={150}>
            <PopoverBody
              display={"flex"}
              justifyContent={"center"}
              flexDirection="column"
            >
              <Button
                width={"full"}
                variant="unstyled"
                color={"white"}
                onClick={disconnectWallet}
              >
                disconnect
              </Button>
              <Divider color="primary" />
              <Button
                width={"full"}
                variant="unstyled"
                color={"white"}
                onClick={onModalOpen}
              >
                {network}
              </Button>
              <Divider color="primary" />
              <Button
                width={"full"}
                variant="unstyled"
                color={"white"}
                onClick={copyAddress}
              >
                copy address
              </Button>
            </PopoverBody>
          </PopoverContent>
        )}
      </Popover>
      <Modal isOpen={isModalOpen} onClose={onModalClose} isCentered>
        <ModalOverlay />
        <ModalContent w="xs">
          <ModalHeader bg="gray.900" color="white">
            change network
          </ModalHeader>
          <ModalCloseButton color="white" />
          <ModalBody bg="gray.900">
            <Button
              w="full"
              variant="unstyled"
              color="white"
              onClick={() => {
                changeNetwork("localnet");
                onModalClose();
                toast({ title: "network change: localnet" });
              }}
            >
              localnet
            </Button>
            <Button
              mt="2"
              w="full"
              variant="unstyled"
              color="white"
              onClick={() => {
                changeNetwork("devnet");
                onModalClose();
                toast({ title: "network change: devnet" });
              }}
            >
              devnet
            </Button>
            <Button
              mt="2"
              w="full"
              variant="unstyled"
              color="white"
              onClick={() => {
                changeNetwork("mainnet-beta");
                onModalClose();
                toast({ title: "network change: mainnet-beta" });
              }}
            >
              mainnet-beta
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ConnectWalletButton;
