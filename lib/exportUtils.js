import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

export async function exportToExcel({ expenses, categories, period, periodLabel }) {
  const catMap = {};
  categories.forEach(c => catMap[c.id] = c);

  // Sheet 1: All Transactions
  const txRows = expenses.map(e => ({
    Date: e.expense_date,
    Description: e.description || '',
    Category: catMap[e.category_id]?.name || 'Others',
    Amount: parseFloat(e.amount),
    Type: e.is_shared ? 'Shared' : 'Personal',
  }));

  // Sheet 2: Category Summary
  const catTotals = {};
  expenses.forEach(e => {
    const name = catMap[e.category_id]?.name || 'Others';
    if (!catTotals[name]) catTotals[name] = { personal: 0, shared: 0 };
    if (e.is_shared) catTotals[name].shared += parseFloat(e.amount);
    else catTotals[name].personal += parseFloat(e.amount);
  });

  const catRows = Object.entries(catTotals)
    .map(([name, vals]) => ({
      Category: name,
      Personal: vals.personal,
      Shared: vals.shared,
      Total: vals.personal + vals.shared,
    }))
    .sort((a, b) => b.Total - a.Total);

  catRows.push({
    Category: 'TOTAL',
    Personal: catRows.reduce((s, r) => s + r.Personal, 0),
    Shared: catRows.reduce((s, r) => s + r.Shared, 0),
    Total: catRows.reduce((s, r) => s + r.Total, 0),
  });

  // Sheet 3: Monthly Summary
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthlyTotals = {};
  expenses.forEach(e => {
    const month = e.expense_date?.slice(0, 7);
    if (!month) return;
    if (!monthlyTotals[month]) monthlyTotals[month] = { personal: 0, shared: 0 };
    if (e.is_shared) monthlyTotals[month].shared += parseFloat(e.amount);
    else monthlyTotals[month].personal += parseFloat(e.amount);
  });

  const monthlyRows = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => {
      const idx = parseInt(month.split('-')[1]) - 1;
      return {
        Month: monthNames[idx],
        Personal: vals.personal,
        Shared: vals.shared,
        Total: vals.personal + vals.shared,
      };
    });

  // Build workbook
  const wb = XLSX.utils.book_new();

  const txSheet = XLSX.utils.json_to_sheet(txRows);
  txSheet['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, txSheet, 'Transactions');

  const catSheet = XLSX.utils.json_to_sheet(catRows);
  catSheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, catSheet, 'By Category');

  if (monthlyRows.length > 0) {
    const monthSheet = XLSX.utils.json_to_sheet(monthlyRows);
    monthSheet['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, monthSheet, 'By Month');
  }

  // Write as base64 string
  const wbOut = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const fileName = `ExpenseTracker_${periodLabel}.xlsx`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, wbOut, {
    encoding: 'base64',
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Export ${periodLabel}`,
    });
  } else {
    throw new Error('Sharing not available on this device');
  }
}