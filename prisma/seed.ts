import { deflateSync } from "node:zlib";
import { PrismaClient } from "@prisma/client";
import { formatAddress } from "../lib/buildings";
import { FIRST_CASE_NUMBER } from "../lib/cases";
import { createGeneratedReport } from "../lib/report-data";
import { defaultSections, monthPeriod } from "../lib/reports";
import { occurrencesBetween, scheduleOf, sydneyToday } from "../lib/maintenance";
import { hashPassword } from "../lib/password";
import { copyStoredFile, removeUpload, saveBytes, saveUpload } from "../lib/storage";
import { buildWorkOrderPdf } from "../lib/work-order-pdf";
import { workOrderEmailBody, workOrderPdfName, workOrderSentSummary } from "../lib/work-orders";

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
  await seedCases(admin.id);
  await seedWorkOrders(admin.id);
  await seedMaintenance(admin.id);
  await seedInspections(admin.id, staff.id);
  await seedDashboard(admin.id, staff.id);
  await seedManagementReport(admin.id, admin.name);
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

const caseTypes = [
  ["seed_case_type_repair", "Repair & maintenance"],
  ["seed_case_type_approval", "Approval"],
  ["seed_case_type_move_in", "Moving in"],
  ["seed_case_type_move_out", "Moving out"],
  ["seed_case_type_pest", "Pest control"],
  ["seed_case_type_cleaning", "Cleaning"],
  ["seed_case_type_fire", "Fire safety"],
  ["seed_case_type_complaint", "Complaint"],
] as const;

function exampleCaseNumber(sequence: number): number {
  return FIRST_CASE_NUMBER + sequence - 1;
}

