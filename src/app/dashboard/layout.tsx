import { requireUserOrRedirect } from "@/lib/authz";
import { ROLE_LABEL } from "@/lib/roles";
import { getUnreadNotificationCount } from "@/server/services/notifications";
import { allowedSectionKeys } from "@/server/services/sectionAccess";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // ⚠️ Redirect qiladi (xato emas) — eskirgan sessiya login'ga tushsin.
  const user = await requireUserOrRedirect();
  // Menyu tarkibi SERVERDA hal qilinadi — `Sidebar` client komponenti hech qanday
  // rol mantiqini bilmaydi (ilgari bilardi va sahifa qorovulidan ajralib ketardi).
  const [unread, allowedKeys] = await Promise.all([
    getUnreadNotificationCount(user.id),
    allowedSectionKeys(user),
  ]);

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
        allowedKeys={allowedKeys}
      />
      <div className="md:pl-64">
        <main className="mx-auto  px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
