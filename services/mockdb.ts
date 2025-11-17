import { User, Role, Voucher } from '../types';
import { OUTLETS } from '../constants';

export const MOCK_USERS = [
    { username: "adminpusat", password: "password123", role: Role.PUSAT },
    { username: "kasirjkt", password: "password123", role: Role.KASIR, outlet: OUTLETS[0] }, // Jakarta - Kelapa Gading
    { username: "kasirbdg", password: "password123", role: Role.KASIR, outlet: OUTLETS[10] }, // Bandung - Dago
    { username: "kasirbgr", password: "password123", role: Role.KASIR, outlet: OUTLETS[10] },
];

export const MOCK_VOUCHERS: Voucher[] = [
    {
      id: "1",
      fullName: "Budi Santoso",
      birthYear: "1990",
      whatsappNumber: "081234567890",
      outlet: OUTLETS[0], // Jakarta - Kelapa Gading
      voucherCode: "DMC-JKT-123456",
      claimDate: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
      isRedeemed: true,
      redeemedDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
      type: 'DIGITAL',
    },
    {
      id: "2",
      fullName: "Citra Lestari",
      birthYear: "1995",
      whatsappNumber: "081234567891",
      outlet: OUTLETS[10], // Bandung - Dago
      voucherCode: "DMC-BDG-654321",
      claimDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
      isRedeemed: false,
      type: 'DIGITAL',
    },
     {
      id: "3",
      fullName: "Agus Wijaya",
      birthYear: "2001",
      whatsappNumber: "081234567892",
      outlet: OUTLETS[20], // Surabaya - Tunjungan
      voucherCode: "DMC-SBY-987654",
      claimDate: new Date().toISOString(),
      isRedeemed: false,
      type: 'DIGITAL',
    },
    {
      id: "4",
      fullName: "Dewi Anggraini",
      birthYear: "1988",
      whatsappNumber: "087711112222",
      outlet: OUTLETS[30],
      voucherCode: "PHY-123-XYZ", // Example physical code
      claimDate: new Date().toISOString(),
      isRedeemed: true,
      redeemedDate: new Date().toISOString(),
      type: 'PHYSICAL',
      notes: "Customer redeemed at different branch.",
    }
];