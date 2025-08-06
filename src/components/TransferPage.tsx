"use client";

import { TransferFormV2 } from "@/components/TransferFormV2";
import { CustomSession } from "@/lib/auth-utils";

export function TransferPage({ session }: { session: CustomSession | null }) {
  return <TransferFormV2 />;
}