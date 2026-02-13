"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RealtimeProvider } from "@upstash/realtime/client";
import { useState } from "react";

const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <RealtimeProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </RealtimeProvider>
  );
};

export default Providers;
