export type Outlet = string;

export type VoucherType = 'DIGITAL' | 'PHYSICAL';

export interface Voucher {
  id: string;
  fullName: string;
  birthYear: string;
  whatsappNumber: string;
  outlet: Outlet;
  voucherCode: string;
  claimDate: string; // ISO string
  isRedeemed: boolean;
  redeemedDate?: string; // ISO string
  type: VoucherType;
  notes?: string;
}

export enum Role {
    KASIR = "KASIR",
    PUSAT = "PUSAT"
}

export interface User {
    username: string;
    role: Role;
    outlet?: Outlet; // For kasir role
}

export interface Stats {
    totalClaims: number; // Combined
    totalRedeemed: number; // Combined
    claimsToday: number;
    claimsByOutlet: { [key: string]: number };
    claimsPerDay: { date: string; count: number }[];
    
    // New detailed stats
    totalDigitalVouchers: number;
    claimedDigitalVouchers: number;
    totalPhysicalVouchers: number;
    redeemedPhysicalVouchers: number;
}