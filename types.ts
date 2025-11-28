
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

export interface UseVoucherStoreReturn {
  vouchers: Voucher[];
  loading: boolean;
  error: string | null;
  stats: Stats;
  isClaimEnabled: boolean; // Status Global ON/OFF
  toggleClaimStatus: (status: boolean) => Promise<void>; // Fungsi ubah status
  claimVoucher: (data: Omit<Voucher, 'id' | 'voucherCode' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet'>) => Promise<Voucher>;
  redeemVoucher: (voucherIdentifier: string, redeemedOutlet: Outlet) => Promise<Voucher>;
  recordPhysicalVoucher: (data: Omit<Voucher, 'id' | 'claimDate' | 'isRedeemed' | 'type' | 'redeemedDate' | 'redeemedOutlet'>) => Promise<Voucher>;
  loadCodes: (codes: string[], type: VoucherType) => void;
  getVouchers: () => Voucher[];
  resetData: () => void;
}
