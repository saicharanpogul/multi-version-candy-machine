import React, { useEffect, useState } from "react";

const usePhantom = () => {
  const [isPhantom, setIsPhantom] = useState(false);

  useEffect(() => {
    // @ts-ignore
    if (window!.solana) {
      setIsPhantom(true);
    }
  }, []);

  return isPhantom;
};

export default usePhantom;
