import { requireUser } from "@/lib/authz";
import { ROLE_LABEL } from "@/lib/roles";
import { getUnreadNotificationCount } from "@/server/services/notifications";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await getUnreadNotificationCount(user.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        user={{
          name: user.name ?? "",
          username: user.username ?? "",
          role: user.role,
          roleLabel: ROLE_LABEL[user.role] ?? user.role,
        }}
        unreadCount={unread}
      />
      <div className="md:pl-64">
        <main className="mx-auto  px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
