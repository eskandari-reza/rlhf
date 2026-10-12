import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const isDev = process.env.AUTH_MODE === "dev";

  async function credentialsLogin(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/login?error=invalid");
      }
      throw err;
    }
  }

  async function googleLogin() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Login</h1>
      {error && <p style={{ color: "crimson" }}>Invalid email or password.</p>}

      {isDev && (
        <form action={credentialsLogin} style={{ display: "grid", gap: 12 }}>
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" required />
          <button type="submit">Sign in (dev)</button>
        </form>
      )}

      <form action={googleLogin} style={{ marginTop: 16 }}>
        <button type="submit">Sign in with Google</button>
      </form>
    </main>
  );
}