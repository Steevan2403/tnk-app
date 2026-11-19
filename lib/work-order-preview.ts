import { formatAddress } from "./buildings";
import type { WorkOrderPdfInput } from "./work-order-pdf";
import {
  buildingLine,
  companyNameOf,
  siteContactValue,
  PREVIEW_CHECK_IN_TOKEN,
  workOrderLinks,
  type CompanySettingsInput,
} from "./work-order-terms";

type PreviewBuilding = {
  name: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  strataPlan: string | null;
  siteContactName: string | null;
  siteContactMobile: string | null;
  siteContactEmail: string | null;
};

// Sample job used only to show the saved terms on the settings preview.
const sample = {
  name: "Example Tower",
  address: "100 Example Street",
  suburb: "Sydney",
  state: "NSW",
  postcode: "2000",
  strataPlan: "SP 10048",
  siteContactName: "Alex Example",
  siteContactMobile: "0400 000 001",
  siteContactEmail: "site.tower@example.com",
};

export function previewWorkOrderInput(settings: CompanySettingsInput, building: PreviewBuilding | null): WorkOrderPdfInput {
  const source = building ?? sample;
  const links = workOrderLinks("preview", PREVIEW_CHECK_IN_TOKEN);
  return {
    number: "300-A",
    companyName: companyNameOf(settings.companyName),
    buildingLine: buildingLine(source.name, source.strataPlan),
    buildingAddress: formatAddress(source),
    siteContactName: siteContactValue(source.siteContactName, settings.siteContactName),
    siteContactMobile: siteContactValue(source.siteContactMobile, settings.siteContactMobile),
    siteContactEmail: siteContactValue(source.siteContactEmail, settings.siteContactEmail),
    viewUrl: links.viewUrl,
    checkInUrl: links.checkInUrl,
    dateRequested: "1 Oct 2026",
    dueBy: "8 Oct 2026",
    priority: "High",
    assignedContractor: "Example Contractor | Example Contact | 0400 000 000",
    subject: "Example lobby repair",
    description: "Example description of the work.\nA second line stays on its own line.",
    jobArea: "Lobby",
    assets: "Example camera",
    photos: [],
    terms: settings.workOrderTerms,
  };
}
