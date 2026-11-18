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

const categories = [
  ["seed_cat_electrical", "Electrical"],
  ["seed_cat_plumbing", "Plumbing"],
  ["seed_cat_locksmith", "Locksmith"],
  ["seed_cat_pumps", "Pumps"],
  ["seed_cat_roller_gate", "Roller gate"],
  ["seed_cat_cleaning", "Cleaning"],
  ["seed_cat_fire", "Fire services"],
  ["seed_cat_lifts", "Lifts"],
  ["seed_cat_pest", "Pest control"],
] as const;

const companies = [
  {
    id: "seed_co_electrical",
    name: "Example Electrical Pty Ltd",
    abn: "11111111111",
    address: "10 Example Street, Sydney NSW 2000",
    phone: "02 0000 0100",
    email: "office.electrical@example.com",
    website: "https://example.com/electrical",
    status: "approved" as const,
    categoryId: "seed_cat_electrical",
  },
  {
    id: "seed_co_plumbing",
    name: "Sample Plumbing Co",
    abn: "22222222222",
    address: "22 Sample Road, Pyrmont NSW 2009",
    phone: "02 0000 0200",
    email: "office.plumbing@example.com",
    website: "https://example.com/plumbing",
    status: "approved" as const,
    categoryId: "seed_cat_plumbing",
  },
  {
    id: "seed_co_locksmith",
    name: "Demo Locksmith",
    abn: "33333333333",
    address: "5 Demo Lane, Surry Hills NSW 2010",
    phone: "02 0000 0300",
    email: "office.locksmith@example.com",
    website: "https://example.com/locksmith",
    status: "pending" as const,
    categoryId: "seed_cat_locksmith",
  },
  {
    id: "seed_co_cleaning",
    name: "Placeholder Cleaning",
    abn: "44444444444",
    address: "80 Placeholder Avenue, Redfern NSW 2016",
    phone: "02 0000 0400",
    email: "office.cleaning@example.com",
    website: "https://example.com/cleaning",
    status: "approved" as const,
    categoryId: "seed_cat_cleaning",
  },
  {
    id: "seed_co_fire",
    name: "Fictional Fire Services",
    abn: "55555555555",
    address: "3 Fictional Place, Alexandria NSW 2015",
    phone: "02 0000 0500",
    email: "office.fire@example.com",
    website: "https://example.com/fire",
    status: "approved" as const,
    categoryId: "seed_cat_fire",
  },
];

const contacts = [
  {
    id: "seed_contact_pat",
    companyId: "seed_co_electrical",
    name: "Pat Example",
    title: "Site lead",
    phone: "02 0000 0101",
    mobile: "0400 000 101",
    email: "pat.example@example.com",
  },
  {
    id: "seed_contact_sam",
    companyId: "seed_co_electrical",
    name: "Sam Sample",
    title: "Accounts",
    phone: "02 0000 0102",
    mobile: "0400 000 102",
    email: "sam.sample@example.com",
  },
  {
    id: "seed_contact_casey",
    companyId: "seed_co_plumbing",
    name: "Casey Placeholder",
    title: "Plumber",
    phone: "02 0000 0201",
    mobile: "0400 000 201",
    email: "casey.placeholder@example.com",
  },
  {
    id: "seed_contact_riley",
    companyId: "seed_co_locksmith",
    name: "Riley Demo",
    title: "Locksmith",
    phone: "02 0000 0301",
    mobile: "0400 000 301",
    email: "riley.demo@example.com",
  },
  {
    id: "seed_contact_jordan",
    companyId: "seed_co_cleaning",
    name: "Jordan Example",
    title: "Supervisor",
    phone: "02 0000 0401",
    mobile: "0400 000 401",
    email: "jordan.example@example.com",
  },
  {
    id: "seed_contact_avery",
    companyId: "seed_co_fire",
    name: "Avery Sample",
    title: "Technician",
    phone: "02 0000 0501",
    mobile: "0400 000 501",
    email: "avery.sample@example.com",
  },
];