const exampleCases = [
  {
    id: "seed_case_01",
    number: exampleCaseNumber(1),
    typeId: "seed_case_type_repair",
    purchaseOrderNumber: "PO-EX-1001",
    startDate: "2026-10-01",
    dueDate: "2026-10-08",
    priority: "urgent" as const,
    status: "in_progress" as const,
    completedAt: null,
    subject: "Example fire pump drip",
    descriptionHtml: "<p>Example drip at the seal. <strong>Please inspect</strong> before the next run.</p>",
    internalNotes: "Example note for the plant room team.",
    includeInReport: true,
    area: "asset" as const,
    apartmentId: null,
    assetIds: ["seed_asset_fire_pump"],
    companyIds: ["seed_co_fire"],
    contactIds: ["seed_contact_avery"],
  },
  {
    id: "seed_case_02",
    number: exampleCaseNumber(2),
    typeId: "seed_case_type_approval",
    purchaseOrderNumber: null,
    startDate: "2026-11-01",
    dueDate: "2026-11-20",
    priority: "high" as const,
    status: "awaiting_quote" as const,
    completedAt: null,
    subject: "Example lift modernisation approval",
    descriptionHtml: "<p>Example request to approve a quote for passenger lift A.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "asset" as const,
    apartmentId: null,
    assetIds: ["seed_asset_lift"],
    companyIds: [],
    contactIds: [],
  },
  {
    id: "seed_case_03",
    number: exampleCaseNumber(3),
    typeId: "seed_case_type_move_in",
    purchaseOrderNumber: null,
    startDate: "2026-11-10",
    dueDate: "2026-11-24",
    priority: "medium" as const,
    status: "new" as const,
    completedAt: null,
    subject: "Example move in for apartment 101",
    descriptionHtml: "<p>Example move-in checklist for apartment 101.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "apartment" as const,
    apartmentId: "seed_apt_101",
    assetIds: [],
    companyIds: [],
    contactIds: [],
  },
  {
    id: "seed_case_04",
    number: exampleCaseNumber(4),
    typeId: "seed_case_type_pest",
    purchaseOrderNumber: null,
    startDate: "2026-11-05",
    dueDate: "2026-11-19",
    priority: "low" as const,
    status: "awaiting_contractor" as const,
    completedAt: null,
    subject: "Example pest treatment for apartment 201",
    descriptionHtml: "<p>Example pest treatment requested for apartment 201.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "apartment" as const,
    apartmentId: "seed_apt_201",
    assetIds: [],
    companyIds: ["seed_co_cleaning"],
    contactIds: ["seed_contact_jordan"],
  },
  {
    id: "seed_case_05",
    number: exampleCaseNumber(5),
    typeId: "seed_case_type_cleaning",
    purchaseOrderNumber: "PO-EX-1005",
    startDate: "2026-07-01",
    dueDate: "2026-07-08",
    priority: "medium" as const,
    status: "completed" as const,
    completedAt: "2026-07-08T01:00:00.000Z",
    subject: "Example common area clean",
    descriptionHtml: "<p>Example clean of the ground lobby and mail room.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "none" as const,
    apartmentId: null,
    assetIds: [],
    companyIds: ["seed_co_cleaning"],
    contactIds: ["seed_contact_jordan"],
  },
  {
    id: "seed_case_06",
    number: exampleCaseNumber(6),
    typeId: "seed_case_type_complaint",
    purchaseOrderNumber: null,
    startDate: "2026-09-01",
    dueDate: "2026-09-10",
    priority: "high" as const,
    status: "new" as const,
    completedAt: null,
    subject: "Example noise complaint for apartment 104",
    descriptionHtml: "<p>Example complaint about evening noise at apartment 104.</p>",
    internalNotes: "Example Holdings asked for a written reply.",
    includeInReport: true,
    area: "apartment" as const,
    apartmentId: "seed_apt_104",
    assetIds: [],
    companyIds: [],
    contactIds: [],
  },
  {
    id: "seed_case_07",
    number: exampleCaseNumber(7),
    typeId: "seed_case_type_fire",
    purchaseOrderNumber: "PO-EX-1007",
    startDate: "2026-11-02",
    dueDate: "2026-11-30",
    priority: "medium" as const,
    status: "awaiting_invoice" as const,
    completedAt: null,
    subject: "Example fire panel service",
    descriptionHtml: "<p>Example annual service of the ground lobby fire panel.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "asset" as const,
    apartmentId: null,
    assetIds: ["seed_asset_panel"],
    companyIds: ["seed_co_fire"],
    contactIds: ["seed_contact_avery"],
  },
  {
    id: "seed_case_08",
    number: exampleCaseNumber(8),
    typeId: "seed_case_type_repair",
    purchaseOrderNumber: null,
    startDate: "2026-11-12",
    dueDate: "2026-11-19",
    priority: "urgent" as const,
    status: "in_progress" as const,
    completedAt: null,
    subject: "Example hot water leak",
    descriptionHtml: "<p>Example leak reported under the hot water plant.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "asset" as const,
    apartmentId: null,
    assetIds: ["seed_asset_hot_water"],
    companyIds: ["seed_co_plumbing"],
    contactIds: ["seed_contact_casey"],
  },
  {
    id: "seed_case_09",
    number: exampleCaseNumber(9),
    typeId: "seed_case_type_repair",
    purchaseOrderNumber: null,
    startDate: "2026-11-05",
    dueDate: "2026-11-25",
    priority: "high" as const,
    status: "awaiting_contractor" as const,
    completedAt: null,
    subject: "Example car park gate fault",
    descriptionHtml: "<p>Example report that the basement gate stops halfway.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "asset" as const,
    apartmentId: null,
    assetIds: ["seed_asset_gate"],
    companyIds: [],
    contactIds: [],
  },
  {
    id: "seed_case_10",
    number: exampleCaseNumber(10),
    typeId: "seed_case_type_move_out",
    purchaseOrderNumber: null,
    startDate: "2026-06-01",
    dueDate: "2026-06-08",
    priority: "low" as const,
    status: "closed" as const,
    completedAt: "2026-06-08T01:00:00.000Z",
    subject: "Example move out for apartment 204",
    descriptionHtml: "<p>Example move-out inspection for apartment 204.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "apartment" as const,
    apartmentId: "seed_apt_204",
    assetIds: [],
    companyIds: [],
    contactIds: [],
  },
  {
    id: "seed_case_11",
    number: exampleCaseNumber(11),
    typeId: "seed_case_type_repair",
    purchaseOrderNumber: null,
    startDate: "2026-11-15",
    dueDate: "2026-11-29",
    priority: "medium" as const,
    status: "new" as const,
    completedAt: null,
    subject: "Example switchboard check",
    descriptionHtml: "<p>Example check of the main switchboard after a flicker.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "asset" as const,
    apartmentId: null,
    assetIds: ["seed_asset_switchboard"],
    companyIds: ["seed_co_electrical"],
    contactIds: ["seed_contact_pat"],
  },
  {
    id: "seed_case_12",
    number: exampleCaseNumber(12),
    typeId: "seed_case_type_repair",
    purchaseOrderNumber: null,
    startDate: "2026-11-08",
    dueDate: "2026-12-01",
    priority: "low" as const,
    status: "awaiting_quote" as const,
    completedAt: null,
    subject: "Example lobby camera quote",
    descriptionHtml: "<p>Example quote request for lobby camera 1.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "asset" as const,
    apartmentId: null,
    assetIds: ["seed_asset_camera"],
    companyIds: [],
    contactIds: [],
  },
  {
    id: "seed_case_13",
    number: exampleCaseNumber(13),
    typeId: "seed_case_type_repair",
    purchaseOrderNumber: null,
    startDate: "2026-11-11",
    dueDate: "2026-11-28",
    priority: "medium" as const,
    status: "in_progress" as const,
    completedAt: null,
    subject: "Example rooftop filter service",
    descriptionHtml: "<p>Example filter change for the rooftop HVAC unit.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "asset" as const,
    apartmentId: null,
    assetIds: ["seed_asset_hvac"],
    companyIds: [],
    contactIds: [],
  },
  {
    id: "seed_case_14",
    number: exampleCaseNumber(14),
    typeId: "seed_case_type_repair",
    purchaseOrderNumber: "PO-EX-1014",
    startDate: "2026-08-01",
    dueDate: "2026-08-10",
    priority: "low" as const,
    status: "completed" as const,
    completedAt: "2026-08-10T01:00:00.000Z",
    subject: "Example basement lamp replacement",
    descriptionHtml: "<p>Example lamp replacement on basement B1.</p>",
    internalNotes: null,
    includeInReport: true,
    area: "asset" as const,
    apartmentId: null,
    assetIds: ["seed_asset_lights"],
    companyIds: ["seed_co_electrical"],
    contactIds: ["seed_contact_sam"],
  },
  {
    id: "seed_case_15",
    number: exampleCaseNumber(15),
    typeId: "seed_case_type_repair",
    purchaseOrderNumber: null,
    startDate: "2026-11-16",
    dueDate: "2026-11-23",
    priority: "low" as const,
    status: "new" as const,
    completedAt: null,
    subject: "Example door closer adjustment",
    descriptionHtml: "<p>Example adjustment of the level 1 door closer.</p>",
    internalNotes: "Leave this example out of the management report.",
    includeInReport: false,
    area: "asset" as const,
    apartmentId: null,
    assetIds: ["seed_asset_closer"],
    companyIds: [],
    contactIds: [],
  },
];

