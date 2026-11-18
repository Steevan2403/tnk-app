import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

const buildings = [
  {
    id: "seed_example_tower",
    name: "Example Tower",
    address: "100 Example Street",
    suburb: "Sydney",
    state: "NSW",
    postcode: "2000",
    photoUrl: null,
    lotCount: 48,
  },
  {
    id: "seed_sample_court",
    name: "Sample Court",
    address: "8 Sample Road",
    suburb: "Pyrmont",
    state: "NSW",
    postcode: "2009",
    photoUrl: null,
    lotCount: 24,
  },
];

async function main() {
  for (const building of buildings) {
    await prisma.building.upsert({
      where: { id: building.id },
      update: building,
      create: building,
    });
  }

  const passwordHash = await hashPassword("example-admin-pass");
  const admin = await prisma.user.upsert({
    where: { email: "admin@tnk.example" },
    update: {
      name: "Example Admin",
      passwordHash,
      role: "admin",
    },
    create: {
      email: "admin@tnk.example",
      name: "Example Admin",
      passwordHash,
      role: "admin",
      selectedBuildingId: "seed_example_tower",
    },
  });

  if (!admin.selectedBuildingId) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { selectedBuildingId: "seed_example_tower" },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
