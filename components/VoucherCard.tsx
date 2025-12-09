
import React, { forwardRef } from 'react';
import { Voucher } from '../types';
import { formatDate, formatCurrency } from '../services/util';

interface VoucherCardProps {
  voucher: Voucher;
}

const VoucherCard = forwardRef<HTMLDivElement, VoucherCardProps>(({ voucher }, ref) => {
  return (
    <div 
      ref={ref} 
      id="printable-voucher"
      className="bg-gradient-to-br from-primary to-secondary text-white rounded-xl shadow-lg font-sans max-w-md mx-auto relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
         <svg width="150" height="150" viewBox="0 0 24 24" fill="currentColor"><path d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
      </div>

      <div className="p-6 relative z-10">
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="text-3xl font-bold tracking-tight">DMC Voucher</span>
            <p className="text-sm text-orange-200 mt-1">Voucher Promo 12.12</p>
          </div>
          <div className="text-right">
             <div className="text-xs uppercase tracking-widest text-orange-200">Potongan</div>
             <div className="text-3xl font-extrabold text-white drop-shadow-sm">
                {formatCurrency(voucher.discountAmount || 10000)}
             </div>
          </div>
        </div>

        <div className="border-t-2 border-dashed border-white/30 my-5"></div>

        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20 text-sm">
            <div className="flex justify-between items-center mb-4">
                 <span className="text-orange-100 uppercase text-xs">Kode Unik</span>
                 <span className="font-mono font-bold text-xl tracking-wider bg-white text-primary px-2 py-1 rounded">{voucher.voucherCode}</span>
            </div>
            
            <div className="space-y-3">
                {/* Baris 1: Nama dan Tanggal */}
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase text-orange-200">Nama</p>
                        {/* HAPUS truncate, GANTI dengan break-words agar nama panjang turun ke bawah */}
                        <p className="font-semibold break-words leading-tight">{voucher.fullName || '-'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-xs uppercase text-orange-200">Tanggal Klaim</p>
                        <p className="font-semibold">{formatDate(voucher.claimDate)}</p>
                    </div>
                </div>

                {/* Baris 2: WhatsApp */}
                <div>
                    <p className="text-xs uppercase text-orange-200">WhatsApp</p>
                    <p className="font-semibold">{voucher.whatsappNumber}</p>
                </div>

                {/* Baris 3: Outlet (Full Width & Terpisah) */}
                <div className="pt-2 mt-2 border-t border-white/10">
                     <p className="text-xs uppercase text-orange-200">Outlet</p>
                     <p className="font-semibold leading-snug break-words">{voucher.outlet}</p>
                </div>
            </div>
        </div>
      </div>
       <div className="bg-black/20 px-6 py-3 text-center text-xs text-orange-50 relative z-10">
          <p>Tunjukkan voucher ini ke kasir untuk mendapatkan potongan harga. Berlaku satu kali.</p>
       </div>
    </div>
  );
});

export default VoucherCard;
