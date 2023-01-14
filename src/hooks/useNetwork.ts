import React, { useCallback, useEffect, useState } from "react";

const useNetwork = () => {
  const [network, setNetwork] = useState<Network>("devnet");
  useEffect(() => {
    const _net = localStorage.getItem("network");
    if (!_net) {
      setNetwork("devnet");
    } else {
      setNetwork(_net as Network);
    }
  }, []);
  const changeNetwork = useCallback((network: Network) => {
    localStorage.setItem("network", network);
    setNetwork(localStorage.getItem("network") as Network);
  }, []);
  return { network, changeNetwork };
};

export default useNetwork;
