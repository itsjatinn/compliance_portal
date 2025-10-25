// compliance_portal/src/app/courses/[id]/page.tsx
import React from "react";
import CourseClientWrapper from "./course.client";

type Props = { params: { id?: string } };

export default function Page({ params }: Props) {
  // Unwrap on the server — ensure a plain string is passed to client
  const courseId = params?.id;

  if (!courseId) {
    console.error("❌ page.tsx: missing params.id:", params);
    return <div className="p-6 text-red-600">Invalid course URL (missing id).</div>;
  }

  return <CourseClientWrapper courseId={courseId} />;
}
