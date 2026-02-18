import { useState } from "react";

interface CSVExportProps {
  data: any[];
  filename?: string;
  headers?: { label: string; key: string }[];
}

export function CSVExportButton({
  data,
  filename = "export",
  headers = [
    { label: "Date", key: "date" },
    { label: "Category", key: "category_name" },
    { label: "Description", key: "description" },
    { label: "Amount", key: "amount" },
  ],
}: CSVExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = () => {
    setIsExporting(true);

    try {
      // 1. Create CSV Header
      const headerRow = headers.map((h) => `"${h.label}"`).join(",");

      // 2. Create CSV Rows
      const rows = data.map((row) =>
        headers
          .map((header) => {
            let val = row[header.key];
            if (val === null || val === undefined) val = "";
            // Escape double quotes by doubling them
            const stringVal = String(val).replace(/"/g, '""');
            return `"${stringVal}"`;
          })
          .join(",")
      );

      // 3. Combine
      const csvContent = [headerRow, ...rows].join("\n");

      // 4. Create Blob
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

      // 5. Trigger Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const date = new Date().toISOString().split("T")[0];
      link.setAttribute("download", `${filename}-${date}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("CSV Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={exportToCSV}
      disabled={isExporting || data.length === 0}
      className={isExporting ? "secondary" : "primary"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        background: isExporting ? undefined : "var(--bg-card)", // Use card bg for outline style to differentiate from main PDF button? Or stick to primary?
        // Let's match the style of PDF button but maybe different color or outline? 
        // For now, simple primary/secondary logic.
        border: "1px solid var(--border-color)", // Add border for outline look
        color: "var(--text-primary)",
      }}
    >
      {isExporting ? (
        <>
          <div className="spinner spinner-sm" />
          <span>Exporting...</span>
        </>
      ) : (
        <>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Export CSV</span>
        </>
      )}
    </button>
  );
}
