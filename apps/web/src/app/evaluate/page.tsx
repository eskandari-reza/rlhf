import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EvaluateClient from "./evaluate-client";

export default async function EvaluatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <EvaluateClient />;
}