async function seedCases(authorId: string) {
  for (const [id, name] of caseTypes) {
    await prisma.caseType.upsert({
      where: { id },
      update: { name },
      create: { id, name },
    });
  }

  for (const item of exampleCases) {
    const data = {
      buildingId: "seed_example_tower",
      number: item.number,
      typeId: item.typeId,
      purchaseOrderNumber: item.purchaseOrderNumber,
      startDate: onDay(item.startDate),
      dueDate: onDay(item.dueDate),
      priority: item.priority,
      status: item.status,
      completedAt: item.completedAt ? new Date(item.completedAt) : null,
      subject: item.subject,
      descriptionHtml: item.descriptionHtml,
      internalNotes: item.internalNotes,
      includeInReport: item.includeInReport,
      area: item.area,
      apartmentId: item.apartmentId,
      createdById: authorId,
    };
    await prisma.case.upsert({ where: { id: item.id }, update: data, create: { id: item.id, ...data } });
    await prisma.caseAsset.deleteMany({ where: { caseId: item.id } });
    await prisma.caseCompany.deleteMany({ where: { caseId: item.id } });
    await prisma.caseContact.deleteMany({ where: { caseId: item.id } });
    if (item.assetIds.length) {
      await prisma.caseAsset.createMany({ data: item.assetIds.map((assetId) => ({ caseId: item.id, assetId })) });
    }
    if (item.companyIds.length) {
      await prisma.caseCompany.createMany({ data: item.companyIds.map((companyId) => ({ caseId: item.id, companyId })) });
    }
    if (item.contactIds.length) {
      await prisma.caseContact.createMany({ data: item.contactIds.map((contactId) => ({ caseId: item.id, contactId })) });
    }
    await prisma.caseActivity.upsert({
      where: { id: `${item.id}_created` },
      update: { summary: "Case created." },
      create: {
        id: `${item.id}_created`,
        caseId: item.id,
        actorId: authorId,
        kind: "created",
        summary: "Case created.",
        createdAt: onDay(item.startDate),
      },
    });
  }

  await prisma.caseComment.upsert({
    where: { id: "seed_case_comment_01" },
    update: { body: "Example: the drip is at the pump seal." },
    create: {
      id: "seed_case_comment_01",
      caseId: "seed_case_01",
      body: "Example: the drip is at the pump seal.",
      authorId,
      createdAt: new Date("2026-10-01T02:00:00.000Z"),
    },
  });
  await prisma.caseActivity.upsert({
    where: { id: "seed_case_01_comment" },
    update: { summary: "Added a comment." },
    create: {
      id: "seed_case_01_comment",
      caseId: "seed_case_01",
      actorId: authorId,
      kind: "comment_added",
      summary: "Added a comment.",
      createdAt: new Date("2026-10-01T02:00:00.000Z"),
    },
  });
  await prisma.caseStar.upsert({
    where: { userId_caseId: { userId: authorId, caseId: "seed_case_01" } },
    update: {},
    create: { userId: authorId, caseId: "seed_case_01" },
  });
}

