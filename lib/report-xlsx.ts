import ExcelJS from "exceljs";
import { CASE_TABLE_HEADERS } from "./reports";

export type ReportSheetCase = {
  number: number;
  started: string;
  completed: string;
  subject: string;
  typeName: string;
  contractor: string;
  priority: string;
  status: string;
};

export type ReportSheetVisit = {
  when: string;
  subject: string;
  status: string;
};

export async function buildManagementXlsx(input: {
  cases: ReportSheetCase[];
  visits: ReportSheetVisit[];
}): Promise<Uint8Array> {
  const book = new ExcelJS.Workbook();
  book.creator = "TNK Property Services";
  book.created = new Date();
  const cases = book.addWorksheet("Cases");
  cases.addRow([...CASE_TABLE_HEADERS]);
  for (const item of input.cases) {
    cases.addRow([
      item.number,
      item.started,
      item.completed,
      item.subject,
      item.typeName,
      item.contractor,
      item.priority,
      item.status,
    ]);
  }
  cases.getRow(1).font = { bold: true };
  const maintenance = book.addWorksheet("Maintenance");
  maintenance.addRow(["Date", "Subject", "Status"]);
  for (const visit of input.visits) {
    maintenance.addRow([visit.when, visit.subject, visit.status]);
  }
  maintenance.getRow(1).font = { bold: true };
  const buffer = await book.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
