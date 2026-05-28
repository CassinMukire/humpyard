import type { CountryResult } from "@workspace/api-client-react";

export function exportToCsv(results: CountryResult[], filename: string) {
  if (results.length === 0) return;

  const headers = [
    "Country",
    "Verdict",
    "Tier",
    "Confidence",
    "Operator",
    "Last Modernization",
    "Procurement Portal",
    "Contact Entry Point",
    "Yards",
    "Procurement Tenders",
    "Technical Contacts",
    "Summary",
    "Sources",
    "Error"
  ];

  const escapeCell = (cell: any) => {
    if (cell == null) return "";
    const str = String(cell);
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = results.map(r => [
    r.country,
    r.verdict,
    r.tier,
    r.confidence,
    r.operator || "",
    r.lastModernization || "",
    r.procurementPortal || "",
    r.contactEntryPoint || "",
    r.yards.join("; "),
    r.procurementTenders.join("; "),
    r.technicalContacts.join("; "),
    r.summary,
    r.sources.map((s: { url: string }) => s.url).join("; "),
    r.error || ""
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(escapeCell).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
