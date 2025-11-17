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
      setFormError('All fields are required.');
      return;
    }
    if (!/^\d{4}$/.test(birthYear) || parseInt(birthYear, 10) > new Date().getFullYear() || parseInt(birthYear, 10) < 1920) {
      setFormError('Please enter a valid 4-digit year of birth.');
      return;
    }
    if (!/^\d{10,14}$/.test(whatsappNumber)) {
        setFormError('Please enter a valid WhatsApp number (10-14 digits).');
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
        <h1 className="text-3xl font-bold text-center text-primary mb-2">Claim Your Free Voucher!</h1>
        <p className="text-center text-gray-600 mb-8">Fill in your details below to receive an exclusive voucher from us.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Nama"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g., Budi Santoso"
            required
          />
          <Input
            label="Tahun Lahir"
            id="birthYear"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="e.g., 1995"
            type="number"
            required
          />
          <Input
            label="No. WhatsApp"
            id="whatsappNumber"
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="e.g., 081234567890"
            required
          />
          <SearchableSelect
            label="Claim di Outlet"
            id="outlet"
            options={OUTLETS}
            value={outlet}
            onChange={(value) => setOutlet(value)}
            placeholder="Cari outlet..."
          />
          
          {formError && <p className="text-red-500 text-sm">{formError}</p>}
          {error && <p className="text-red-500 text-sm">{error.includes("limit") ? 'Sorry, the daily voucher limit has been reached.' : error}</p>}
          
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? <><Loader2 className="animate-spin mr-2" /> Submitting...</> : 'Claim My Voucher'}
          </Button>
        </form>
      </div>

      {generatedVoucher && (
        <Modal
          isOpen={!!generatedVoucher}
          onClose={() => setGeneratedVoucher(null)}
          title="Voucher Generated Successfully!"
        >
            <p className="text-center text-gray-600 mb-4">Congratulations! Here is your voucher. Please download and show it at the outlet.</p>
            <VoucherCard ref={voucherRef} voucher={generatedVoucher} />
            <div className="mt-6 flex justify-center">
                <Button onClick={handleDownload}>
                    Download Voucher (PNG)
                </Button>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default ClaimPage;