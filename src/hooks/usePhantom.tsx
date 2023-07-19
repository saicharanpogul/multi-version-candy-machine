import React, { useEffect, useState } from "react";

const usePhantom = () => {
  const [isPhantom, setIsPhantom] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      // @ts-ignore
      if (typeof window !== "undefined" && window!.solana) {
        setIsPhantom(true);
      }
    }, 1000);
  }, []);

  return isPhantom;
};

export default usePhantom;
