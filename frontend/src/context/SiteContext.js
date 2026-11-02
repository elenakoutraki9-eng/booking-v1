import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const SiteContext = createContext({ info: null, refresh: () => {} });

export function SiteProvider({ children }) {
  const [info, setInfo] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/public/info");
      setInfo(data);
    } catch {
      setInfo((cur) => cur);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <SiteContext.Provider value={{ info, refresh }}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
export const useZones = () => useContext(SiteContext).info?.zones || [];
