import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatINR } from './currency';

export interface MonthlyReportData {
  userName?: string;
  monthName: string;
  year: number;
  totalBalance: number;
  income: number;
  expense: number;
  netSavings: number;
  categorySpending: Array<{ name: string; value: number }>;
  budgets: Array<{ category: { name: string }; budgeted: number; spent: number; remaining: number }>;
  insights: { summary: string; tips: string[] } | null;
}

export function generateMonthlyPDFReport(data: MonthlyReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // -------------------------------------------------------------
  // 1. Header Banner
  // -------------------------------------------------------------
  doc.setFillColor(37, 99, 235); // Blue #2563eb
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FinSense', margin, 12);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Monthly Financial Report', margin, 18);

  const reportPeriod = `${data.monthName} ${data.year}`;
  doc.setFontSize(10);
  doc.text(`Period: ${reportPeriod}`, pageWidth - margin, 12, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, 18, { align: 'right' });

  let currentY = 34;

  // -------------------------------------------------------------
  // 2. Executive Summary Cards (4 Columns)
  // -------------------------------------------------------------
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Cash Flow Summary', margin, currentY);
  currentY += 5;

  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cardHeight = 18;
  const cards = [
    { label: 'Total Balance', value: formatINR(data.totalBalance), color: data.totalBalance < 0 ? [239, 68, 68] : [31, 41, 55] },
    { label: 'Income', value: `+${formatINR(data.income)}`, color: [16, 185, 129] },
    { label: 'Expenses', value: `-${formatINR(data.expense)}`, color: [239, 68, 68] },
    { label: 'Net Savings', value: formatINR(data.netSavings), color: data.netSavings >= 0 ? [37, 99, 235] : [239, 68, 68] },
  ];

  cards.forEach((c, i) => {
    const cardX = margin + i * (cardWidth + 3);
    doc.setFillColor(249, 250, 251); // Light gray
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(c.label, cardX + 3, currentY + 5);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.value, cardX + 3, currentY + 12);
  });

  currentY += cardHeight + 8;

  // -------------------------------------------------------------
  // 3. Spending by Category Table
  // -------------------------------------------------------------
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Spending by Category', margin, currentY);
  currentY += 2;

  const categoryRows = data.categorySpending.map(c => {
    const share = data.expense > 0 ? Math.round((c.value / data.expense) * 100) : 0;
    return [c.name, formatINR(c.value), `${share}%`];
  });

  if (categoryRows.length === 0) {
    categoryRows.push(['No expenses recorded this month', '₹0', '0%']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Category', 'Amount (₹)', 'Share of Total']],
    body: categoryRows,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // -------------------------------------------------------------
  // 4. Budget vs. Actual Table
  // -------------------------------------------------------------
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Budget vs. Actual', margin, currentY);
  currentY += 2;

  const budgetRows = data.budgets.map(b => {
    const percent = b.budgeted > 0 ? Math.round((b.spent / b.budgeted) * 100) : 0;
    const status = percent > 100 ? 'Over Budget' : percent >= 80 ? 'Near Budget' : 'On Track';
    return [
      b.category?.name || 'General',
      formatINR(b.budgeted),
      formatINR(b.spent),
      formatINR(b.remaining),
      `${percent}% (${status})`,
    ];
  });

  if (budgetRows.length === 0) {
    budgetRows.push(['No budgets defined for this month', '₹0', '₹0', '₹0', 'N/A']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Category', 'Budget (₹)', 'Spent (₹)', 'Remaining (₹)', 'Utilization']],
    body: budgetRows,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // -------------------------------------------------------------
  // 5. AI Financial Insights & Actionable Recommendations
  // -------------------------------------------------------------
  // If near the bottom of page, add a page
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = 16;
  }

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AI Financial Insights', margin, currentY);
  currentY += 4;

  if (data.insights) {
    // Summary box
    doc.setFillColor(239, 246, 255); // Soft blue
    doc.setDrawColor(191, 219, 254);
    
    const summaryLines = doc.splitTextToSize(data.insights.summary, pageWidth - margin * 2 - 8);
    const boxHeight = summaryLines.length * 4.5 + 6;

    doc.roundedRect(margin, currentY, pageWidth - margin * 2, boxHeight, 2, 2, 'FD');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(30, 58, 138);
    doc.text(summaryLines, margin + 4, currentY + 5);

    currentY += boxHeight + 4;

    // Tips list
    if (data.insights.tips && data.insights.tips.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text('Key Observations & Recommendations:', margin, currentY);
      currentY += 4;

      data.insights.tips.forEach((tip, idx) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        const bulletText = doc.splitTextToSize(`${idx + 1}. ${tip}`, pageWidth - margin * 2 - 6);
        doc.text(bulletText, margin + 3, currentY);
        currentY += bulletText.length * 4 + 1.5;
      });
    }
  } else {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('No AI insights generated for this period.', margin, currentY);
    currentY += 6;
  }

  // -------------------------------------------------------------
  // 6. Footer & Legal Disclaimer
  // -------------------------------------------------------------
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(156, 163, 175);
  doc.text(
    'FinSense Personal Finance • This is not professional financial advice.',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  // Save the PDF file
  const filename = `FinSense-Report-${data.year}-${data.monthName.toLowerCase()}.pdf`;
  doc.save(filename);
}
