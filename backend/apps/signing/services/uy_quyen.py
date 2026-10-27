"""
Ủy quyền ký khẩn cấp từng hồ sơ (plan mục 3.5 "Ủy quyền", 6.2 `uy_quyen`, 7.3).

- Người thực hiện có `delegate_trinhky` và là quản trị, lãnh đạo cơ quan (nhóm `BGD`) hoặc lãnh đạo đơn vị
  (nhóm `TP`) cùng đơn vị với người ký. Người ký không tự ủy quyền hồ sơ của mình. Hệ thống chưa có mã nhóm
  (chưa có app `authorization`) thì người có `delegate_trinhky` được coi là quản trị, như `to_chuc.la_quan_tri`.
- Chỉ ủy quyền dòng người ký đang `CHO_KY` của lượt trình hiện hành đang `CHO_KY` (cấp đang ký hoặc chưa mở).
- Người nhận: tài khoản đang hoạt động, có `sign_trinhky`, chưa có mặt trong cùng cấp. Danh sách "thẩm quyền
  tương đương" theo chức danh chưa có ở Nhóm 7 nên MVP chưa giới hạn thêm (plan mục 12).
- Dòng người ký đổi `nguoi_ky` sang người nhận, ghi `uy_quyen_tu`, `ly_do_uy_quyen`, `ngay_uy_quyen`; lượt trình,
  mã băm, vị trí ký và thời điểm mở giữ nguyên. DDL chưa có cột `hinh_thuc_ky` nên chưa ghi thể thức KT./TL./TUQ.
- Ghi nhật ký `UY_QUYEN_KY`, thông báo `UY_QUYEN` cho người nhận và người ủy quyền. Chống lặp bằng Idempotency-Key.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from .. import enums
from ..errors import ConflictError, SigningError
from ..models import SigningRequest, SigningRequestStepSigner
from ..permissions import KY_TRINH_KY, UY_QUYEN_TRINH_KY, co_quyen
from ..tich_hop import to_chuc
from . import thong_bao
from .audit import ghi_nhat_ky
from .trinh_ky import _thao_tac_da_xu_ly, luot_hien_hanh

HANH_DONG = "UY_QUYEN_KY"
MA_NHOM_LANH_DAO_CO_QUAN = "BGD"


def co_quyen_uy_quyen(nguoi, nguoi_ky):
    """`nguoi` được ủy quyền thay cho `nguoi_ky` (cấp trên trực tiếp hoặc quản trị)."""
    if not co_quyen(nguoi, UY_QUYEN_TRINH_KY) or nguoi.pk == nguoi_ky.pk:
        return False
    if nguoi.is_superuser:
        return True
    ma_nhom = to_chuc.ma_nhom_cua(nguoi)
    if ma_nhom is None or ma_nhom & {to_chuc.MA_NHOM_QUAN_TRI, MA_NHOM_LANH_DAO_CO_QUAN}:
        return True
    don_vi = to_chuc.don_vi_cua(nguoi)
    return (to_chuc.MA_NHOM_LANH_DAO_DON_VI in ma_nhom and don_vi is not None
            and don_vi == to_chuc.don_vi_cua(nguoi_ky))


def _loi(code, detail, status_code=status.HTTP_400_BAD_REQUEST, **fields):
    return SigningError(code=code, detail=detail, status_code=status_code, fields=fields or None)


@transaction.atomic
def uy_quyen(yeu_cau, nguoi, *, dong_nguoi_ky, nguoi_nhan, ly_do, khoa_chong_trung, dia_chi_ip=None):
    if not ly_do.strip():
        raise _loi("thieu_ly_do", "Ủy quyền phải nêu lý do.", ly_do_uy_quyen=["Bắt buộc."])
    if _thao_tac_da_xu_ly(HANH_DONG, khoa_chong_trung, yeu_cau):
        return SigningRequest.objects.get(pk=yeu_cau.pk)
    yeu_cau = SigningRequest.objects.select_for_update().get(pk=yeu_cau.pk)
    if _thao_tac_da_xu_ly(HANH_DONG, khoa_chong_trung, yeu_cau):
        return yeu_cau
    luot = luot_hien_hanh(yeu_cau)
    if yeu_cau.trang_thai != enums.TrangThaiYeuCau.CHO_KY or luot is None \
            or luot.trang_thai != enums.TrangThaiLuotTrinh.CHO_KY:
        raise ConflictError(code="luot_trinh_khong_cho_ky", detail="Chỉ ủy quyền khi hồ sơ đang chờ ký.")
    dong = (SigningRequestStepSigner.objects.select_for_update().select_related("buoc_ky", "nguoi_ky")
            .filter(pk=dong_nguoi_ky, buoc_ky__luot_trinh=luot).first())
    if dong is None:
        raise _loi("khong_tim_thay_nguoi_ky", "Không có người ký này trên lượt trình hiện hành.",
                   status.HTTP_404_NOT_FOUND, dong_nguoi_ky=["Không hợp lệ."])
    if dong.trang_thai != enums.TrangThaiNguoiKy.CHO_KY or dong.buoc_ky.trang_thai not in (
            enums.TrangThaiCapKy.CHUA_MO, enums.TrangThaiCapKy.DANG_KY):
        raise ConflictError(code="nguoi_ky_khong_cho_ky", detail="Chỉ ủy quyền người ký đang chờ ký.")
    if not co_quyen_uy_quyen(nguoi, dong.nguoi_ky):
        raise _loi("khong_co_quyen", "Chỉ cấp trên trực tiếp của người ký hoặc quản trị được ủy quyền.",
                   status.HTTP_403_FORBIDDEN)
    nhan = get_user_model().objects.filter(pk=nguoi_nhan, is_active=True).first()
    if nhan is None or not co_quyen(nhan, KY_TRINH_KY):
        raise _loi("nguoi_nhan_khong_hop_le", "Người nhận ủy quyền không hoạt động hoặc không có quyền ký.",
                   nguoi_nhan=["Không hợp lệ."])
    if dong.buoc_ky.nguoi_ky_set.filter(nguoi_ky=nhan).exists():
        raise ConflictError(code="nguoi_nhan_da_co_trong_cap", detail="Người nhận đã có mặt trong cùng cấp ký.")

    nguoi_cu = dong.nguoi_ky
    dong.uy_quyen_tu = dong.uy_quyen_tu or nguoi_cu  # ủy quyền tiếp vẫn giữ người được giao ban đầu
    dong.nguoi_ky = nhan
    dong.ten_nguoi_ky = to_chuc.ten_hien_thi(nhan) or nhan.get_username()
    dong.ten_chuc_vu = to_chuc.ten_chuc_vu(nhan) or None
    dong.chuc_vu_id = getattr(nhan, "chuc_vu_id", None)
    dong.ly_do_uy_quyen = ly_do
    dong.ngay_uy_quyen = timezone.now()
    dong.save(update_fields=["uy_quyen_tu", "nguoi_ky", "ten_nguoi_ky", "ten_chuc_vu", "chuc_vu_id",
                             "ly_do_uy_quyen", "ngay_uy_quyen"])
    ghi_nhat_ky(nguoi, "signing_request_step_signer", dong.pk, HANH_DONG, trinh_ky=yeu_cau, luot_trinh=luot,
                buoc_ky=dong, chi_tiet=f"{to_chuc.ten_hien_thi(nguoi_cu)} → {dong.ten_nguoi_ky}: {ly_do}",
                dia_chi_ip=dia_chi_ip,
                du_lieu_kem_theo={"khoa_chong_trung": khoa_chong_trung, "tu": nguoi_cu.pk, "den": nhan.pk})
    thong_bao.uy_quyen(dong, nguoi_cu, nguoi)
    return yeu_cau
