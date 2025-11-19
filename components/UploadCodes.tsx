
import React, { useState } from 'react';
import { VoucherType } from '../types';
import Button from './Button';
import { Loader2, Download } from './icons/Icons';

interface UploadCodesProps {
  voucherType: VoucherType;
  onUpload: (codes: string[], type: VoucherType) => void;
}

const UploadCodes: React.FC<UploadCodesProps> = ({ voucherType, onUpload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = () => {
    if (!file) {
      setError('Silakan pilih file terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        // Split by new line and filter out empty lines
        const codes = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (codes.length === 0) {
            throw new Error('File kosong atau tidak berisi kode yang valid.');
        }
        onUpload(codes, voucherType);
        setFile(null); // Reset file input
      } catch (err: any) {
          setError(err.message || 'Gagal membaca file.');
      } finally {
          setIsLoading(false);
      }
    };
    reader.onerror = () => {
        setError('Gagal membaca file.');
        setIsLoading(false);
    }
    reader.readAsText(file);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <h3 className="text-lg font-semibold mb-2">Unggah Kode Voucher {voucherType === 'DIGITAL' ? 'Digital' : 'Fisik'}</h3>
      <p className="text-sm text-gray-600 mb-4">
        Unggah file <strong>.txt</strong> dengan satu kode unik per baris. Ini akan menimpa kode yang ada untuk tipe voucher ini.
      </p>
      <div className="flex items-center gap-4">
        <input
          type="file"
          id={`file-upload-${voucherType}`}
          accept=".txt"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-orange-50 file:text-primary
            hover:file:bg-orange-100"
        />
        <Button onClick={handleUpload} disabled={!file || isLoading}>
          {isLoading ? <Loader2 className="animate-spin" /> : 'Unggah'}
        </Button>
      </div>
       {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default UploadCodes;