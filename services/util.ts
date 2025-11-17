import { Voucher } from '../types';

export const generateVoucherCode = (): string => {
  // Generate an 8-digit random number as a string
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
  return randomDigits;
};

export const getTodayDateString = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export const formatDate = (isoString: string): string => {
    try {
        return new Date(isoString).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    } catch (error) {
        return "Invalid Date";
    }
}

export const exportToCSV = (data: Voucher[], filename: string) => {
  const headers = [
    'ID', 'Full Name', 'Birth Year', 'WhatsApp Number', 'Outlet', 'Voucher Code', 
    'Claim Date', 'Is Redeemed', 'Redeemed Date', 'Type', 'Notes'
  ];
  const csvRows = [headers.join(',')];

  data.forEach(row => {
    const values = [
      row.id,
      `"${row.fullName.replace(/"/g, '""')}"`,
      row.birthYear,
      row.whatsappNumber,
      row.outlet,
      row.voucherCode,
      formatDate(row.claimDate),
      row.isRedeemed,
      row.redeemedDate ? formatDate(row.redeemedDate) : 'N/A',
      row.type,
      `"${row.notes?.replace(/"/g, '""') || ''}"`
    ];
    csvRows.push(values.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};