import React, { useState, useRef } from 'react';
import { useVouchers } from '../context/VoucherContext';
import { Outlet, Voucher } from '../types';
import { OUTLETS } from '../constants';
import VoucherCard from '../components/VoucherCard';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input from '../components/Input';
import SearchableSelect from '../components/SearchableSelect';
import { Loader2, CalendarClock } from '../components/icons/Icons';
import html2canvas from 'html2canvas';

const ClaimPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [outlet, setOutlet] = useState<Outlet>(OUTLETS[0]);
  const [generatedVoucher, setGeneratedVoucher] = useState<Voucher | null>(null);
  const [formError, setFormError] = useState('');
  
  // State untuk menghitung jumlah kegagalan karena duplikat
  const [failCount, setFailCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  const { claimVoucher, error, loading: contextLoading, isClaimEnabled } = useVouchers();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const voucherRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) return; // Mencegah submit jika sudah diblokir

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
      // Reset fail count jika berhasil
      setFailCount(0);
    } catch (err: any) {
       // Logika Blokir 3x Percobaan dengan nomor sama/duplikat
       if (err.message && err.message.includes("Nomor WhatsApp ini sudah pernah mengklaim")) {
           const newCount = failCount + 1;
           setFailCount(newCount);
           if (newCount >= 3) {
               setIsBlocked(true);
               setShowBlockModal(true);
           }
       }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (voucherRef.current) {
      // Kita gunakan opsi 'onclone' untuk memanipulasi elemen sebelum di-screenshot.
      // Ini penting agar saat download di HP (layar kecil), hasil gambar tetap lebar (seperti di desktop)
      // dan teks tidak terpotong atau turun berantakan.
      const canvas = await html2canvas(voucherRef.current, { 
          scale: 3, // Resolusi tinggi
          backgroundColor: null,
          onclone: (clonedDoc) => {
              const clonedElement = clonedDoc.getElementById('printable-voucher');
              if (clonedElement) {
                  // Paksa lebar elemen di dalam canvas menjadi 480px (ukuran ideal kartu)
                  // Ini mencegah layout "squashed" di mobile
                  clonedElement.style.width = '480px';
                  clonedElement.style.maxWidth = 'none';
                  clonedElement.style.margin = '0 auto';
              }
          }
      });

      const link = document.createElement('a');
      link.download = `Voucher-DMC-${generatedVoucher?.voucherCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  // Tampilan Loading Awal saat cek status ON/OFF
  if (contextLoading) {
      return (
        <div className="flex justify-center items-center min-h-[50vh]">
            <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      );
  }

  // Tampilan Jika Klaim Ditutup (OFF)
  if (!isClaimEnabled) {
      return (
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-2xl text-center">
            <div className="bg-white p-10 rounded-xl shadow-lg flex flex-col items-center">
                <div className="bg-orange-100 p-6 rounded-full mb-6">
                    <CalendarClock size={64} className="text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Belum Waktunya</h1>
                <p className="text-gray-600 mb-6 text-lg">
                    Mohon maaf, saat ini fitur klaim voucher belum dibuka atau sudah ditutup. 
                    Silakan kembali lagi nanti atau pantau informasi terbaru di media sosial kami.
                </p>
                <div className="text-sm text-gray-400">
                    &copy; Donat Madu Indonesia
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-2xl">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <h1 className="text-3xl font-bold text-center text-primary mb-2">Klaim Voucher 12.12!</h1>
        <p className="text-center text-gray-600 mb-8">Isi data diri sobat di bawah ini untuk mendapatkan voucher eksklusif dari kami.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Nama Lengkap"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Contoh: Budi Santoso"
            required
            disabled={isBlocked}
          />
          <Input
            label="Tahun Lahir"
            id="birthYear"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="Contoh: 1995"
            type="number"
            required
            disabled={isBlocked}
          />
          <Input
            label="No. WhatsApp"
            id="whatsappNumber"
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="Contoh: 081234567890"
            required
            disabled={isBlocked}
          />
          <SearchableSelect
            label="Klaim di Outlet"
            id="outlet"
            options={OUTLETS}
            value={outlet}
            onChange={(value) => setOutlet(value)}
            placeholder="Cari outlet..."
          />
          
          {formError && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-md border border-red-200">{formError}</p>}
          {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-md border border-red-200">{error.includes("limit") ? 'Maaf, batas klaim harian telah tercapai.' : error}</p>}
          
          <Button 
            type="submit" 
            disabled={isSubmitting || isBlocked} 
            className="w-full notranslate py-3 text-lg shadow-md hover:shadow-lg transition-all" 
            translate="no"
          >
            {isSubmitting ? <><Loader2 className="animate-spin mr-2" /> Memproses...</> : 'Klaim Voucher Saya'}
          </Button>
        </form>
      </div>

      {/* Modal Sukses */}
      {generatedVoucher && (
        <Modal
          isOpen={!!generatedVoucher}
          onClose={() => setGeneratedVoucher(null)}
          title="Voucher Berhasil Dibuat!"
        >
            <p className="text-center text-gray-600 mb-4">Selamat! Ini adalah voucher Anda. Silakan unduh dan tunjukkan kepada kasir di outlet.</p>
            {/* Voucher Card Container */}
            <div className="flex justify-center w-full mb-6">
                <VoucherCard ref={voucherRef} voucher={generatedVoucher} />
            </div>
            <div className="flex flex-col gap-3">
                <Button onClick={handleDownload} className="w-full">
                    Unduh Voucher (PNG)
                </Button>
                 <button 
                    onClick={() => setGeneratedVoucher(null)} 
                    className="text-gray-500 text-sm hover:text-gray-700 underline"
                >
                    Tutup
                </button>
            </div>
        </Modal>
      )}

      {/* Modal Blokir 3x Gagal */}
      <Modal
         isOpen={showBlockModal}
         onClose={() => setShowBlockModal(false)}
         title="Akses Diblokir Sementara"
      >
         <div className="text-center">
             <div className="flex justify-center mb-4">
                 <div className="bg-red-100 p-3 rounded-full">
                     <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                 </div>
             </div>
             <p className="text-gray-700 font-medium text-lg mb-2">
                Peringatan Keamanan
             </p>
             <p className="text-gray-600 mb-4">
                Kamu sudah mencoba klaim dengan nomor yang sama sebanyak tiga kali. Silahkan ubah dengan nomor yang berbeda atau kamu tidak akan bisa klaim lagi.
             </p>
             <Button onClick={() => setShowBlockModal(false)} variant="secondary" className="w-full">
                 Saya Mengerti
             </Button>
         </div>
      </Modal>

    </div>
  );
};

export default ClaimPage;
