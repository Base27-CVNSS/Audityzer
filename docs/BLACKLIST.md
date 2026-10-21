# Audityzer Blacklist (Community indicators)

**Trang:** `/Audityzer/blacklist/`. Thêm nút **Blacklist** sát nút **Quét hợp đồng** trong QuickScan.

## Nguồn, phép đếm
- MEW, MIT: https://github.com/MyEtherWallet/ethereum-lists/blob/master/src/addresses/addresses-darklist.json
- EtherScamDB, MIT: https://github.com/CryptoScamDB/EtherScamDB/blob/master/_data/scams.yaml
- Bản chụp dữ liệu: 2026-10-21; số bản ghi và số duy nhất được tính từ dữ liệu chuẩn hóa, không cộng dồn trùng lặp.
- Tệp đã chuẩn hóa: `public/blacklist/data.json`. MIT attribution: `public/blacklist/LICENSES.txt`.

## Sử dụng
- Nhập địa chỉ Ethereum 0x hoặc tên miền, hoặc nhập từ khóa; lọc theo loại đối tượng và nguồn.
- Nhấn **Quét hợp đồng** từ địa chỉ được báo cáo để phân tích tiếp bằng QuickScan.
- QuickScan tự đối chiếu chính xác địa chỉ sau khi quét, và lưu `report.blacklist` trong tệp JSON xuất ra.
- Giao diện hiển thị lỗi khi không tải được bộ dữ liệu; tuyệt đối không gọi một địa chỉ là an toàn chỉ vì không xuất hiện trong blacklist.
- Không tạo link trỏ tới website lừa đảo; chỉ dẫn về kho nguồn dữ liệu GitHub.

## Hạn chế
- Báo cáo cộng đồng có thể sai, cũ hoặc thiếu thông tin, không thay thế xác minh thủ công và kiểm toán.
- Nhiều bản ghi là tên miền và không có địa chỉ blockchain. Dữ liệu không gắn chain ID cho từng địa chỉ, vì thế tham chiếu được xem trong ngữ cảnh Ethereum, không tự động kết luận trên mọi chain EVM.
- Đồng bộ ảnh chụp mới bằng cách đối chiếu dữ liệu thô từ hai kho nguồn, tái chuẩn hóa, cập nhật data.json và kiểm tra test. Không có cập nhật real-time.
