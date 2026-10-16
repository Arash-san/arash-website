"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GuestMeet, Landing, Loading } from "@/components/meet/guest-meet";

function Inner() {
  const token = useSearchParams().get("m");
  if (!token || !/^[A-Za-z0-9_-]{6,40}$/.test(token)) return <Landing />;
  return <GuestMeet token={token} />;
}

export default function MeetPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Inner />
    </Suspense>
  );
}
