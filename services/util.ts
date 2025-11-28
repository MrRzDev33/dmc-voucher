
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
        return new Date(isoString).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    } catch (error) {
        return "Tanggal Tidak Valid";
    }
}

export const formatCurrency = (amount?: number): string => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

export const exportToCSV = (data: Voucher[], filename: string) => {
  const headers = [
    'ID', 'Nama Lengkap', 'Jenis Kelamin', 'Tahun Lahir', 'No WhatsApp', 'Pengambilan Voucher (Klaim)', 'Kode Voucher', 'Nominal Potongan',
    'Tanggal Klaim', 'Sudah Ditebus', 'Tanggal Tebus', 'Penukaran Voucher (Redeem)', 'Tipe', 'Catatan'
  ];
  const csvRows = [headers.join(',')];

  data.forEach(row => {
    const values = [
      row.id,
      `"${(row.fullName || '-').replace(/"/g, '""')}"`,
      row.gender || '-',
      row.birthYear || '-',
      row.whatsappNumber,
      `"${row.outlet.replace(/"/g, '""')}"`,
      row.voucherCode,
      row.discountAmount || 0,
      formatDate(row.claimDate),
      row.isRedeemed ? 'Ya' : 'Tidak',
      row.redeemedDate ? formatDate(row.redeemedDate) : '-',
      `"${(row.redeemedOutlet || '-').replace(/"/g, '""')}"`,
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
