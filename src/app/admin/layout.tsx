import { isAdmin } from "@/lib/auth";
import { adminLogout } from "./actions";

/**
 * Individual pages guard themselves — this only decides whether to show the
 * nav, so the login screen can share the layout without redirecting itself.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const signedIn = await isAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {signedIn && (
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-1 px-4 py-3 sm:px-6">
            <span className="mr-3 text-sm font-bold text-ink">Admin</span>
            <AdminLink href="/admin">Overview</AdminLink>
            <AdminLink href="/admin/roster">Students</AdminLink>
            <AdminLink href="/admin/teachers">Teachers</AdminLink>
            <AdminLink href="/admin/log">Award log</AdminLink>
            <AdminLink href="/admin/settings">Settings</AdminLink>
            <div className="ml-auto flex items-center gap-1">
              <AdminLink href="/">Entry screen</AdminLink>
              <form action={adminLogout}>
                <button
                  type="submit"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-line/70 hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>
      )}
      <main className="flex-1">{children}</main>
    </div>
  );
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-line/70 hover:text-ink"
    >
      {children}
    </a>
  );
}
