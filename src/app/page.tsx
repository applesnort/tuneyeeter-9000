import { TransferPage } from "@/components/TransferPage";
import { getCustomSession } from "@/lib/auth-utils";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string; error?: string }>;
}) {
  const session = await getCustomSession();
  const params = await searchParams;
  
  // Clean URL after auth
  if (params.auth || params.error) {
    redirect("/");
  }
  
  return <TransferPage session={session} />;
}