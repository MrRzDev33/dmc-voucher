
import React, { useState, useRef } from 'react';
import { useVouchers } from '../context/VoucherContext';
import { Outlet, Voucher } from '../types';
import { OUTLETS } from '../constants';
import VoucherCard from '../components/VoucherCard';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input from '../components/Input';
import SearchableSelect from '../components/SearchableSelect';
import { Loader2 } from '../components/icons/Icons';
// Import html2canvas dynamically
const html2canvas = import('html2canvas');


const ClaimPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [outlet, setOutlet] = useState<Outlet>(OUTLETS[0]);
  const [generatedVoucher, setGeneratedVoucher] = useState<Voucher | null>(null);
  const [formError, setFormError] = useState('');

  const { claimVoucher, error, loading: contextLoading } = useVouchers();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const voucherRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!fullName || !birthYear || !whatsappNumber) {
      setFormError('Semua kolom wajib diisi.');
      return;
    }
    if (!/^\d{4}$/.test(birthYear) || parseInt(birthYear, 10) > new Date().getFullYear() || parseInt(birthYear, 10) < 1920) {
      setFormError('Mohon masukkan 4 digit tahun lahir yang valid.');
      return;
    }
    if (!/^\d{10,14}$/.test(whatsappNumber)) {
        setFormError('Mohon masukkan nomor WhatsApp yang valid (10-14 digit).');
        return;
    }

    setIsSubmitting(true);
    try {
      const newVoucher = await claimVoucher({ fullName, birthYear, whatsappNumber, outlet });
      setGeneratedVoucher(newVoucher);
    } catch (err) {
      // Error is handled by the context and displayed below
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    const canvasModule = await html2canvas;
    const h2c = canvasModule.default;

    if (voucherRef.current) {
      const canvas = await h2c(voucherRef.current, { scale: 2 });
      const link = document.createElement('a');
      link.download = `Voucher-DMC-${generatedVoucher?.voucherCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-2xl">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center text-primary mb-2">Klaim Voucher Hari Guru!</h1>
        <p className="text-center text-gray-600 mb-8">Isi data diri sobat di bawah ini untuk mendapatkan voucher eksklusif dari kami.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Nama Lengkap"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Contoh: Budi Santoso"
            required
          />
          <Input
            label="Tahun Lahir"
            id="birthYear"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="Contoh: 1995"
            type="number"
            required
          />
          <Input
            label="No. WhatsApp"
            id="whatsappNumber"
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="Contoh: 081234567890"
            required
          />
          <SearchableSelect
            label="Klaim di Outlet"
            id="outlet"
            options={OUTLETS}
            value={outlet}
            onChange={(value) => setOutlet(value)}
            placeholder="Cari outlet..."
          />
          
          {formError && <p className="text-red-500 text-sm">{formError}</p>}
          {error && <p className="text-red-500 text-sm">{error.includes("limit") ? 'Maaf, batas klaim harian telah tercapai.' : error}</p>}
          
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? <><Loader2 className="animate-spin mr-2" /> Memproses...</> : 'Klaim Voucher Saya'}
          </Button>
        </form>
      </div>

      {generatedVoucher && (
        <Modal
          isOpen={!!generatedVoucher}
          onClose={() => setGeneratedVoucher(null)}
          title="Voucher Berhasil Dibuat!"
        >
            <p className="text-center text-gray-600 mb-4">Selamat! Ini adalah voucher Anda. Silakan unduh dan tunjukkan kepada kasir di outlet.</p>
            <VoucherCard ref={voucherRef} voucher={generatedVoucher} />
            <div className="mt-6 flex justify-center">
                <Button onClick={handleDownload}>
                    Unduh Voucher (PNG)
                </Button>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default ClaimPage;
