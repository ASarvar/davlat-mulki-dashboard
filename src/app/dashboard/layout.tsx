import { requireUser } from "@/lib/authz";
import { Sidebar } from "@/components/Sidebar";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  REGION_USER: "Hudud foydalanuvchisi",
  VIEWER: "Kuzatuvchi",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        user={{
          name: user.name ?? "",
          email: user.email ?? "",
          role: user.role,
          roleLabel: ROLE_LABEL[user.role] ?? user.role,
        }}
      />
      <div className="md:pl-64">
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
