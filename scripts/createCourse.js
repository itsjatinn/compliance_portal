// scripts/createCourse.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const id = "course_dcz9f70";
  const existing = await prisma.course.findUnique({ where: { id } });
  if (existing) {
    console.log("Course already exists:", existing.id);
    return;
  }

  const created = await prisma.course.create({
    data: {
      id,
      title: "Test Course (created for progress debug)",
      description: "Auto-created course for testing the progress endpoint.",
      duration: "10",
      lessons: 1,
      image: null,
    },
  });

  console.log("Created course:", created.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
