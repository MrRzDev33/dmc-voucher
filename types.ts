
export type Outlet = string;

export type VoucherType = 'DIGITAL' | 'PHYSICAL';

export interface Voucher {
  id: string;
  fullName?: string; // Disimpan sebagai full_name di DB
  birthYear?: string; // Disimpan sebagai birth_year di DB
  gender?: 'Pria' | 'Wanita';
  whatsappNumber: string; // whatsapp_number
  outlet: Outlet;
  voucherCode: string; // voucher_code
  claimDate: string; // claim_date
  isRedeemed: boolean; // is_redeemed
  redeemedDate?: string; // redeemed_date
  redeemedOutlet?: Outlet; // redeemed_outlet
  type: VoucherType;
  notes?: string;
}

export enum Role {
    KASIR = "KASIR",
    PUSAT = "PUSAT"
}

export interface User {
    id?: string;
    username: string;
    role: Role;
    outlet?: Outlet; // Untuk role kasir
}

export interface Stats {
    totalClaims: number;
    totalRedeemed: number;
    claimsToday: number;
    claimsByOutlet: { [key: string]: number };
    claimsPerDay: { date: string; count: number }[];
    
    totalDigitalVouchers: number;
    claimedDigitalVouchers: number;
    totalPhysicalVouchers: number;
    redeemedPhysicalVouchers: number;
}
