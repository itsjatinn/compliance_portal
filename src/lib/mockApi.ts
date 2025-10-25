// small mock api to let UI render quickly
export async function fetchOrgs() {
  return Promise.resolve([
    { id: "org_a", name: "Acme Corp" },
    { id: "org_b", name: "BrightTech" },
    { id: "org_c", name: "Cornerstone" },
  ]);
}

export async function fetchOrgOverview(orgId: string) {
  // stubbed stats — replace with real API
  return Promise.resolve({
    orgId,
    employees: 248,
    active: 187,
    completionRate: 78, // %
    avgProgress: 62, // %
    certified: 94,
    lastUpdated: new Date().toISOString(),
  });
}

export async function fetchCourses(orgId?: string) {
  // return Course[] shape expected by the component
  const courses = Array.from({ length: 9 }).map((_, i) => ({
    id: `c-${i + 1}`,
    title: `Course ${i + 1}`,
    description: `Sample description for Course ${i + 1}`,
    durationMinutes: 20 + i * 5, // integer minutes
    mandatory: i % 2 === 0,
    image: "/5994373.jpg", // matches Course.image
    lessons: 3 + (i % 5),
    uploadedAt: new Date().toISOString(),
  }));
  return Promise.resolve(courses);
}
