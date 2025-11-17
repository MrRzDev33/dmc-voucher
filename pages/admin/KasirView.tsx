import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext';
import { useAuth } from '../../context/AuthContext';
import { Outlet } from '../../types';
import { OUTLETS } from '../../constants';
import Button from '../../components/Button';
import Input from '../../components/Input';
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
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { redeemVoucher } = useVouchers();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!identifier) {
        setMessage({type: 'error', text: "Please enter a voucher code or WhatsApp number."});
        return;
    }

    setIsSubmitting(true);
    try {
      const redeemed = await redeemVoucher(identifier);
      setMessage({type: 'success', text: `Voucher ${redeemed.voucherCode} for ${redeemed.whatsappNumber} redeemed successfully!`});
      setIdentifier('');
    } catch (error: any) {
      setMessage({type: 'error', text: error.message || 'An unexpected error occurred.'});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Redeem Digital Voucher</h2>
      <p className="text-gray-500 mb-6">Enter customer's voucher code or WhatsApp number to mark it as used.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Voucher Code / WhatsApp Number"
          id="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Enter code or phone number"
          required
          Icon={Search}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <><Loader2 className="animate-spin mr-2"/> Processing...</> : 'Redeem Voucher'}
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

    const [fullName, setFullName] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [voucherCode, setVoucherCode] = useState('');
    const [notes, setNotes] = useState('');
    
    // Default to cashier's outlet but allow changing it
    const [outlet, setOutlet] = useState<Outlet>(currentUser?.outlet || OUTLETS[0]);

    const resetForm = () => {
        setFullName('');
        setBirthYear('');
        setWhatsappNumber('');
        setVoucherCode('');
        setNotes('');
        setOutlet(currentUser?.outlet || OUTLETS[0]); // Reset to default
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (!fullName || !birthYear || !whatsappNumber || !voucherCode) {
            setMessage({ type: 'error', text: "Please fill all required fields." });
            return;
        }

        setIsSubmitting(true);
        try {
            const recorded = await recordPhysicalVoucher({ fullName, birthYear, whatsappNumber, voucherCode, outlet, notes });
            setMessage({ type: 'success', text: `Physical voucher ${recorded.voucherCode} recorded for ${recorded.fullName}!` });
            resetForm();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'An error occurred.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Input Physical Voucher Data</h2>
            <p className="text-gray-500 mb-6">Enter customer details and the code from the physical voucher.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Nama" id="phys-fullName" value={fullName} onChange={e => setFullName(e.target.value)} required />
                <Input label="Tahun Lahir" id="phys-birthYear" value={birthYear} onChange={e => setBirthYear(e.target.value)} type="number" required />
                <Input label="No. WhatsApp" id="phys-whatsapp" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} type="tel" required />
                <Input label="Kode Unik Voucher Fisik" id="phys-code" value={voucherCode} onChange={e => setVoucherCode(e.target.value)} required />
                <SearchableSelect
                  label="Outlet Klaim"
                  id="phys-outlet"
                  options={OUTLETS}
                  value={outlet}
                  onChange={(value) => setOutlet(value)}
                  placeholder="Cari atau pilih outlet..."
                />
                <div>
                    <label htmlFor="phys-notes" className="block text-sm font-medium text-gray-700 mb-1">Catatan (Opsional)</label>
                    <textarea id="phys-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900"
                        placeholder="e.g., Customer redeemed at wrong outlet."
                    ></textarea>
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? <><Loader2 className="animate-spin mr-2"/> Saving...</> : 'Save Record'}
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