const exampleWorkOrders = [
  {
    id: "seed_wo_01a",
    caseId: "seed_case_01",
    caseNumber: exampleCaseNumber(1),
    suffix: "A",
    companyId: "seed_co_fire",
    companyName: "Fictional Fire Services",
    contactId: "seed_contact_avery",
    contactName: "Avery Sample",
    contactEmail: "avery.sample@example.com",
    status: "new" as const,
    sentAt: "2026-10-02T01:00:00.000Z",
    subject: `Work order ${exampleCaseNumber(1)}-A: Example fire pump drip`,
    message: "Example drip at the seal. Please inspect before the next run.",
    purchaseOrderNumber: "PO-EX-1001",
    attendingAt: "2026-10-03T00:00:00.000Z",
    accessNotes: "Example: plant room key is at the concierge desk.",
    caseSubject: "Example fire pump drip",
    caseType: "Repair & maintenance",
    jobArea: "Fire pump 1",
  },
  {
    id: "seed_wo_01b",
    caseId: "seed_case_01",
    caseNumber: exampleCaseNumber(1),
    suffix: "B",
    companyId: "seed_co_fire",
    companyName: "Fictional Fire Services",
    contactId: "seed_contact_avery",
    contactName: "Avery Sample",
    contactEmail: "avery.sample@example.com",
    status: "accepted" as const,
    sentAt: "2026-10-03T02:00:00.000Z",
    subject: `Work order ${exampleCaseNumber(1)}-B: Example fire pump drip`,
    message: "Example follow-up after the first look at the pump seal.",
    purchaseOrderNumber: "PO-EX-1001",
    attendingAt: null,
    accessNotes: null,
    caseSubject: "Example fire pump drip",
    caseType: "Repair & maintenance",
    jobArea: "Fire pump 1",
  },
  {
    id: "seed_wo_08a",
    caseId: "seed_case_08",
    caseNumber: exampleCaseNumber(8),
    suffix: "A",
    companyId: "seed_co_plumbing",
    companyName: "Sample Plumbing Co",
    contactId: "seed_contact_casey",
    contactName: "Casey Placeholder",
    contactEmail: "casey.placeholder@example.com",
    status: "in_progress" as const,
    sentAt: "2026-11-12T03:00:00.000Z",
    subject: `Work order ${exampleCaseNumber(8)}-A: Example hot water leak`,
    message: "Example leak reported under the hot water plant.",
    purchaseOrderNumber: null,
    attendingAt: "2026-11-13T01:00:00.000Z",
    accessNotes: "Example: the plant room is on the roof.",
    caseSubject: "Example hot water leak",
    caseType: "Repair & maintenance",
    jobArea: "Hot water plant",
  },
  {
    id: "seed_wo_04a",
    caseId: "seed_case_04",
    caseNumber: exampleCaseNumber(4),
    suffix: "A",
    companyId: "seed_co_cleaning",
    companyName: "Placeholder Cleaning",
    contactId: "seed_contact_jordan",
    contactName: "Jordan Example",
    contactEmail: "jordan.example@example.com",
    status: "awaiting_contractor" as const,
    sentAt: "2026-11-06T01:00:00.000Z",
    subject: `Work order ${exampleCaseNumber(4)}-A: Example pest treatment for apartment 201`,
    message: "Example pest treatment requested for apartment 201.",
    purchaseOrderNumber: null,
    attendingAt: null,
    accessNotes: null,
    caseSubject: "Example pest treatment for apartment 201",
    caseType: "Pest control",
    jobArea: "Apartment 201",
  },
  {
    id: "seed_wo_11a",
    caseId: "seed_case_11",
    caseNumber: exampleCaseNumber(11),
    suffix: "A",
    companyId: "seed_co_electrical",
    companyName: "Example Electrical Pty Ltd",
    contactId: "seed_contact_pat",
    contactName: "Pat Example",
    contactEmail: "pat.example@example.com",
    status: "completed" as const,
    sentAt: "2026-11-15T04:00:00.000Z",
    subject: `Work order ${exampleCaseNumber(11)}-A: Example switchboard check`,
    message: "Example check of the main switchboard after a flicker.",
    purchaseOrderNumber: null,
    attendingAt: null,
    accessNotes: null,
    caseSubject: "Example switchboard check",
    caseType: "Repair & maintenance",
    jobArea: "Main switchboard",
  },
  {
    id: "seed_wo_14a",
    caseId: "seed_case_14",
    caseNumber: exampleCaseNumber(14),
    suffix: "A",
    companyId: "seed_co_electrical",
    companyName: "Example Electrical Pty Ltd",
    contactId: "seed_contact_sam",
    contactName: "Sam Sample",
    contactEmail: "sam.sample@example.com",
    status: "cancelled" as const,
    sentAt: "2026-08-02T01:00:00.000Z",
    subject: `Work order ${exampleCaseNumber(14)}-A: Example basement lamp replacement`,
    message: "Example lamp replacement on basement B1.",
    purchaseOrderNumber: "PO-EX-1014",
    attendingAt: null,
    accessNotes: null,
    caseSubject: "Example basement lamp replacement",
    caseType: "Repair & maintenance",
    jobArea: "Basement lights",
  },
];

async function seedWorkOrders(authorId: string) {
  const building = await prisma.building.findUniqueOrThrow({ where: { id: "seed_example_tower" } });
  const address = formatAddress(building);
  for (const item of exampleWorkOrders) {
    const sentAt = new Date(item.sentAt);
    const pdfName = workOrderPdfName(item.caseNumber, item.suffix);
    const number = `${item.caseNumber}-${item.suffix}`;
    const previous = await prisma.workOrder.findUnique({ where: { id: item.id }, select: { pdfStoredName: true } });
    const pdf = await buildWorkOrderPdf({
      number,
      sentAt,
      buildingName: building.name,
      buildingAddress: address,
      companyName: item.companyName,
      contactName: item.contactName,
      contactEmail: item.contactEmail,
      caseNumber: item.caseNumber,
      caseSubject: item.caseSubject,
      caseType: item.caseType,
      jobArea: item.jobArea,
      instructions: item.message,
      purchaseOrderNumber: item.purchaseOrderNumber,
      attendingAt: item.attendingAt ? new Date(item.attendingAt) : null,
      accessNotes: item.accessNotes,
      attachmentNames: [],
    });
    const pdfStoredName = await saveBytes(pdf, ".pdf");
    const data = {
      caseId: item.caseId,
      suffix: item.suffix,
      companyId: item.companyId,
      companyName: item.companyName,
      contactId: item.contactId,
      contactName: item.contactName,
      contactEmail: item.contactEmail,
      subject: item.subject,
      message: item.message,
      attendingAt: item.attendingAt ? new Date(item.attendingAt) : null,
      purchaseOrderNumber: item.purchaseOrderNumber,
      accessNotes: item.accessNotes,
      status: item.status,
      sentAt,
      sentById: authorId,
      pdfStoredName,
      pdfName,
    };
    await prisma.workOrder.upsert({ where: { id: item.id }, update: data, create: { id: item.id, ...data } });
    if (previous) await removeUpload(previous.pdfStoredName);

    const summary = workOrderSentSummary(number, item.companyName, item.contactName);
    await prisma.caseActivity.upsert({
      where: { id: `${item.id}_sent` },
      update: { summary },
      create: {
        id: `${item.id}_sent`,
        caseId: item.caseId,
        actorId: authorId,
        kind: "work_order_sent",
        summary,
        createdAt: sentAt,
      },
    });

    const messageId = item.id.replace("seed_wo_", "seed_mail_");
    const body = workOrderEmailBody({
      number,
      buildingName: building.name,
      companyName: item.companyName,
      contactName: item.contactName,
      message: item.message,
      pdfName,
    });
    await prisma.outboxMessage.upsert({
      where: { id: messageId },
      update: { toAddress: item.contactEmail, subject: item.subject, body, workOrderId: item.id, createdAt: sentAt },
      create: {
        id: messageId,
        toAddress: item.contactEmail,
        subject: item.subject,
        body,
        workOrderId: item.id,
        createdAt: sentAt,
      },
    });
    await prisma.outboxAttachment.deleteMany({ where: { messageId } });
    await prisma.outboxAttachment.create({
      data: { messageId, name: pdfName, storedName: pdfStoredName },
    });
  }
}

