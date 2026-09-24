"use client";

import CombinedTimesheetEditor from "@/components/timesheets/CombinedTimesheetEditor";
import type { TimesheetDTO } from "@/lib/types";

export default function PreviewClient({
  teamLeaderNome,
  timesheets,
}: {
  teamLeaderNome: string | null;
  timesheets: TimesheetDTO[];
}) {
  return (
    <CombinedTimesheetEditor
      teamLeaderNome={teamLeaderNome}
      timesheets={timesheets}
      onChanged={() => {}}
      readOnly
      printable={false}
      preview
    />
  );
}
