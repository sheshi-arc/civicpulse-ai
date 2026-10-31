import AdminTicketDetailClient from "./AdminTicketDetailClient";

export function generateStaticParams() {
  return Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1) }));
}

export default function AdminTicketDetailPage() {
  return <AdminTicketDetailClient />;
}
