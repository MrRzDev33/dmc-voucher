
import React, { useState, useMemo, useEffect } from 'react';
import { useVouchers } from '../../context/VoucherContext';
import { Outlet, Voucher, VoucherType } from '../../types';
import { OUTLETS } from '../../constants';
import { exportToCSV, formatDate, formatCurrency } from '../../services/util';
import StatCard from '../../components/StatCard';
import Button from '../../components/Button';
import SearchableSelect from '../../components/SearchableSelect';
import UploadCodes from '../../components/UploadCodes';
import TabButton from '../../components/TabButton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Users, TicketCheck, CalendarClock, Ticket, Smartphone, Warehouse, SlidersHorizontal, Save } from '../../components/icons/Icons';

const VOUCHERS_PER_PAGE = 10;

const Dashboard: React.FC = () => {
  const { vouchers, stats, loading, loadCodes, resetData, isClaimEnabled, dailyLimit, toggleClaimStatus, updateDailyLimit } = useVouchers();
  const [filterOutlet, setFilterOutlet] = useState<Outlet | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<VoucherType>('DIGITAL');
  const [isToggling, setIsToggling] = useState(false);
  
  // State untuk input limit harian
  const [limitInput, setLimitInput] = useState<string>('1000');
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  useEffect(() => {
      setLimitInput(String(dailyLimit));
  }, [dailyLimit]);

  const filteredVouchers = useMemo(() => {
    return vouchers
      .filter(v => v.type === activeTab)
      .filter(v => filterOutlet === 'all' || v.outlet === filterOutlet || (v.redeemedOutlet === filterOutlet))
      .sort((a, b) => new Date(b.claimDate).getTime() - new Date(a.claimDate).getTime());
  }, [vouchers, filterOutlet, activeTab]);

  const paginatedVouchers = useMemo(() => {
    const startIndex = (currentPage - 1) * VOUCHERS_PER_PAGE;
    return filteredVouchers.slice(startIndex, startIndex + VOUCHERS_PER_PAGE);
  }, [filteredVouchers, currentPage]);

  const totalPages = Math.ceil(filteredVouchers.length / VOUCHERS_PER_PAGE);

  const handleExport = () => {
    exportToCSV(filteredVouchers, `${activeTab.toLowerCase()}-vouchers-${filterOutlet}-${new Date().toISOString().split('T')[0]}`);
  };

  const handleToggleStatus = async () => {
      setIsToggling(true);
      await toggleClaimStatus(!isClaimEnabled);
      setIsToggling(false);
  }

  const handleUpdateLimit = async () => {
      const val = parseInt(limitInput);
      if (isNaN(val) || val < 0) {
          alert("Masukkan angka yang valid untuk batas harian.");
          return;
      }
      setIsUpdatingLimit(true);
      await updateDailyLimit(val);
      setIsUpdatingLimit(false);
  }

  if (loading) return <div className="text-center p-10">Memuat data dasbor...</div>;

  return (
    <div className="space-y-8">
      {/* Control Panel Header */}
      <div className="bg-white p-6 rounded-xl shadow flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 min-w-[150px]">
            <SlidersHorizontal className="text-gray-500" />
            Pengaturan
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-6 w-full lg:w-auto">
            {/* Setting: Status ON/OFF */}
            <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 w-full sm:w-auto">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700">Status Klaim</span>
                    <span className={`text-xs font-bold ${isClaimEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                        {isClaimEnabled ? 'SEDANG DIBUKA' : 'DITUTUP'}
                    </span>
                </div>
                <button
                    onClick={handleToggleStatus}
                    disabled={isToggling}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                        isClaimEnabled ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                >
                    <span className={`${isClaimEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                </button>
            </div>

            {/* Setting: Limit Harian */}
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 w-full sm:w-auto">
                 <div className="flex flex-col flex-grow">
                    <span className="text-xs text-gray-500">Batas Harian (Saat ini: {stats.claimsToday})</span>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            value={limitInput}
                            onChange={(e) => setLimitInput(e.target.value)}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-primary focus:border-primary"
                        />
                        <span className="text-sm text-gray-600"> / hari</span>
                    </div>
                </div>
                <Button onClick={handleUpdateLimit} disabled={isUpdatingLimit} size="sm">
                    {isUpdatingLimit ? '...' : <Save size={16} />}
                </Button>
            </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
          <TabButton onClick={() => setActiveTab('DIGITAL')} isActive={activeTab === 'DIGITAL'} icon={<Smartphone />}>
            Voucher Digital
          </TabButton>
          <TabButton onClick={() => setActiveTab('PHYSICAL')} isActive={activeTab === 'PHYSICAL'} icon={<Ticket />}>
            Voucher Fisik
          </TabButton>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {activeTab === 'DIGITAL' ? (
            <>
                <StatCard title="Voucher Digital Diklaim" value={`${stats.claimedDigitalVouchers} / ${stats.totalDigitalVouchers}`} icon={<Users />} />
                <StatCard title="Sudah Ditukar" value={vouchers.filter(v => v.type === 'DIGITAL' && v.isRedeemed).length} icon={<TicketCheck />} />
                <StatCard title="Klaim Hari Ini / Batas" value={`${stats.claimsToday} / ${dailyLimit}`} icon={<CalendarClock />} />
                <StatCard title="Estimasi Reimbursement" value={`Rp ${(vouchers.filter(v=>v.type==='DIGITAL' && v.isRedeemed).reduce((sum, v) => sum + (v.discountAmount || 10000), 0)).toLocaleString('id-ID')}`} icon={<span className="font-bold">Rp</span>} />
            </>
        ) : (
             <>
                <StatCard title="Voucher Fisik Terpakai" value={`${stats.redeemedPhysicalVouchers} / ${stats.totalPhysicalVouchers}`} icon={<Warehouse />} />
                <StatCard title="Total Penukaran" value={stats.redeemedPhysicalVouchers} icon={<TicketCheck />} />
                 <StatCard title="Terpakai Hari Ini" value={vouchers.filter(v => v.type === 'PHYSICAL' && v.claimDate.startsWith(new Date().toISOString().split('T')[0])).length} icon={<CalendarClock />} />
                <StatCard title="Estimasi Reimbursement" value={`Rp ${(stats.redeemedPhysicalVouchers * 10000).toLocaleString('id-ID')}`} icon={<span className="font-bold">Rp</span>} />
            </>
        )}
      </div>

      {/* Upload Section */}
      <UploadCodes voucherType={activeTab} onUpload={loadCodes} />
      
      {/* Charts */}
      {activeTab === 'DIGITAL' && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Klaim per Outlet</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={OUTLETS.map(o => ({name: o, claims: stats.claimsByOutlet?.[o] || 0}))}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={false} /><YAxis /><Tooltip /><Legend /><Bar dataKey="claims" name="Jumlah Klaim" fill="#ea580c" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Tren Klaim Harian</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.claimsPerDay.slice(-30)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(tick) => new Date(tick).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} />
                        <YAxis /><Tooltip /><Legend /><Bar dataKey="count" name="Klaim" fill="#f97316" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      )}

      {/* Vouchers Table */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <h2 className="text-xl font-bold">Data Voucher {activeTab === 'DIGITAL' ? 'Digital' : 'Fisik'}</h2>
          <div className="flex items-center gap-4 w-full sm:w-auto">
             <div className="w-full sm:w-56">
                <SearchableSelect
                    id="outlet-filter" label="" options={['Semua Outlet', ...OUTLETS]} value={filterOutlet === 'all' ? 'Semua Outlet' : filterOutlet}
                    onChange={(value) => { setFilterOutlet(value === 'Semua Outlet' ? 'all' : value as Outlet); setCurrentPage(1); }}
                    placeholder="Filter berdasarkan outlet"
                />
             </div>
            <Button onClick={handleExport} variant="secondary">
              <Download size={18} className="mr-2" />
              Ekspor CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                {activeTab === 'DIGITAL' && <th scope="col" className="px-6 py-3">Nama / Info</th>}
                <th scope="col" className="px-6 py-3">No. WhatsApp</th>
                {activeTab === 'PHYSICAL' && <th scope="col" className="px-6 py-3">Gender</th>}
                
                {activeTab === 'DIGITAL' && <th scope="col" className="px-6 py-3">Tahun Lahir</th>}
                
                <th scope="col" className="px-6 py-3">Kode Voucher</th>
                
                {/* Kolom Nominal Potongan */}
                {activeTab === 'DIGITAL' && <th scope="col" className="px-6 py-3">Nominal</th>}
                
                {/* Conditional Column Headers for Outlet */}
                {activeTab === 'DIGITAL' ? (
                  <>
                    <th scope="col" className="px-6 py-3">Pengambilan Voucher</th>
                    <th scope="col" className="px-6 py-3">Penukaran Voucher</th>
                  </>
                ) : (
                   <th scope="col" className="px-6 py-3">Outlet</th>
                )}
                
                <th scope="col" className="px-6 py-3">{activeTab === 'DIGITAL' ? 'Tgl Klaim' : 'Tgl Penukaran'}</th>
                <th scope="col" className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVouchers.map((v: Voucher) => (
                <tr key={v.id} className="bg-white border-b border-gray-200 hover:bg-gray-50">
                  {activeTab === 'DIGITAL' && <td className="px-6 py-4 font-medium text-gray-800">{v.fullName || '-'}</td>}
                  <td className="px-6 py-4">{v.whatsappNumber}</td>
                  {activeTab === 'PHYSICAL' && <td className="px-6 py-4">{v.gender || '-'}</td>}
                  
                   {activeTab === 'DIGITAL' && <td className="px-6 py-4">{v.birthYear || '-'}</td>}

                  <td className="px-6 py-4 font-mono">{v.voucherCode}</td>
                  
                  {/* Isi Kolom Nominal */}
                  {activeTab === 'DIGITAL' && (
                    <td className="px-6 py-4 font-semibold text-primary">
                        {formatCurrency(v.discountAmount || 10000)}
                    </td>
                  )}
                  
                  {activeTab === 'DIGITAL' ? (
                    <>
                      <td className="px-6 py-4">{v.outlet}</td>
                      <td className="px-6 py-4 text-gray-600">
                          {v.redeemedOutlet ? (
                              v.redeemedOutlet === v.outlet ? v.redeemedOutlet : <span className="text-orange-600 font-medium" title="Berbeda dengan rencana pengambilan">{v.redeemedOutlet}</span>
                          ) : '-'}
                      </td>
                    </>
                  ) : (
                    <td className="px-6 py-4">{v.outlet}</td>
                  )}

                  <td className="px-6 py-4">{formatDate(v.claimDate)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${v.isRedeemed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {v.isRedeemed ? 'Sudah Ditukar' : 'Belum Ditukar'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-gray-700">
                Menampilkan {Math.min((currentPage - 1) * VOUCHERS_PER_PAGE + 1, filteredVouchers.length)} sampai {Math.min(currentPage * VOUCHERS_PER_PAGE, filteredVouchers.length)} dari {filteredVouchers.length} data
            </span>
            <div className="flex gap-2">
                <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} size="sm">Sebelumnya</Button>
                <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} size="sm">Berikutnya</Button>
            </div>
        </div>

      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 p-6 rounded-xl shadow-lg border border-red-200 mt-8">
        <h3 className="text-lg font-semibold text-red-800">Zona Bahaya</h3>
        <p className="text-sm text-red-600 mt-1 mb-4">
          Tindakan ini tidak dapat dibatalkan. Ini akan menghapus secara permanen semua voucher yang diklaim, voucher yang ditukarkan, dan kode yang diunggah. Dasbor akan diatur ulang ke nol.
        </p>
        <Button 
          onClick={resetData} 
          variant="primary"
          className="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        >
          Reset Semua Data Aplikasi
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;
