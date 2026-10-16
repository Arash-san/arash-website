"use client";

import { Suspense } from "react";
import { AdminMeet } from "@/components/meet/admin-meet";
import { Loading } from "@/components/meet/guest-meet";

export default function MeetAdminPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminMeet />
    </Suspense>
  );
}
