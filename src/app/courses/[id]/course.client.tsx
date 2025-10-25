// compliance_portal/src/app/courses/[id]/course.client.tsx
"use client";

import React from "react";
import CoursePageClient from "../../../components/course/CoursePageClient";

export default function CourseClientWrapper({ courseId }: { courseId?: string }) {
  if (!courseId) {
    console.error("❌ CourseClientWrapper: courseId not provided");
    return <div className="p-6 text-red-600">Course ID missing — check the route.</div>;
  }

  // small runtime log to confirm client receives a plain string
  console.log("✅ CourseClientWrapper received courseId:", courseId);

  return <CoursePageClient courseId={courseId} />;
}