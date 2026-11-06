import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { siteName } from "@/lib/site";
import { logout } from "../login/actions";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <>
      <header className="topbar">
        <div className="inner">
          <span className="name">{siteName()}<small>contrôle des billets</small></span>
          <form action={logout} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {user.role === "ADMIN" && <Link href="/" className="btn btn-ghost btn-sm">Administration</Link>}
            <button type="submit" className="btn-ghost btn-sm">Se déconnecter</button>
          </form>
        </div>
      </header>
      <div className="container">{children}</div>
    </>
  );
}
