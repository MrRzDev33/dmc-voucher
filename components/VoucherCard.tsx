
import React, { forwardRef } from 'react';
import { Voucher } from '../types';
import { formatDate } from '../services/util';

interface VoucherCardProps {
  voucher: Voucher;
}

const VoucherCard = forwardRef<HTMLDivElement, VoucherCardProps>(({ voucher }, ref) => {
  return (
    <div ref={ref} className="bg-gradient-to-br from-primary to-secondary text-white rounded-xl shadow-lg font-sans max-w-md mx-auto">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-2xl font-bold">DMC Voucher</span>
            <p className="text-sm text-orange-200">Voucher Promo Eksklusif</p>
          </div>
          <div className="text-right">
             <div className="text-xs uppercase tracking-widest text-orange-200">Kode Voucher</div>
             <div className="text-2xl font-mono font-bold tracking-wider">{voucher.voucherCode}</div>
          </div>
        </div>

        <div className="border-t border-dashed border-orange-300 my-4"></div>

        <div className="space-y-3 text-sm">
            <div>
                <p className="text-xs uppercase text-orange-200">Nama</p>
                <p className="font-semibold text-lg">{voucher.fullName || '-'}</p>
            </div>
            <div>
                <p className="text-xs uppercase text-orange-200">Nomor WhatsApp</p>
                <p className="font-semibold">{voucher.whatsappNumber}</p>
            </div>
            <div className="flex justify-between">
                <div>
                    <p className="text-xs uppercase text-orange-200">Outlet</p>
                    <p className="font-semibold">{voucher.outlet}</p>
                </div>
                <div>
                    <p className="text-xs uppercase text-orange-200">Tanggal Klaim</p>
                    <p className="font-semibold text-right">{formatDate(voucher.claimDate)}</p>
                </div>
            </div>
        </div>
      </div>
       <div className="bg-orange-800 bg-opacity-50 rounded-b-xl px-6 py-2 text-center text-xs">
          <p>Tunjukkan voucher ini ke kasir untuk ditukarkan. Berlaku untuk satu kali penggunaan.</p>
       </div>
    </div>
  );
});

export default VoucherCard;