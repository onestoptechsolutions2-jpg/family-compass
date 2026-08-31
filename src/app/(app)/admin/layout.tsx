import { requirePlatformAdmin } from "@/lib/rbac";
import { NavTabs } from "@/components/NavTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const tabs = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/claims", label: "Claims" },
    { href: "/admin/research", label: "Research" },
    { href: "/admin/system", label: "System" },
    { href: "/admin/settings", label: "Settings" },
  ];
  return (
    <div className="flex flex-col gap-6">
      <NavTabs tabs={tabs} />
      {children}
    </div>
  );
}