async function seedMaintenance(authorId: string) {
  const today = sydneyToday();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const events = [
    {
      id: "seed_maint_fire",
      subject: "Example fire system test",
      description: "Example monthly test of the lobby fire panel.",
      notes: "Example: write down the panel reading.",
      start: onMonth(today, -8, 15),
      end: null,
      frequency: "monthly" as const,
      intervalMonths: null,
      remind: true,
      area: "asset" as const,
      assetIds: ["seed_asset_panel"],
      companyIds: ["seed_co_fire"],
      contactIds: ["seed_contact_avery"],
      leaveOpen: 1,
    },
    {
      id: "seed_maint_lift",
      subject: "Example lift service",
      description: "Example monthly service of passenger lift A.",
      notes: null,
      start: onMonth(today, -5, 4),
      end: null,
      frequency: "monthly" as const,
      intervalMonths: null,
      remind: false,
      area: "asset" as const,
      assetIds: ["seed_asset_lift"],
      companyIds: ["seed_co_electrical"],
      contactIds: ["seed_contact_pat"],
      leaveOpen: 2,
    },
    {
      id: "seed_maint_gutter",
      subject: "Example gutter clean",
      description: "Example half-yearly clean of the roof gutters.",
      notes: "Example: stay off the garden beds.",
      start: onMonth(today, -14, 2),
      end: null,
      frequency: "half_yearly" as const,
      intervalMonths: null,
      remind: false,
      area: "none" as const,
      assetIds: [],
      companyIds: ["seed_co_cleaning"],
      contactIds: ["seed_contact_jordan"],
      leaveOpen: 0,
    },
    {
      id: "seed_maint_pump",
      subject: "Example pump service",
      description: "Example quarterly service of fire pump 1.",
      notes: null,
      start: onMonth(today, -9, 20),
      end: null,
      frequency: "quarterly" as const,
      intervalMonths: null,
      remind: false,
      area: "asset" as const,
      assetIds: ["seed_asset_fire_pump"],
      companyIds: ["seed_co_fire"],
      contactIds: ["seed_contact_avery"],
      leaveOpen: 0,
    },
    {
      id: "seed_maint_hot_water",
      subject: "Example hot water service",
      description: "Example yearly service of the hot water plant.",
      notes: null,
      start: onMonth(today, -10, 9),
      end: null,
      frequency: "yearly" as const,
      intervalMonths: null,
      remind: false,
      area: "asset" as const,
      assetIds: ["seed_asset_hot_water"],
      companyIds: ["seed_co_plumbing"],
      contactIds: ["seed_contact_casey"],
      leaveOpen: 0,
    },
    {
      id: "seed_maint_board",
      subject: "Example switchboard test",
      description: "Example switchboard test every four months.",
      notes: null,
      start: onMonth(today, -9, 6),
      end: null,
      frequency: "every_n_months" as const,
      intervalMonths: 4,
      remind: false,
      area: "asset" as const,
      assetIds: ["seed_asset_switchboard"],
      companyIds: ["seed_co_electrical"],
      contactIds: ["seed_contact_pat"],
      leaveOpen: 0,
    },
    {
      id: "seed_maint_gate",
      subject: "Example car park gate service",
      description: "Example fortnightly check of the car park gate.",
      notes: null,
      start: onMonth(today, -2, 11),
      end: null,
      frequency: "fortnightly" as const,
      intervalMonths: null,
      remind: false,
      area: "asset" as const,
      assetIds: ["seed_asset_gate"],
      companyIds: ["seed_co_electrical"],
      contactIds: ["seed_contact_sam"],
      leaveOpen: 0,
    },
    {
      id: "seed_maint_camera",
      subject: "Example lobby camera check",
      description: "Example one-off check of lobby camera 1.",
      notes: null,
      start: onMonth(today, -4, 12),
      end: null,
      frequency: "one_off" as const,
      intervalMonths: null,
      remind: false,
      area: "asset" as const,
      assetIds: ["seed_asset_camera"],
      companyIds: [],
      contactIds: [],
      leaveOpen: 0,
    },
  ];

  for (const event of events) {
    const data = {
      buildingId: "seed_example_tower",
      subject: event.subject,
      description: event.description,
      notes: event.notes,
      startDate: event.start,
      endDate: event.end,
      frequency: event.frequency,
      intervalMonths: event.intervalMonths,
      remindContractor: event.remind,
      reminderDays: 7,
      area: event.area,
      apartmentId: null,
      createdById: authorId,
    };
    await prisma.maintenanceEvent.upsert({
      where: { id: event.id },
      update: data,
      create: { id: event.id, ...data },
    });
    await prisma.maintenanceAsset.deleteMany({ where: { eventId: event.id } });
    await prisma.maintenanceCompany.deleteMany({ where: { eventId: event.id } });
    await prisma.maintenanceContact.deleteMany({ where: { eventId: event.id } });
    await prisma.maintenanceOccurrence.deleteMany({ where: { eventId: event.id } });
    if (event.assetIds.length) {
      await prisma.maintenanceAsset.createMany({
        data: event.assetIds.map((assetId) => ({ eventId: event.id, assetId })),
      });
    }
    if (event.companyIds.length) {
      await prisma.maintenanceCompany.createMany({
        data: event.companyIds.map((companyId) => ({ eventId: event.id, companyId })),
      });
    }
    if (event.contactIds.length) {
      await prisma.maintenanceContact.createMany({
        data: event.contactIds.map((contactId) => ({ eventId: event.id, contactId })),
      });
    }
    const schedule = scheduleOf({
      startDate: event.start,
      endDate: event.end,
      frequency: event.frequency,
      intervalMonths: event.intervalMonths,
    });
    if (!schedule) continue;
    const past = occurrencesBetween(schedule, event.start, yesterday);
    const done = past.slice(0, Math.max(0, past.length - event.leaveOpen));
    if (done.length) {
      await prisma.maintenanceOccurrence.createMany({
        data: done.map((occursOn) => ({
          eventId: event.id,
          occursOn,
          state: "completed" as const,
          note: "Example visit marked done.",
          actedAt: occursOn,
          actedById: authorId,
        })),
      });
    }
  }

  const file = await prisma.maintenanceFile.findUnique({ where: { id: "seed_maint_file_fire" } });
  if (!file) {
    const storedName = await saveBytes(Buffer.from(examplePdf), ".pdf");
    await prisma.maintenanceFile.create({
      data: {
        id: "seed_maint_file_fire",
        eventId: "seed_maint_fire",
        kind: "document",
        name: "Example fire test sheet.pdf",
        storedName,
      },
    });
  }
}

