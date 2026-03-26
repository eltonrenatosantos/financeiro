import { MonthSummaryView } from "../../../components/month-summary-view";

export default async function DashboardMonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;

  return <MonthSummaryView monthKey={month} />;
}
