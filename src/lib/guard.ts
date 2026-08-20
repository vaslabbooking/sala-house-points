import "server-only";
import { redirect } from "next/navigation";
import { hasAccess, isAdmin } from "./auth";

/** Screens teachers use. Redirects to the code prompt when the gate is on. */
export async function requireAccess(returnTo = "/"): Promise<void> {
  if (!(await hasAccess())) {
    redirect(`/access?next=${encodeURIComponent(returnTo)}`);
  }
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