async function seedInspections(adminId: string, staffId: string) {
  const commonAreas = [
    {
      id: "seed_insp_area_lobby",
      name: "Lobby",
      items: [
        ["seed_insp_item_doors", "Entrance doors", "Check they close fully."],
        ["seed_insp_item_floor", "Lobby floor", "Look for cracks and stains."],
        ["seed_insp_item_light", "Lobby lighting", ""],
      ],
    },
    {
      id: "seed_insp_area_park",
      name: "Car park",
      items: [
        ["seed_insp_item_gate", "Roller door", "Example: watch it travel."],
        ["seed_insp_item_parklight", "Car park lighting", ""],
        ["seed_insp_item_lines", "Line marking", ""],
      ],
    },
    {
      id: "seed_insp_area_l1",
      name: "Level 1",
      items: [
        ["seed_insp_item_l1", "Level 1 corridor", ""],
        ["seed_insp_item_stair", "Stair door", ""],
      ],
    },
    {
      id: "seed_insp_area_l2",
      name: "Level 2",
      items: [["seed_insp_item_l2", "Level 2 corridor", ""]],
    },
    {
      id: "seed_insp_area_l3",
      name: "Level 3",
      items: [["seed_insp_item_l3", "Level 3 corridor", ""]],
    },
  ] as const;

  await upsertInspectionTemplate(
    "seed_insp_tpl_common",
    "Monthly common area inspection",
    "common_area",
    "Example monthly walk through the common areas of Example Tower.",
    onDay("2026-01-15"),
    commonAreas,
  );
  await upsertInspectionTemplate(
    "seed_insp_tpl_lot",
    "Lot exit inspection",
    "private_lot",
    "Example checklist when a resident leaves a lot.",
    onDay("2026-02-02"),
    [
      {
        id: "seed_insp_area_kitchen",
        name: "Kitchen",
        items: [
          ["seed_insp_item_bench", "Benchtop", ""],
          ["seed_insp_item_sink", "Sink", ""],
        ],
      },
      {
        id: "seed_insp_area_bath",
        name: "Bathroom",
        items: [
          ["seed_insp_item_taps", "Taps", ""],
          ["seed_insp_item_waste", "Floor waste", ""],
        ],
      },
      {
        id: "seed_insp_area_living",
        name: "Living",
        items: [["seed_insp_item_walls", "Walls and ceiling", ""]],
      },
    ],
  );
  await upsertInspectionTemplate(
    "seed_insp_tpl_roof",
    "Example roof inspection",
    "common_area",
    "Example look at the roof of Example Tower.",
    onDay("2026-03-03"),
    [
      {
        id: "seed_insp_area_roof",
        name: "Roof",
        items: [
          ["seed_insp_item_membrane", "Membrane", "Example: look for ponding."],
          ["seed_insp_item_gutters", "Gutters", ""],
        ],
      },
    ],
  );

  const blank = { result: null as "pass" | "fail" | "na" | null, comment: null as string | null };
  await upsertInspectionRun({
    id: "seed_insp_run_open",
    templateId: "seed_insp_tpl_common",
    name: "Monthly common area inspection",
    type: "common_area",
    inspectorId: staffId,
    apartmentId: null,
    inspectedAt: sydneyToday(),
    status: "in_progress",
    completedAt: null,
    createdAt: new Date("2026-11-18T01:00:00.000Z"),
    areas: commonAreas.map((area) => ({
      id: area.id.replace("seed_insp_area_", "seed_insp_open_area_"),
      name: area.name,
      items: area.items.map(([id, name, guidance]) => ({
        id: id.replace("seed_insp_item_", "seed_insp_open_"),
        name,
        guidance: guidance || null,
        ...openAnswer(id),
      })),
    })),
  });
  await upsertInspectionRun({
    id: "seed_insp_run_done",
    templateId: "seed_insp_tpl_common",
    name: "Monthly common area inspection",
    type: "common_area",
    inspectorId: adminId,
    apartmentId: null,
    inspectedAt: onDay("2026-10-20"),
    status: "completed",
    completedAt: new Date("2026-10-20T04:00:00.000Z"),
    createdAt: new Date("2026-10-20T01:00:00.000Z"),
    areas: commonAreas.map((area) => ({
      id: area.id.replace("seed_insp_area_", "seed_insp_done_area_"),
      name: area.name,
      items: area.items.map(([id, name, guidance]) => ({
        id: id.replace("seed_insp_item_", "seed_insp_done_"),
        name,
        guidance: guidance || null,
        ...(doneAnswer(id) ?? blank),
      })),
    })),
  });
  await upsertInspectionRun({
    id: "seed_insp_run_lot",
    templateId: "seed_insp_tpl_lot",
    name: "Lot exit inspection",
    type: "private_lot",
    inspectorId: staffId,
    apartmentId: "seed_apt_104",
    inspectedAt: onDay("2026-11-02"),
    status: "completed",
    completedAt: new Date("2026-11-02T03:00:00.000Z"),
    createdAt: new Date("2026-11-02T01:00:00.000Z"),
    areas: [
      {
        id: "seed_insp_lot_area_kitchen",
        name: "Kitchen",
        items: [
          { id: "seed_insp_lot_bench", name: "Benchtop", guidance: null, result: "pass", comment: null },
          { id: "seed_insp_lot_sink", name: "Sink", guidance: null, result: "fail", comment: "Example chip on the sink edge." },
        ],
      },
      {
        id: "seed_insp_lot_area_bath",
        name: "Bathroom",
        items: [
          { id: "seed_insp_lot_taps", name: "Taps", guidance: null, result: "na", comment: null },
          { id: "seed_insp_lot_waste", name: "Floor waste", guidance: null, result: "pass", comment: null },
        ],
      },
      {
        id: "seed_insp_lot_area_living",
        name: "Living",
        items: [{ id: "seed_insp_lot_walls", name: "Walls and ceiling", guidance: null, result: "pass", comment: null }],
      },
    ],
  });

  const existingPhoto = await prisma.inspectionPhoto.findUnique({ where: { id: "seed_insp_photo_floor" } });
  let storedName = existingPhoto?.storedName ?? null;
  if (!existingPhoto) {
    const file = new File([Uint8Array.from(solidPng(80, 60, [0, 0, 128, 255]))], "example-lobby-floor.png", {
      type: "image/png",
    });
    const saved = await saveUpload(file, "image");
    storedName = saved.storedName;
    await prisma.inspectionPhoto.create({
      data: {
        id: "seed_insp_photo_floor",
        itemId: "seed_insp_done_floor",
        name: saved.originalName,
        storedName: saved.storedName,
      },
    });
  }

  const caseData = {
    buildingId: "seed_example_tower",
    number: exampleCaseNumber(16),
    typeId: "seed_case_type_repair",
    purchaseOrderNumber: null,
    startDate: onDay("2026-10-20"),
    dueDate: onDay("2026-10-27"),
    priority: "low" as const,
    status: "new" as const,
    completedAt: null,
    subject: "Lobby floor (Lobby)",
    descriptionHtml: "<p>Example crack near the mailboxes.</p>",
    internalNotes: "Created from inspection Monthly common area inspection, Lobby, Lobby floor.",
    includeInReport: true,
    area: "none" as const,
    apartmentId: null,
    createdById: adminId,
    inspectionItemId: "seed_insp_done_floor",
  };
  await prisma.case.upsert({
    where: { id: "seed_case_16" },
    update: caseData,
    create: { id: "seed_case_16", ...caseData },
  });
  await prisma.caseActivity.upsert({
    where: { id: "seed_case_16_created" },
    update: { summary: "Case created." },
    create: {
      id: "seed_case_16_created",
      caseId: "seed_case_16",
      actorId: adminId,
      kind: "created",
      summary: "Case created.",
      createdAt: onDay("2026-10-20"),
    },
  });
  const casePhoto = await prisma.caseFile.findUnique({ where: { id: "seed_case_16_photo" } });
  if (!casePhoto && storedName) {
    const copy = await copyStoredFile(storedName);
    if (copy) {
      await prisma.caseFile.create({
        data: {
          id: "seed_case_16_photo",
          caseId: "seed_case_16",
          kind: "photo",
          name: "example-lobby-floor.png",
          storedName: copy,
          uploadedById: adminId,
        },
      });
    }
  }

  function openAnswer(id: string): { result: "pass" | "fail" | "na" | null; comment: string | null } {
    if (id.endsWith("_doors")) return { result: "pass", comment: null };
    if (id.endsWith("_floor")) return { result: "fail", comment: "Example stain by the front desk." };
    if (id.endsWith("_light")) return { result: "na", comment: null };
    return blank;
  }

  function doneAnswer(id: string): { result: "pass" | "fail" | "na"; comment: string | null } | null {
    if (
      id.endsWith("_doors") ||
      id.endsWith("_light") ||
      id.endsWith("_parklight") ||
      id.endsWith("_l1") ||
      id.endsWith("_stair") ||
      id.endsWith("_l2") ||
      id.endsWith("_l3")
    ) {
      return { result: "pass", comment: null };
    }
    if (id.endsWith("_floor")) return { result: "fail", comment: "Example crack near the mailboxes." };
    if (id.endsWith("_gate")) return { result: "fail", comment: "Example: the door stops halfway." };
    if (id.endsWith("_lines")) return { result: "na", comment: null };
    return null;
  }
}

