
import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext';
import { useAuth } from '../../context/AuthContext';
import { Outlet } from '../../types';
import { OUTLETS } from '../../constants';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Select from '../../components/Select';
import SearchableSelect from '../../components/SearchableSelect';
import TabButton from '../../components/TabButton';
import { Loader2, Search, CheckCircle, XCircle, Smartphone, Ticket } from '../../components/icons/Icons';

type KasirViewMode = 'redeem_digital' | 'input_physical';

const KasirView: React.FC = () => {
  const [mode, setMode] = useState<KasirViewMode>('redeem_digital');
  
  return (
    <div className="max-w-xl mx-auto">
        <div className="mb-4 flex border-b border-gray-200">
            <TabButton 
                isActive={mode === 'redeem_digital'} 
                onClick={() => setMode('redeem_digital')}
                icon={<Smartphone />}
            >
                Tebus Voucher Digital
            </TabButton>
            <TabButton 
                isActive={mode === 'input_physical'} 
                onClick={() => setMode('input_physical')}
                icon={<Ticket />}
            >
                Input Voucher Fisik
            </TabButton>
        </div>

        {mode === 'redeem_digital' ? <RedeemDigitalForm /> : <InputPhysicalForm />}
    </div>
  );
};

const RedeemDigitalForm: React.FC = () => {
  const { currentUser } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [outlet, setOutlet] = useState<Outlet>(currentUser?.outlet || OUTLETS[0]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { redeemVoucher } = useVouchers();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!identifier) {
        setMessage({type: 'error', text: "Silakan masukkan kode voucher atau nomor WhatsApp."});
        return;
    }

    setIsSubmitting(true);
    try {
      const redeemed = await redeemVoucher(identifier, outlet);
      setMessage({type: 'success', text: `Voucher ${redeemed.voucherCode} atas nama nomor ${redeemed.whatsappNumber} berhasil ditukarkan di ${outlet}!`});
      setIdentifier('');
    } catch (error: any) {
      setMessage({type: 'error', text: error.message || 'Terjadi kesalahan yang tidak terduga.'});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Tebus Voucher Digital</h2>
      <p className="text-gray-500 mb-6">Masukkan kode voucher atau nomor WhatsApp pelanggan untuk menandainya sebagai sudah digunakan.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Kode Voucher / Nomor WhatsApp"
          id="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Masukkan kode atau nomor HP"
          required
          Icon={Search}
        />
        <SearchableSelect
            label="Klaim Outlet"
            id="redeem-outlet"
            options={OUTLETS}
            value={outlet}
            onChange={(value) => setOutlet(value)}
            placeholder="Pilih outlet penukaran..."
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <><Loader2 className="animate-spin mr-2"/> Memproses...</> : 'Tebus Voucher'}
        </Button>
      </form>
      {message && <StatusMessage type={message.type} text={message.text} />}
    </div>
  );
};


const InputPhysicalForm: React.FC = () => {
    const { currentUser } = useAuth();
    const { recordPhysicalVoucher } = useVouchers();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // New fields as requested
    const [gender, setGender] = useState<'Pria' | 'Wanita'>('Pria');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [outlet, setOutlet] = useState<Outlet>(currentUser?.outlet || OUTLETS[0]);
    const [voucherCode, setVoucherCode] = useState('');
    
    const resetForm = () => {
        setGender('Pria');
        setWhatsappNumber('');
        setVoucherCode('');
        setOutlet(currentUser?.outlet || OUTLETS[0]);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (!whatsappNumber || !voucherCode) {
            setMessage({ type: 'error', text: "Mohon isi semua kolom yang wajib diisi." });
            return;
        }

        setIsSubmitting(true);
        try {
            // Record physical voucher with Gender, WhatsApp, and Outlet
            const recorded = await recordPhysicalVoucher({ 
                gender, 
                whatsappNumber, 
                voucherCode, 
                outlet 
            });
            setMessage({ type: 'success', text: `Voucher Fisik ${recorded.voucherCode} berhasil dicatat!` });
            resetForm();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Terjadi kesalahan.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Input Voucher Fisik</h2>
            <p className="text-gray-500 mb-6">Masukkan data pelanggan untuk klaim voucher fisik.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <Select 
                    label="Jenis Kelamin" 
                    id="phys-gender" 
                    value={gender} 
                    onChange={(e) => setGender(e.target.value as 'Pria' | 'Wanita')}
                >
                    <option value="Pria">Pria</option>
                    <option value="Wanita">Wanita</option>
                </Select>

                <Input 
                    label="No HP" 
                    id="phys-whatsapp" 
                    value={whatsappNumber} 
                    onChange={e => setWhatsappNumber(e.target.value)} 
                    type="tel" 
                    placeholder="Contoh: 08123456789"
                    required 
                />
                
                <SearchableSelect
                  label="Klaim Outlet"
                  id="phys-outlet"
                  options={OUTLETS}
                  value={outlet}
                  onChange={(value) => setOutlet(value)}
                  placeholder="Cari atau pilih outlet..."
                />

                <div className="border-t border-gray-200 pt-4 mt-2">
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Verifikasi Kode</p>
                    <Input 
                        label="Kode Unik Voucher Fisik" 
                        id="phys-code" 
                        value={voucherCode} 
                        onChange={e => setVoucherCode(e.target.value)} 
                        placeholder="Masukkan kode yang tertera di fisik"
                        required 
                    />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? <><Loader2 className="animate-spin mr-2"/> Menyimpan...</> : 'Simpan Data'}
                </Button>
            </form>
             {message && <StatusMessage type={message.type} text={message.text} />}
        </div>
    );
}

const StatusMessage: React.FC<{type: 'success' | 'error', text: string}> = ({type, text}) => (
    <div className={`mt-6 p-4 rounded-md flex items-start gap-3 text-sm ${type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
        {type === 'success' ? <CheckCircle className="flex-shrink-0 mt-0.5" /> : <XCircle className="flex-shrink-0 mt-0.5"/>}
        <span>{text}</span>
    </div>
);


export default KasirView;