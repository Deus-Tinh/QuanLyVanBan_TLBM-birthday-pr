/**
 * File khóa ký (thiết kế MVP Nhóm 5): bản bọc private key Ed25519 (AES-GCM, khóa bọc dẫn xuất từ PIN 8 số + salt
 * qua Argon2id và k_srv) xuất ra file để người ký giữ; khi ký thì tải file lên trình duyệt và nhập PIN.
 *
 * - File chỉ đọc trong trình duyệt, không gửi lên máy chủ. Máy chủ chỉ giữ khóa công khai và k_srv.
 * - Thiếu PIN thì file không dùng được; thiếu k_srv (máy chủ chỉ trả sau khi xác minh PIN, có giới hạn số lần
 *   sai) thì không đoán PIN offline được.
 * - Đổi PIN xoay vòng k_srv nên file cũ không còn mở được: phải tải lại file sau khi đổi PIN.
 */
import type { BanBocKhoa } from './khoaKy';
import type { KhoaKy } from './types';

export const DINH_DANG_FILE_KHOA = 'tlbm-signing-key';
export const PHIEN_BAN_FILE_KHOA = 1;
export const DUOI_FILE_KHOA = '.tlbmkey';

interface FileKhoa {
  dinh_dang: typeof DINH_DANG_FILE_KHOA;
  phien_ban: number;
  ban_boc: Omit<BanBocKhoa, 'ma'>;
}

export function noiDungFileKhoa(ban: BanBocKhoa): string {
  const ban_boc: Omit<BanBocKhoa, 'ma'> = {
    userId: ban.userId, keyId: ban.keyId, maKhoa: ban.maKhoa, khoaCongKhai: ban.khoaCongKhai, nonce: ban.nonce,
    banBoc: ban.banBoc, thamSoKdf: ban.thamSoKdf, taoLuc: ban.taoLuc,
  };
  const file: FileKhoa = { dinh_dang: DINH_DANG_FILE_KHOA, phien_ban: PHIEN_BAN_FILE_KHOA, ban_boc };
  return JSON.stringify(file, null, 2);
}

export function tenFileKhoa(ban: Pick<BanBocKhoa, 'maKhoa'>): string {
  return `${ban.maKhoa}${DUOI_FILE_KHOA}`;
}

/** Tải file khóa về máy người dùng. */
export function taiXuongFileKhoa(ban: BanBocKhoa): void {
  const url = URL.createObjectURL(new Blob([noiDungFileKhoa(ban)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = tenFileKhoa(ban);
  a.click();
  URL.revokeObjectURL(url);
}

const CHUOI = ['maKhoa', 'khoaCongKhai', 'nonce', 'banBoc', 'taoLuc'] as const;

/** Đọc nội dung file khóa; sai định dạng ném Error('file_khoa_khong_hop_le'). */
export function docFileKhoa(noi_dung: string): BanBocKhoa {
  let file: FileKhoa;
  try {
    file = JSON.parse(noi_dung);
  } catch {
    throw new Error('file_khoa_khong_hop_le');
  }
  const b = file?.ban_boc;
  const tham_so = b?.thamSoKdf;
  const hop_le = file?.dinh_dang === DINH_DANG_FILE_KHOA && file.phien_ban === PHIEN_BAN_FILE_KHOA && b
    && Number.isInteger(b.userId) && Number.isInteger(b.keyId) && CHUOI.every((k) => typeof b[k] === 'string')
    && tham_so && typeof tham_so.salt === 'string' && [tham_so.m, tham_so.t, tham_so.p].every(Number.isInteger);
  if (!hop_le) throw new Error('file_khoa_khong_hop_le');
  return { ...b, ma: `${b.userId}:${b.keyId}` };
}

/** File khóa phải của đúng người dùng và đúng khóa đang hoạt động (cùng khóa công khai). */
export function kiemTraFileKhop(ban: BanBocKhoa, userId: number, khoa: KhoaKy): void {
  if (ban.userId !== userId || ban.keyId !== khoa.id || ban.khoaCongKhai !== khoa.khoa_cong_khai) {
    throw new Error('file_khoa_khong_khop');
  }
}

export async function docFileKhoaTuTep(tep: File): Promise<BanBocKhoa> {
  return docFileKhoa(await tep.text());
}
