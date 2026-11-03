"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Legend } from "@/components/Legend";
import { MonthCalendar } from "@/components/MonthCalendar";
import { MonthNav } from "@/components/MonthNav";
import { SummaryTiles } from "@/components/SummaryTiles";
import { TodayCard } from "@/components/TodayCard";
import { Alert, Card, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { keys, useMe } from "@/lib/queries";
import { useToday } from "@/lib/clock";
import type { MyMonthResponse } from "@/lib/types";

export default function MyAttendancePage() {
  const me = useMe();
  const today = useToday();
  // Null until the user picks a month; then the current month follows the browser clock.
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? today?.slice(0, 7) ?? null;
  const data = useQuery({
    queryKey: keys.myMonth(month ?? ""),
    queryFn: () => api<MyMonthResponse>(`/api/attendance/month?month=${month}`),
    enabled: month !== null,
  });

  return (
    <>
      <PageHeader title={`Hi, ${me.data?.user.name.split(" ")[0] ?? "there"}`} subtitle="Check in when you start, check out when you finish." />
      <div className="space-y-6">
        <TodayCard />
        <Card title="Your month" action={month && <MonthNav month={month} onChange={setPicked} />}>
          <div className="space-y-5 p-5">
            {data.isPending ? (
              <Spinner />
            ) : data.isError ? (
              <Alert>{errorMessage(data.error)}</Alert>
            ) : (
              <>
                <SummaryTiles summary={data.data.person.summary} />
                <MonthCalendar days={data.data.person.days} today={data.data.today} />
                <Legend />
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