async function upsertInspectionTemplate(
  id: string,
  name: string,
  type: "common_area" | "private_lot",
  description: string,
  createdAt: Date,
  areas: readonly { id: string; name: string; items: readonly (readonly [string, string, string])[] }[],
) {
  await prisma.inspectionTemplate.upsert({
    where: { id },
    update: { name, type, description, buildingId: "seed_example_tower" },
    create: { id, buildingId: "seed_example_tower", name, type, description, createdAt },
  });
  for (const [position, area] of areas.entries()) {
    await prisma.inspectionArea.upsert({
      where: { id: area.id },
      update: { templateId: id, name: area.name, position },
      create: { id: area.id, templateId: id, name: area.name, position },
    });
    for (const [itemPosition, item] of area.items.entries()) {
      const [itemId, itemName, guidance] = item;
      await prisma.inspectionItem.upsert({
        where: { id: itemId },
        update: { areaId: area.id, name: itemName, guidance: guidance || null, position: itemPosition },
        create: { id: itemId, areaId: area.id, name: itemName, guidance: guidance || null, position: itemPosition },
      });
    }
  }
}

async function upsertInspectionRun(run: {
  id: string;
  templateId: string;
  name: string;
  type: "common_area" | "private_lot";
  inspectorId: string;
  apartmentId: string | null;
  inspectedAt: Date;
  status: "in_progress" | "completed";
  completedAt: Date | null;
  createdAt: Date;
  areas: {
    id: string;
    name: string;
    items: { id: string; name: string; guidance: string | null; result: "pass" | "fail" | "na" | null; comment: string | null }[];
  }[];
}) {
  const data = {
    buildingId: "seed_example_tower",
    templateId: run.templateId,
    name: run.name,
    type: run.type,
    inspectorId: run.inspectorId,
    apartmentId: run.apartmentId,
    inspectedAt: run.inspectedAt,
    status: run.status,
    completedAt: run.completedAt,
  };
  await prisma.inspectionRun.upsert({
    where: { id: run.id },
    update: data,
    create: { id: run.id, ...data, createdAt: run.createdAt },
  });
  for (const [position, area] of run.areas.entries()) {
    await prisma.inspectionRunArea.upsert({
      where: { id: area.id },
      update: { runId: run.id, name: area.name, position },
      create: { id: area.id, runId: run.id, name: area.name, position },
    });
    for (const [itemPosition, item] of area.items.entries()) {
      const itemData = {
        areaId: area.id,
        name: item.name,
        guidance: item.guidance,
        position: itemPosition,
        result: item.result,
        comment: item.comment,
      };
      await prisma.inspectionRunItem.upsert({
        where: { id: item.id },
        update: itemData,
        create: { id: item.id, ...itemData },
      });
    }
  }
}

