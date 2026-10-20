# Audityzer QuickScan · GitHub Pages deployment

## Đã xác định lỗi từ GitHub Actions

Run `39439013758`, job `118683626328`, thất bại ngay tại checkout:

```
fatal: No url found for submodule path 'audityzer-core' in .gitmodules
The process '/usr/bin/git' failed with exit code 128
```

Workflow **Pages build and deployment** tự động của chế độ **Deploy from a branch** cố tải Git submodule trong repository, nhưng repo có gitlink thiếu khai báo hợp lệ trong `.gitmodules`. Đây là lỗi repository metadata; không phải lỗi HTML hay CSS.

## Giải pháp không làm hỏng repository hiện có

File mới: [`.github/workflows/quickscan-pages.yml`](../.github/workflows/quickscan-pages.yml).

1. Checkout `safe-improvements` với `submodules: false`.
2. Kiểm thử analyzer thuần Node, không cài 10.000 dependencies.
3. Chỉ đưa 4 file `index.html`, `app.js`, `engine.mjs`, `styles.css` vào thư mục `_site/` **và** `_site/scanner/`.
4. Tạo `.nojekyll`, tải artifact và triển khai với GitHub Pages Actions.

Không sao chép, build hoặc xuất bản các mã dự án nhạy cảm khác trong repo.

## BƯỚC CẦN THỰC HIỆN Ở GITHUB SETTINGS

Truy cập **Settings → Pages → Build and deployment → Source**:

- Chọn **GitHub Actions** (thay cho **Deploy from a branch**) rồi lưu.
- Qua tab **Actions**, chọn workflow **Audityzer QuickScan — GitHub Pages** và chạy **Run workflow** trên nhánh `safe-improvements`, hoặc đẩy commit vào thư mục scanner.
- Khi job `Publish Audityzer QuickScan` thành công, xem URL trả về trong phần Deploy.

**Không thể kích hoạt cài đặt Pages Source chỉ bằng việc commit workflow**; nếu chưa đổi, workflow cũ của GitHub có thể tiếp tục thất bại do submodule.

Dự kiến (nếu dùng hostname mặc định) hai đường dẫn cùng chạy:

- `https://base27-cvnss.github.io/Audityzer/`
- `https://base27-cvnss.github.io/Audityzer/scanner/`

Repository có file `CNAME` là `audityzer.com`. Không thay DNS hoặc thay đổi custom domain trong PR này. Nếu GitHub Pages vẫn cấu hình miền tùy chỉnh và DNS hợp lệ, URL xuất bản có thể khác hai URL dự kiến nêu trên; chỉ dựa vào URL do GitHub báo sau deploy.

## UI/UX mới

- Dark navy + jade accent, lấy cảm hứng từ trải nghiệm scanner đơn giản kiểu Honeypot.is (không sao chép nhận diện của họ).
- Biểu mẫu lớn giữa trang, hỗ trợ desktop / smartphone.
- Chọn 8 mạng EVM, dán `0x...` hoặc URL explorer, nhập ví dụ WETH.
- Cảnh báo đúng ngữ cảnh: có thể chỉ là dấu hiệu cần kiểm tra, không kết luận lừa đảo.
- Phân loại hàm và mức độ, vị trí file/dòng, đọc ABI, proxy, xuất JSON và chia sẻ link.
- Không yêu cầu kết nối ví; không yêu cầu ký hoặc cấp quyền giao dịch.

## Kiểm tra sau khi lên Pages

1. Tải `/` và `/scanner/`, kiểm tra CSS/JS không báo 404.
2. Chạy ví dụ WETH và xác minh trạng thái nguồn. Nếu Sourcify/Blockscout trả lỗi mạng/CORS, giao diện phải báo không đủ dữ liệu, tuyệt đối không báo 'an toàn'.
3. Nhập link BaseScan hợp lệ: chain phải tự chọn Base.
4. Nhập địa chỉ không hợp lệ: phải báo lỗi tại form.
5. Kiểm tra responsive ở điện thoại, lọc cảnh báo và xuất JSON.

## Tham khảo

- [GitHub Docs — Custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Docs — Configuring a publishing source for GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
