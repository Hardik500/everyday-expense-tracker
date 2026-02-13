import { SWRConfig } from "swr";
import { swrConfig, swrFetcher } from "../hooks/useSWRConfig";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        ...swrConfig,
      }}
    >
      {children}
    </SWRConfig>
  );
}