const insurances = [
  {
    id: "seed_ins_electrical",
    companyId: "seed_co_electrical",
    type: "Public liability",
    policyNumber: "PL-EX-1001",
    insurer: "Example Cover",
    expiresOn: new Date("2028-06-30T00:00:00.000Z"),
  },
  {
    id: "seed_ins_plumbing",
    companyId: "seed_co_plumbing",
    type: "Workers compensation",
    policyNumber: "WC-EX-2002",
    insurer: "Sample Assurance",
    expiresOn: new Date("2024-05-01T00:00:00.000Z"),
  },
  {
    id: "seed_ins_cleaning",
    companyId: "seed_co_cleaning",
    type: "Public liability",
    policyNumber: "PL-EX-4004",
    insurer: "Placeholder Mutual",
    expiresOn: new Date("2028-01-15T00:00:00.000Z"),
  },
  {
    id: "seed_ins_fire",
    companyId: "seed_co_fire",
    type: "Public liability",
    policyNumber: "PL-EX-5005",
    insurer: "Fictional Underwriters",
    expiresOn: new Date("2028-11-01T00:00:00.000Z"),
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

  for (const [id, name] of categories) {
    await prisma.contractorCategory.upsert({
      where: { id },
      update: { name },
      create: { id, name },
    });
  }

  const [adminHash, staffHash] = await Promise.all([
    hashPassword("example-admin-pass"),
    hashPassword("example-staff-pass"),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: "admin@tnk.example" },
    update: {
      name: "Example Admin",
      passwordHash: adminHash,
      role: "admin",
    },
    create: {
      email: "admin@tnk.example",
      name: "Example Admin",
      passwordHash: adminHash,
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

  const staff = await prisma.user.upsert({
    where: { email: "staff@tnk.example" },
    update: {
      name: "Example Staff",
      passwordHash: staffHash,
      role: "staff",
    },
    create: {
      email: "staff@tnk.example",
      name: "Example Staff",
      passwordHash: staffHash,
      role: "staff",
      selectedBuildingId: "seed_example_tower",
    },
  });

  if (!staff.selectedBuildingId) {
    await prisma.user.update({
      where: { id: staff.id },
      data: { selectedBuildingId: "seed_example_tower" },
    });
  }

  for (const company of companies) {
    await prisma.contractorCompany.upsert({
      where: { id: company.id },
      update: company,
      create: company,
    });
  }

  for (const contact of contacts) {
    await prisma.contractorContact.upsert({
      where: { id: contact.id },
      update: contact,
      create: contact,
    });
  }

  for (const insurance of insurances) {
    await prisma.contractorInsurance.upsert({
      where: { id: insurance.id },
      update: insurance,
      create: insurance,
    });
  }

  const notes = [
    {
      id: "seed_note_electrical",
      companyId: "seed_co_electrical",
      body: "Called about the sample switchboard quote. Follow up next week.",
      authorId: admin.id,
    },
    {
      id: "seed_note_plumbing",
      companyId: "seed_co_plumbing",
      body: "Insurance lapsed. Asked Sample Plumbing for a current certificate.",
      authorId: admin.id,
    },
  ];

  for (const note of notes) {
    await prisma.contractorNote.upsert({
      where: { id: note.id },
      update: note,
      create: note,
    });
  }

  await seedApartments(admin.id);
  await seedAssets();
}

const apartmentPlan = [
  ["101", "1"],
  ["102", "2"],
  ["103", "3"],
  ["104", "4"],
  ["201", "5"],
  ["202", "6"],
  ["203", "7"],
  ["204", "8"],
  ["301", "9"],
  ["302", "10"],
  ["303", "11"],
  ["304", "12"],
] as const;

const residentPlan = [
  ["seed_res_alex", "101", "Alex", "Example", "owner", "02 0000 1001", "0400 000 001", "alex.example@example.com", "2023-02-01", null, true],
  ["seed_res_blake", "101", "Blake", "Sample", "tenant", null, "0400 000 002", "blake.sample@example.com", "2022-03-01", "2025-06-01", false],
  ["seed_res_casey", "102", "Casey", "Placeholder", "owner", "02 0000 1002", "0400 000 003", "casey.placeholder@example.com", "2021-11-15", null, true],
  ["seed_res_dana", "103", "Dana", "Demo", "tenant", null, "0400 000 004", "dana.demo@example.com", "2024-01-08", null, true],
  ["seed_res_eden", "103", "Eden", "Example", "other", null, "0400 000 005", "eden.example@example.com", "2024-04-01", null, false],
  ["seed_res_finley", "104", "Finley", "Sample", "owner", "02 0000 1004", "0400 000 006", "finley.sample@example.com", "2020-07-01", null, true],
  ["seed_res_gray", "201", "Gray", "Placeholder", "owner", null, "0400 000 007", "gray.placeholder@example.com", "2023-09-12", null, true],
  ["seed_res_harper", "202", "Harper", "Demo", "tenant", null, "0400 000 008", "harper.demo@example.com", "2025-01-20", null, true],
  ["seed_res_indigo", "203", "Indigo", "Example", "owner", "02 0000 1009", "0400 000 009", "indigo.example@example.com", "2019-05-03", null, true],
  ["seed_res_jules", "203", "Jules", "Sample", "tenant", null, "0400 000 010", "jules.sample@example.com", "2024-08-01", null, false],
  ["seed_res_kai", "204", "Kai", "Placeholder", "owner", null, "0400 000 011", "kai.placeholder@example.com", "2022-12-01", null, true],
  ["seed_res_logan", "301", "Logan", "Demo", "tenant", null, "0400 000 012", "logan.demo@example.com", "2023-06-18", null, true],
  ["seed_res_morgan", "302", "Morgan", "Example", "owner", "02 0000 1013", "0400 000 013", "morgan.example@example.com", "2021-02-14", null, true],
  ["seed_res_quinn", "303", "Quinn", "Sample", "tenant", null, "0400 000 014", "quinn.sample@example.com", "2024-10-01", null, true],
  ["seed_res_reese", "303", "Reese", "Example", "other", null, "0400 000 015", "reese.example@example.com", "2024-10-01", null, false],
] as const;

function day(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function seedApartments(authorId: string) {
  for (const [number, lotNumber] of apartmentPlan) {
    const id = `seed_apt_${number}`;
    const data = {
      buildingId: "seed_example_tower",
      number,
      lotNumber,
      occupancy: number === "104" ? ("investment" as const) : ("owner_occupied" as const),
    };
    await prisma.apartment.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  for (const resident of residentPlan) {
    const [id, apartment, firstName, lastName, type, phone, mobile, email, moveInOn, moveOutOn, primaryContact] = resident;
    const data = {
      apartmentId: `seed_apt_${apartment}`,
      firstName,
      lastName,
      type,
      phone,
      mobile,
      email,
      moveInOn: day(moveInOn),
      moveOutOn: day(moveOutOn),
      primaryContact,
    };
    await prisma.resident.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  const vehicles = [
    {
      id: "seed_veh_exa001",
      apartmentId: "seed_apt_101",
      registration: "EXA-001",
      make: "Example",
      model: "Hatch",
      colour: "Blue",
      carSpace: "12",
      location: "Basement",
    },
    {
      id: "seed_veh_exa002",
      apartmentId: "seed_apt_201",
      registration: "EXA-002",
      make: "Sample",
      model: "Sedan",
      colour: "White",
      carSpace: "21",
      location: "Basement",
    },
  ];

  for (const vehicle of vehicles) {
    await prisma.vehicle.upsert({ where: { id: vehicle.id }, update: vehicle, create: vehicle });
  }

  const owner = {
    id: "seed_owner_104",
    apartmentId: "seed_apt_104",
    name: "Example Holdings",
    phone: "02 0000 1104",
    mobile: "0400 000 104",
    email: "holdings@example.com",
    postalAddress: "PO Box 104, Example NSW 2000",
    strataCommittee: true,
  };
  await prisma.apartmentOwner.upsert({ where: { id: owner.id }, update: owner, create: owner });

  const agent = {
    apartmentId: "seed_apt_104",
    company: "Sample Strata Management",
    contactName: "Morgan Agent",
    phone: "02 0000 1900",
    email: "agent@example.com",
    address: "9 Sample Road, Pyrmont NSW 2009",
  };
  await prisma.managingAgent.upsert({
    where: { apartmentId: agent.apartmentId },
    update: agent,
    create: agent,
  });

  const apartmentNotes = [
    {
      id: "seed_note_apt_101",
      apartmentId: "seed_apt_101",
      body: "Parcel left with building management for Alex Example.",
      authorId,
    },
    {
      id: "seed_note_apt_104",
      apartmentId: "seed_apt_104",
      body: "Investment apartment. Example Holdings asked for levy notices by post.",
      authorId,
    },
  ];

  for (const note of apartmentNotes) {
    await prisma.apartmentNote.upsert({ where: { id: note.id }, update: note, create: note });
  }
}

const assetCategories = [
  ["seed_asset_cat_fire", "Fire services"],
  ["seed_asset_cat_lifts", "Lifts"],
  ["seed_asset_cat_pumps", "Pumps"],
  ["seed_asset_cat_electrical", "Electrical"],
  ["seed_asset_cat_plumbing", "Plumbing"],
  ["seed_asset_cat_gates", "Gates and doors"],
  ["seed_asset_cat_hvac", "HVAC"],
  ["seed_asset_cat_security", "Security/CCTV"],
  ["seed_asset_cat_lighting", "Lighting"],
  ["seed_asset_cat_common", "Common area"],
] as const;

const assets = [
  {
    id: "seed_asset_fire_pump",
    categoryId: "seed_asset_cat_pumps",
    name: "Fire pump 1",
    location: "Plant room",
    make: "Example",
    model: "FP-100",
    serialNumber: "SN-FP-001",
    barcode: "BC-FP-001",
    purchasedOn: "2019-03-12",
    assetValue: "18500.00",
    endOfLifeValue: "2000.00",
    lifeMonths: 240,
    description: "Example fire pump for the basement plant room.",
    companyId: "seed_co_fire",
    contactId: "seed_contact_avery",
  },
  {
    id: "seed_asset_lift",
    categoryId: "seed_asset_cat_lifts",
    name: "Passenger lift A",
    location: "Core A",
    make: "Sample",
    model: "LA-2",
    serialNumber: "SN-LA-002",
    barcode: "BC-LA-002",
    purchasedOn: "2016-07-01",
    assetValue: "120000.00",
    endOfLifeValue: "15000.00",
    lifeMonths: 300,
    description: "Example passenger lift serving the lobby and residential floors.",
    companyId: null,
    contactId: null,
  },
  {
    id: "seed_asset_gate",
    categoryId: "seed_asset_cat_gates",
    name: "Car park gate",
    location: "Basement entry",
    make: "Demo",
    model: "RG-4",
    serialNumber: "SN-RG-003",
    barcode: "BC-RG-003",
    purchasedOn: "2021-11-02",
    assetValue: "6400.00",
    endOfLifeValue: "500.00",
    lifeMonths: 120,
    description: "Example roller gate at the car park entry.",
    companyId: null,
    contactId: null,
  },
  {
    id: "seed_asset_switchboard",
    categoryId: "seed_asset_cat_electrical",
    name: "Main switchboard",
    location: "Main switch room",
    make: "Example",
    model: "MSB-1",
    serialNumber: "SN-EL-004",
    barcode: "BC-EL-004",
    purchasedOn: "2018-05-20",
    assetValue: "24000.00",
    endOfLifeValue: "3000.00",
    lifeMonths: 360,
    description: "Example main switchboard for the building.",
    companyId: "seed_co_electrical",
    contactId: "seed_contact_pat",
  },
  {
    id: "seed_asset_hot_water",
    categoryId: "seed_asset_cat_plumbing",
    name: "Hot water plant",
    location: "Plant room",
    make: "Sample",
    model: "HW-80",
    serialNumber: "SN-PL-005",
    barcode: null,
    purchasedOn: "2020-02-14",
    assetValue: "9800.00",
    endOfLifeValue: "800.00",
    lifeMonths: 180,
    description: "Example hot water plant.",
    companyId: "seed_co_plumbing",
    contactId: "seed_contact_casey",
  },
  {
    id: "seed_asset_camera",
    categoryId: "seed_asset_cat_security",
    name: "Lobby camera 1",
    location: "Ground lobby",
    make: "Placeholder",
    model: "CAM-1",
    serialNumber: "SN-SC-006",
    barcode: "BC-SC-006",
    purchasedOn: "2022-08-09",
    assetValue: "1450.00",
    endOfLifeValue: "100.00",
    lifeMonths: 60,
    description: "Example camera covering the ground lobby.",
    companyId: null,
    contactId: null,
  },
  {
    id: "seed_asset_hvac",
    categoryId: "seed_asset_cat_hvac",
    name: "Rooftop HVAC unit",
    location: "Roof",
    make: "Example",
    model: "AHU-3",
    serialNumber: "SN-HV-007",
    barcode: null,
    purchasedOn: "2017-09-01",
    assetValue: "32000.00",
    endOfLifeValue: "4000.00",
    lifeMonths: 240,
    description: "Example rooftop air handling unit.",
    companyId: null,
    contactId: null,
  },
  {
    id: "seed_asset_lights",
    categoryId: "seed_asset_cat_lighting",
    name: "Basement lights",
    location: "Basement B1",
    make: "Example",
    model: "LT-B1",
    serialNumber: "SN-LT-008",
    barcode: null,
    purchasedOn: "2023-01-11",
    assetValue: "2200.00",
    endOfLifeValue: "0.00",
    lifeMonths: 84,
    description: "Example lighting circuit for basement B1.",
    companyId: "seed_co_electrical",
    contactId: "seed_contact_sam",
  },
  {
    id: "seed_asset_closer",
    categoryId: "seed_asset_cat_common",
    name: "Common area door closer",
    location: "Level 1 corridor",
    make: "Demo",
    model: "DC-11",
    serialNumber: "SN-CA-009",
    barcode: null,
    purchasedOn: "2024-04-04",
    assetValue: "180.00",
    endOfLifeValue: null,
    lifeMonths: 36,
    description: "Example door closer on the level 1 common corridor.",
    companyId: null,
    contactId: null,
  },
  {
    id: "seed_asset_panel",
    categoryId: "seed_asset_cat_fire",
    name: "Fire panel",
    location: "Ground lobby",
    make: "Fictional",
    model: "FPAN-1",
    serialNumber: "SN-FS-010",
    barcode: "BC-FS-010",
    purchasedOn: "2019-03-12",
    assetValue: "7600.00",
    endOfLifeValue: "500.00",
    lifeMonths: 180,
    description: "Example fire indicator panel in the ground lobby.",
    companyId: "seed_co_fire",
    contactId: "seed_contact_avery",
  },
];

const warranties = [
  {
    id: "seed_warranty_fire_pump",
    assetId: "seed_asset_fire_pump",
    provider: "Example Warranty Co",
    startsOn: "2019-03-12",
    expiresOn: "2024-01-15",
    notes: "Example cover that has already lapsed.",
  },
  {
    id: "seed_warranty_lift",
    assetId: "seed_asset_lift",
    provider: "Sample Cover",
    startsOn: "2024-07-01",
    expiresOn: "2028-06-30",
    notes: "Example cover still in date.",
  },
];

async function seedAssets() {
  for (const [id, name] of assetCategories) {
    await prisma.assetCategory.upsert({
      where: { id },
      update: { name },
      create: { id, name },
    });
  }

  for (const asset of assets) {
    const data = {
      buildingId: "seed_example_tower",
      categoryId: asset.categoryId,
      name: asset.name,
      location: asset.location,
      make: asset.make,
      model: asset.model,
      serialNumber: asset.serialNumber,
      barcode: asset.barcode,
      purchasedOn: onDay(asset.purchasedOn),
      assetValue: asset.assetValue,
      endOfLifeValue: asset.endOfLifeValue,
      lifeMonths: asset.lifeMonths,
      description: asset.description,
      companyId: asset.companyId,
      contactId: asset.contactId,
    };
    await prisma.asset.upsert({ where: { id: asset.id }, update: data, create: { id: asset.id, ...data } });
  }

  for (const warranty of warranties) {
    const data = {
      assetId: warranty.assetId,
      provider: warranty.provider,
      startsOn: onDay(warranty.startsOn),
      expiresOn: onDay(warranty.expiresOn),
      notes: warranty.notes,
    };
    await prisma.assetWarranty.upsert({
      where: { id: warranty.id },
      update: data,
      create: { id: warranty.id, ...data },
    });
  }
}

function onDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
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
