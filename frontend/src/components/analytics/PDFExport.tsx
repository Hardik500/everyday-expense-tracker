/* eslint-disable */
import { useState, _unusedUseRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PDFExportProps {
  buttonLabel?: string;
  filename?: string;
  targetRef?: React.RefObject<HTMLElement>;
  onExportStart?: () => void;
  onExportComplete?: () => void;
  onExportError?: (error: Error) => void;
}

export function PDFExportButton({
  buttonLabel = 'Export PDF',
  filename = 'expense-report',
  targetRef,
  onExportStart,
  onExportComplete,
  onExportError,
}: PDFExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const exportToPDF = async () => {
    const target = targetRef?.current || document.body;
    
    if (!target) {
      onExportError?.(new Error('No export target found'));
      return;
    }

    setIsExporting(true);
    setProgress(10);
    onExportStart?.();

    try {
      // Wait a moment for any animations to settle
      await new Promise(resolve => setTimeout(resolve, 300));
      setProgress(30);

      // Capture the content
      const canvas = await html2canvas(target, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a0f1a', // Match dark theme
        logging: false,
        onclone: (clonedDoc) => {
          // Ensure cloned document has proper styles
          const style = clonedDoc.createElement('style');
          style.textContent = `
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        },
      });

      setProgress(60);

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add more pages if content overflows
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      setProgress(90);

      // Save the PDF
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`${filename}-${date}.pdf`);

      setProgress(100);
      
      setTimeout(() => {
        setIsExporting(false);
        setProgress(0);
        onExportComplete?.();
      }, 500);
    } catch (error) {
      setIsExporting(false);
      setProgress(0);
      onExportError?.(error as Error);
    }
  };

  return (
    <button
      onClick={exportToPDF}
      disabled={isExporting}
      className={isExporting ? 'secondary' : 'primary'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Progress bar overlay */}
      {isExporting && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '3px',
            width: `${progress}%`,
            background: '#10b981',
            transition: 'width 0.3s ease',
          }}
        />
      )}

      {isExporting ? (
        <>
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="animate-spin"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="60"
              strokeDashoffset="20"
            />
          </svg>
          <span>Exporting... {progress}%</span>
        </>
      ) : (
        <>
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>{buttonLabel}</span>
        </>
      )}
    </button>
  );
}

// Specialized export button for Reports
export function ReportPDFExport({ 
  reportData, 
  month,
  totalSpent,
  totalIncome,
  categories,
}: {
  reportData: any[];
  month: string;
  totalSpent: number;
  totalIncome: number;
  categories: { name: string; amount: number; color?: string }[];
}) {
  const [isExporting, setIsExporting] = useState(false);

  const exportReportPDF = async () => {
    setIsExporting(true);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Header
      pdf.setFontSize(20);
      pdf.setTextColor(16, 185, 129); // #10b981
      pdf.text('Expense Report', 20, 20);

      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);
      pdf.text(`Period: ${month || 'All Time'}`, 20, 38);

      // Summary section
      pdf.setFontSize(14);
      pdf.setTextColor(16, 185, 129);
      pdf.text('Summary', 20, 55);

      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`Total Income: ₹${totalIncome.toLocaleString()}`, 20, 65);
      pdf.text(`Total Expenses: ₹${totalSpent.toLocaleString()}`, 20, 73);
      const netSavings = totalIncome - totalSpent;
      pdf.setTextColor(netSavings >= 0 ? 16 : 239, netSavings >= 0 ? 185 : 68, netSavings >= 0 ? 129 : 68);
      pdf.text(`Net Savings: ₹${Math.abs(netSavings).toLocaleString()}`, 20, 81);

      // Categories breakdown
      pdf.setFontSize(14);
      pdf.setTextColor(16, 185, 129);
      pdf.text('Spending by Category', 20, 100);

      let yPos = 110;
      const pageHeight = 280;

      categories.slice(0, 10).forEach((cat, index) => {
        if (yPos > pageHeight) {
          pdf.addPage();
          yPos = 20;
        }

        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`${index + 1}. ${cat.name}`, 20, yPos);
        pdf.text(`₹${cat.amount.toLocaleString()}`, 160, yPos);
        yPos += 8;
      });

      // Transactions table
      if (reportData.length > 0) {
        if (yPos > 220) {
          pdf.addPage();
          yPos = 20;
        } else {
          yPos += 10;
        }

        pdf.setFontSize(14);
        pdf.setTextColor(16, 185, 129);
        pdf.text('Recent Transactions', 20, yPos);
        yPos += 15;

        // Table header
        pdf.setFillColor(26, 34, 52);
        pdf.rect(20, yPos - 8, 170, 10, 'F');
        pdf.setFontSize(9);
        pdf.setTextColor(148, 163, 184);
        pdf.text('Date', 22, yPos);
        pdf.text('Category', 55, yPos);
        pdf.text('Description', 95, yPos);
        pdf.text('Amount', 175, yPos, { align: 'right' });
        yPos += 12;

        // Transactions rows
        reportData.slice(0, 15).forEach((tx) => {
          if (yPos > pageHeight) {
            pdf.addPage();
            yPos = 20;
            
            // Table header on new page
            pdf.setFillColor(26, 34, 52);
            pdf.rect(20, yPos - 8, 170, 10, 'F');
            pdf.setTextColor(148, 163, 184);
            pdf.text('Date', 22, yPos);
            pdf.text('Category', 55, yPos);
            pdf.text('Description', 95, yPos);
            pdf.text('Amount', 175, yPos, { align: 'right' });
            yPos += 12;
          }

          pdf.setFontSize(8);
          pdf.setTextColor(255, 255, 255);
          pdf.text(
            new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            22,
            yPos
          );
          pdf.text(tx.category_name || 'Uncategorized', 55, yPos);
          const desc = tx.description?.length > 25 
            ? tx.description.substring(0, 25) + '...' 
            : tx.description || '-';
          pdf.text(desc, 95, yPos);
          
          const isNegative = tx.amount < 0;
          pdf.setTextColor(
            isNegative ? 239 : 16,
            isNegative ? 68 : 185,
            isNegative ? 68 : 129
          );
          pdf.text(
            `₹${Math.abs(tx.amount).toLocaleString()}`,
            175,
            yPos,
            { align: 'right' }
          );
          
          pdf.setTextColor(255, 255, 255);
          yPos += 8;
        });
      }

      // Footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          `Page ${i} of ${totalPages} - Expense Tracker Report`,
          105,
          290,
          { align: 'center' }
        );
      }

      // Save
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`expense-report-${date}.pdf`);
    } catch (error) {
      console.error('PDF Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={exportReportPDF}
      disabled={isExporting}
      className={isExporting ? 'secondary' : 'primary'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      {isExporting ? (
        <>
          <div className="spinner spinner-sm" />
          <span>Generating...</span>
        </>
      ) : (
        <>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>Export Report PDF</span>
        </>
      )}
    </button>
  );
}

export default PDFExportButton;