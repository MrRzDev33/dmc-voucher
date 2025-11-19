
import React, { useState, useMemo } from 'react';
import { useVouchers } from '../../context/VoucherContext';
import { Outlet, Voucher, VoucherType } from '../../types';
import { OUTLETS } from '../../constants';
import { exportToCSV, formatDate } from '../../services/util';
import StatCard from '../../components/StatCard';
import Button from '../../components/Button';
import SearchableSelect from '../../components/SearchableSelect';
import UploadCodes from '../../components/UploadCodes';
import TabButton from '../../components/TabButton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Users, TicketCheck, CalendarClock, Ticket, Smartphone, Warehouse } from '../../components/icons/Icons';

const VOUCHERS_PER_PAGE = 10;

const Dashboard: React.FC = () => {
  const { vouchers, stats, loading, loadCodes, resetData } = useVouchers();
  const [filterOutlet, setFilterOutlet] = useState<Outlet | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<VoucherType>('DIGITAL');

  const filteredVouchers = useMemo(() => {
    return vouchers
      .filter(v => v.type === activeTab)
      .filter(v => filterOutlet === 'all' || v.outlet === filterOutlet)
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

  if (loading) return <div className="text-center p-10">Memuat data dasbor...</div>;

  return (
    <div className="space-y-8">
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
                <StatCard title="Klaim Hari Ini" value={stats.claimsToday} icon={<CalendarClock />} />
                <StatCard title="Estimasi Reimbursement" value={`Rp ${(vouchers.filter(v=>v.type==='DIGITAL' && v.isRedeemed).length * 10000).toLocaleString('id-ID')}`} icon={<span className="font-bold">Rp</span>} />
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
                <th scope="col" className="px-6 py-3">Nama / Info</th>
                <th scope="col" className="px-6 py-3">No. WhatsApp</th>
                {activeTab === 'PHYSICAL' && <th scope="col" className="px-6 py-3">Gender</th>}
                <th scope="col" className="px-6 py-3">Kode Voucher</th>
                <th scope="col" className="px-6 py-3">Outlet</th>
                <th scope="col" className="px-6 py-3">{activeTab === 'DIGITAL' ? 'Tgl Klaim' : 'Tgl Penukaran'}</th>
                <th scope="col" className="px-6 py-3">Status</th>
                {activeTab === 'PHYSICAL' && <th scope="col" className="px-6 py-3">Catatan</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedVouchers.map((v: Voucher) => (
                <tr key={v.id} className="bg-white border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{v.fullName || '-'}</td>
                  <td className="px-6 py-4">{v.whatsappNumber}</td>
                  {activeTab === 'PHYSICAL' && <td className="px-6 py-4">{v.gender || '-'}</td>}
                  <td className="px-6 py-4 font-mono">{v.voucherCode}</td>
                  <td className="px-6 py-4">{v.outlet}</td>
                  <td className="px-6 py-4">{formatDate(v.claimDate)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${v.isRedeemed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {v.isRedeemed ? 'Sudah Ditukar' : 'Belum Ditukar'}
                    </span>
                  </td>
                  {activeTab === 'PHYSICAL' && <td className="px-6 py-4 text-xs italic">{v.notes}</td>}
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