import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminClient from "./admin-client";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "admin") redirect("/dashboard");
  return <AdminClient />;
}