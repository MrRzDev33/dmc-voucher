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
import { Download, Users, TicketCheck, CalendarClock, Ticket, Smartphone, Warehouse, SlidersHorizontal, Save, Loader2, Search } from '../../components/icons/Icons';

const VOUCHERS_PER_PAGE = 10;

const Dashboard: React.FC = () => {
  const { vouchers, stats, loading, loadCodes, resetData, isClaimEnabled, dailyLimit, toggleClaimStatus, updateDailyLimit } = useVouchers();
  const [filterOutlet, setFilterOutlet] = useState<Outlet | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<VoucherType>('DIGITAL');
  const [isToggling, setIsToggling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // State untuk input limit harian
  const [limitInput, setLimitInput] = useState<string>('1000');
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  useEffect(() => {
      setLimitInput(String(dailyLimit));
  }, [dailyLimit]);

  // HELPER: Normalisasi teks untuk perbandingan yang akurat
  // Mengubah ke huruf kecil, menghapus spasi di awal/akhir, dan mengubah spasi ganda menjadi spasi tunggal
  const normalizeText = (text: string | undefined) => {
      if (!text) return '';
      return text.toLowerCase().replace(/\s+/g, ' ').trim();
  };

  // 1. Filter Vouchers berdasarkan Tab dan Outlet dengan Normalisasi
  const filteredVouchers = useMemo(() => {
    return vouchers
      .filter(v => v.type === activeTab)
      .filter(v => {
          if (filterOutlet === 'all') return true;
          
          const vOutlet = normalizeText(v.outlet);
          const vRedeemed = normalizeText(v.redeemedOutlet);
          const target = normalizeText(filterOutlet);
          
          // Gunakan includes untuk fleksibilitas jika nama di DB tidak 100% sama
          return vOutlet === target || vRedeemed === target || vOutlet.includes(target);
      })
      .sort((a, b) => new Date(b.claimDate).getTime() - new Date(a.claimDate).getTime());
  }, [vouchers, filterOutlet, activeTab]);

  // 2. Hitung Data Grafik
  const chartData = useMemo(() => {
      const statsMap = new Map<string, number>();

      filteredVouchers.forEach(v => {
          const dateStr = v.claimDate.split('T')[0];
          statsMap.set(dateStr, (statsMap.get(dateStr) || 0) + 1);
      });

      return Array.from(statsMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(-30);
  }, [filteredVouchers]);

  // PAGINATION LOGIC
  const totalPages = Math.max(1, Math.ceil(filteredVouchers.length / VOUCHERS_PER_PAGE));

  const paginatedVouchers = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * VOUCHERS_PER_PAGE;
    return filteredVouchers.slice(startIndex, startIndex + VOUCHERS_PER_PAGE);
  }, [filteredVouchers, currentPage, totalPages]);

  useEffect(() => {
      setCurrentPage(1);
  }, [filterOutlet, activeTab]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
        const dataToExport = filteredVouchers;
        if (dataToExport.length === 0) {
            alert("Tidak ada data untuk diekspor. Coba ubah filter outlet ke 'Semua Outlet' jika data tidak muncul.");
            return;
        }
        exportToCSV(dataToExport, `${activeTab.toLowerCase()}-vouchers-${filterOutlet === 'all' ? 'AllOutlets' : filterOutlet.substring(0, 20)}-${new Date().toISOString().split('T')[0]}`);
    } catch (e) {
        console.error("Export failed", e);
        alert("Gagal melakukan ekspor data.");
    } finally {
        setIsExporting(false);
    }
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

  const paginationText = useMemo(() => {
      if (filteredVouchers.length === 0) return "Menampilkan 0 data";
      const start = (currentPage - 1) * VOUCHERS_PER_PAGE + 1;
      const end = Math.min(currentPage * VOUCHERS_PER_PAGE, filteredVouchers.length);
      return `Menampilkan ${start} sampai ${end} dari ${filteredVouchers.length} data`;
  }, [filteredVouchers.length, currentPage]);


  if (loading) return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-gray-500">Memuat semua data voucher dari server...</p>
      </div>
  );

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
                    <span className="text-xs text-gray-500">Batas Harian (Saat ini: {stats.todayClaimedDigital})</span>
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
                
                {/* Menggunakan stats.todayClaimedDigital (Murni Digital) */}
                <StatCard title="Klaim Hari Ini / Batas" value={`${stats.todayClaimedDigital} / ${dailyLimit}`} icon={<CalendarClock />} />
                
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
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-4">
                    {activeTab === 'DIGITAL' ? 'Distribusi Klaim per Outlet' : 'Distribusi Fisik per Outlet'}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    {/* Menggunakan normalizeText juga di sini untuk grouping yang akurat */}
                    <BarChart data={OUTLETS.map(o => ({
                        name: o, 
                        claims: filteredVouchers.filter(v => normalizeText(v.outlet) === normalizeText(o) || normalizeText(v.outlet).includes(normalizeText(o))).length 
                    })).filter(item => item.claims > 0).sort((a,b) => b.claims - a.claims)}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={false} /><YAxis /><Tooltip /><Legend />
                        <Bar dataKey="claims" name={activeTab === 'DIGITAL' ? "Jumlah Klaim" : "Jumlah Input"} fill={activeTab === 'DIGITAL' ? "#ea580c" : "#0284c7"} />
                    </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-400 mt-2 text-center">*Menampilkan semua outlet yang memiliki aktivitas (Geser kursor untuk melihat nama outlet)</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-4">
                    {activeTab === 'DIGITAL' ? 'Tren Klaim Digital Harian' : 'Tren Input Fisik Harian'}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="date" 
                            tickFormatter={(tick) => new Date(tick).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} 
                            fontSize={12}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip labelFormatter={(label) => formatDate(label)} />
                        <Legend />
                        <Bar dataKey="count" name={activeTab === 'DIGITAL' ? "Klaim" : "Input"} fill={activeTab === 'DIGITAL' ? "#f97316" : "#0ea5e9"} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

      {/* Vouchers Table */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <div className="flex flex-col">
              <h2 className="text-xl font-bold flex items-center gap-2">
                  Data Voucher {activeTab === 'DIGITAL' ? 'Digital' : 'Fisik'}
              </h2>
              <span className="text-sm text-gray-500">
                  Total Data {activeTab === 'DIGITAL' ? 'Digital' : 'Fisik'} di Server: 
                  <span className="font-bold text-gray-800 ml-1">
                      {activeTab === 'DIGITAL' ? vouchers.filter(v => v.type === 'DIGITAL').length : vouchers.filter(v => v.type === 'PHYSICAL').length}
                  </span>
                  <span className="mx-2">|</span>
                  Tertampil: <span className="font-bold text-primary">{filteredVouchers.length}</span>
              </span>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
             <div className="w-full sm:w-56">
                <SearchableSelect
                    id="outlet-filter" label="" options={['Semua Outlet', ...OUTLETS]} value={filterOutlet === 'all' ? 'Semua Outlet' : filterOutlet}
                    onChange={(value) => setFilterOutlet(value === 'Semua Outlet' ? 'all' : value as Outlet)}
                    placeholder="Filter berdasarkan outlet"
                />
             </div>
            <Button onClick={handleExport} variant="secondary" disabled={isExporting}>
              {isExporting ? <Loader2 className="animate-spin mr-2" /> : <Download size={18} className="mr-2" />}
              {isExporting ? 'Mengekspor...' : 'Ekspor CSV'}
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
              {filteredVouchers.length === 0 ? (
                  <tr>
                      <td colSpan={activeTab === 'DIGITAL' ? 9 : 6} className="px-6 py-8 text-center text-gray-500 bg-gray-50 rounded-lg border-b border-gray-200">
                          <div className="flex flex-col items-center justify-center">
                              <Search size={32} className="text-gray-300 mb-2" />
                              <p className="font-medium">Tidak ada data ditemukan untuk outlet ini.</p>
                              <p className="text-xs text-gray-400 mt-1">Coba pilih "Semua Outlet" untuk memastikan data ada di server.</p>
                          </div>
                      </td>
                  </tr>
              ) : (
                  paginatedVouchers.map((v: Voucher) => (
                    <tr key={v.id} className="bg-white border-b border-gray-200 hover:bg-gray-50">
                      {activeTab === 'DIGITAL' && <td className="px-6 py-4 font-medium text-gray-800">{v.fullName || '-'}</td>}
                      <td className="px-6 py-4">{v.whatsappNumber}</td>
                      {activeTab === 'PHYSICAL' && <td className="px-6 py-4">{v.gender || '-'}</td>}
                      
                       {activeTab === 'DIGITAL' && <td className="px-6 py-4">{v.birthYear || '-'}</td>}
    
                      <td className="px-6 py-4 font-mono">{v.voucherCode}</td>
                      
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
                  ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-gray-700">
                {paginationText}
            </span>
            <div className="flex gap-2">
                <Button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1 || filteredVouchers.length === 0} 
                    size="sm"
                >
                    Sebelumnya
                </Button>
                <Button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages || filteredVouchers.length === 0} 
                    size="sm"
                >
                    Berikutnya
                </Button>
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