function solidPng(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 4] = rgba[0];
    row[2 + x * 4] = rgba[1];
    row[3 + x * 4] = rgba[2];
    row[4 + x * 4] = rgba[3];
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", pngHeader(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  return buffer;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function pngCrc(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function seedDashboard(adminId: string, staffId: string) {
  const notes = [
    {
      id: "seed_building_note_panel",
      title: "Fire panel monitoring",
      body: "Example: the monitoring desk calls the after-hours mobile when the lobby panel alarms.",
      authorId: adminId,
      createdAt: new Date("2026-11-02T01:00:00.000Z"),
    },
    {
      id: "seed_building_note_keys",
      title: "Plant room access",
      body: "Example: the plant room key is in the concierge cupboard.",
      authorId: staffId,
      createdAt: new Date("2026-11-10T01:00:00.000Z"),
    },
    {
      id: "seed_building_note_lift",
      title: null as string | null,
      body: "Example: passenger lift A is serviced once a month.",
      authorId: adminId,
      createdAt: new Date("2026-11-16T01:00:00.000Z"),
    },
  ];
  for (const note of notes) {
    const data = {
      buildingId: "seed_example_tower",
      title: note.title,
      body: note.body,
      authorId: note.authorId,
      createdAt: note.createdAt,
    };
    await prisma.buildingNote.upsert({ where: { id: note.id }, update: data, create: { id: note.id, ...data } });
  }

  const numbers = [
    {
      id: "seed_number_panel",
      label: "Fire panel monitoring",
      number: "02 0000 0000",
      notes: "Example after-hours alarm line.",
    },
    {
      id: "seed_number_plumber",
      label: "After-hours plumber",
      number: "0400 000 000",
      notes: "Example call-out number.",
    },
    {
      id: "seed_number_lift",
      label: "Lift breakdown",
      number: "02 0000 1111",
      notes: null as string | null,
    },
  ];
  for (const entry of numbers) {
    const data = {
      buildingId: "seed_example_tower",
      label: entry.label,
      number: entry.number,
      notes: entry.notes,
    };
    await prisma.usefulNumber.upsert({ where: { id: entry.id }, update: data, create: { id: entry.id, ...data } });
  }
}

async function seedManagementReport(userId: string, userName: string) {
  const period = monthPeriod(new Date(), -1);
  await createGeneratedReport({
    id: "seed_report_last_month",
    buildingId: "seed_example_tower",
    userId,
    userName,
    selection: {
      from: period.from,
      to: period.to,
      includeOpen: false,
      typeIds: [],
      statuses: [],
      companyIds: [],
      priorities: [],
      assetIds: [],
      apartmentIds: [],
      excludedIds: [],
    },
    sections: defaultSections(),
    format: "pdf",
  });
}

function onMonth(today: Date, monthOffset: number, dayOfMonth: number): Date {
  const shifted = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, 1));
  const last = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), Math.min(dayOfMonth, last)));
}

const examplePdf = "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 80]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";

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
