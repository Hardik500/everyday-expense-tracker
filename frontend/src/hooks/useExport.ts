import { useCallback } from 'react';
import { fetchWithAuth } from '../utils/api';

interface ExportOptions {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  format: 'csv' | 'json' | 'excel';
}

interface Transaction {
  id: number;
  posted_at: string;
  amount: number;
  currency: string;
  description_raw: string;
  description_norm: string;
  category_name?: string;
  subcategory_name?: string;
  account_name?: string;
}

export function useExport(apiBase: string) {
  const downloadFile = useCallback((content: string | Blob, filename: string, type: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, []);

  const convertToCSV = useCallback((data: any[], headers: string[], keys: string[]): string => {
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...data.map((row) => keys.map((key) => escapeCSV(row[key])).join(',')),
    ].join('\n');

    return csvContent;
  }, []);

  const generateExcelXML = useCallback((data: any[], headers: string[], keys: string[], sheetName: string): string => {
    const escapeXML = (str: string): string => {
      return str
        .replace(/\u0026/g, '&amp;')
        .replace(/\u003c/g, '&lt;')
        .replace(/\u003e/g, '&gt;')
        .replace(/\u0022/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const rows = data.map((row, index) => {
      const cells = keys.map((key) => {
        const value = row[key];
        let cellValue = value === null || value === undefined ? '' : String(value);
        
        // Format amounts as numbers
        if (key === 'amount') {
          return `<Cell ss:StyleID="sNumber"><Data ss:Type="Number">${value || 0}</Data></Cell>`;
        }
        
        // Format dates
        if (key === 'posted_at' && value) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return `<Cell ss:StyleID="sDate"><Data ss:Type="DateTime">${date.toISOString()}</Data></Cell>`;
          }
        }
        
        return `<Cell><Data ss:Type="String">${escapeXML(cellValue)}</Data></Cell>`;
      }).join('');
      
      return `<Row>${cells}</Row>`;
    }).join('');

    const headerCells = headers.map((h) => 
      `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXML(h)}</Data></Cell>`
    ).join('');

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="sHeader">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#10b981" ss:Pattern="Solid"/>
      <Font ss:Color="#ffffff"/>
    </Style>
    <Style ss:ID="sNumber">
      <NumberFormat ss:Format="0.00"/>
      <Alignment ss:Horizontal="Right"/>
    </Style>
    <Style ss:ID="sDate">
      <NumberFormat ss:Format="yyyy-mm-dd hh:mm:ss"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXML(sheetName)}">
    <Table>
      <Row>${headerCells}</Row>
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`;
  }, []);

  const exportTransactions = useCallback(async (options: ExportOptions) => {
    const { startDate, endDate, categoryId, format } = options;
    
    // Build query params
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (categoryId) params.append('category_id', categoryId.toString());
    params.append('limit', '10000'); // Get all transactions

    const response = await fetchWithAuth(`${apiBase}/transactions?${params}`);
    const data = await response.json();
    const transactions: Transaction[] = data.transactions || data || [];

    if (format === 'json') {
      const jsonContent = JSON.stringify(transactions, null, 2);
      const filename = `expense-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(jsonContent, filename, 'application/json');
      return { success: true, count: transactions.length, filename };
    }

    if (format === 'csv') {
      const headers = ['Date', 'Description', 'Category', 'Subcategory', 'Account', 'Amount', 'Currency'];
      const keys = ['posted_at', 'description_norm', 'category_name', 'subcategory_name', 'account_name', 'amount', 'currency'];
      
      const mappedData = transactions.map((t) => ({
        posted_at: t.posted_at ? new Date(t.posted_at).toLocaleDateString('en-IN') : '',
        description_norm: t.description_norm || t.description_raw || '',
        category_name: t.category_name || 'Uncategorized',
        subcategory_name: t.subcategory_name || '',
        account_name: t.account_name || '',
        amount: t.amount,
        currency: t.currency || 'INR',
      }));

      const csvContent = convertToCSV(mappedData, headers, keys);
      const filename = `expense-tracker-export-${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csvContent, filename, 'text/csv');
      return { success: true, count: transactions.length, filename };
    }

    if (format === 'excel') {
      const headers = ['Date', 'Description', 'Category', 'Subcategory', 'Account', 'Amount', 'Currency'];
      const keys = ['posted_at', 'description_norm', 'category_name', 'subcategory_name', 'account_name', 'amount', 'currency'];
      
      const mappedData = transactions.map((t) => ({
        posted_at: t.posted_at,
        description_norm: t.description_norm || t.description_raw || '',
        category_name: t.category_name || 'Uncategorized',
        subcategory_name: t.subcategory_name || '',
        account_name: t.account_name || '',
        amount: t.amount,
        currency: t.currency || 'INR',
      }));

      const xmlContent = generateExcelXML(mappedData, headers, keys, 'Transactions');
      const filename = `expense-tracker-export-${new Date().toISOString().split('T')[0]}.xls`;
      downloadFile(xmlContent, filename, 'application/vnd.ms-excel');
      return { success: true, count: transactions.length, filename };
    }

    return { success: false, count: 0, filename: '' };
  }, [apiBase, downloadFile, convertToCSV, generateExcelXML]);

  const exportSummary = useCallback(async (options: ExportOptions) => {
    const { startDate, endDate, format } = options;
    
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await fetchWithAuth(`${apiBase}/reports/summary?${params}`);
    const data = await response.json();
    const items = data.items || [];

    if (format === 'json') {
      const filename = `expense-tracker-summary-${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
      return { success: true, count: items.length, filename };
    }

    if (format === 'csv') {
      const headers = ['Category', 'Total Amount', 'Percentage'];
      const keys = ['category_name', 'total', 'percentage'];
      
      const total = items.reduce((sum: number, item: any) => sum + Math.abs(item.total || 0), 0);
      const mappedItems = items.map((item: any) => ({
        category_name: item.category_name || 'Uncategorized',
        total: item.total,
        percentage: total > 0 ? ((Math.abs(item.total || 0) / total) * 100).toFixed(2) + '%' : '0%',
      }));

      const csvContent = convertToCSV(mappedItems, headers, keys);
      const filename = `expense-tracker-summary-${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csvContent, filename, 'text/csv');
      return { success: true, count: items.length, filename };
    }

    if (format === 'excel') {
      const headers = ['Category', 'Total Amount', 'Percentage'];
      const keys = ['category_name', 'total', 'percentage'];
      
      const total = items.reduce((sum: number, item: any) => sum + Math.abs(item.total || 0), 0);
      const mappedItems = items.map((item: any) => ({
        category_name: item.category_name || 'Uncategorized',
        total: item.total,
        percentage: total > 0 ? ((Math.abs(item.total || 0) / total) * 100).toFixed(2) : '0',
      }));

      const xmlContent = generateExcelXML(mappedItems, headers, keys, 'Summary');
      const filename = `expense-tracker-summary-${new Date().toISOString().split('T')[0]}.xls`;
      downloadFile(xmlContent, filename, 'application/vnd.ms-excel');
      return { success: true, count: items.length, filename };
    }

    return { success: false, count: 0, filename: '' };
  }, [apiBase, downloadFile, convertToCSV, generateExcelXML]);

  return { exportTransactions, exportSummary };
}
