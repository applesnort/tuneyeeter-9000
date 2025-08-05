import { getCustomSession } from "@/lib/auth-utils";
import { TestTransferClient } from "@/components/TestTransferClient";

export default async function TestTransferPage() {
  const session = await getCustomSession();
  
  return <TestTransferClient session={session} />;
}