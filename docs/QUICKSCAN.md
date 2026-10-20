# Audityzer QuickScan — contract address → risk triage

## Truy cập

- **Vite/Netlify/Express:** /scanner/ (bộ mã nằm ở `public/scanner/`).
- **GitHub Pages nếu xuất bản từ repository root:** /Audityzer/scanner/ (trang chuyển hướng tới /Audityzer/public/scanner/).
- **Local:** `npm run dev` và mở `http://localhost:5000/scanner/` nếu dùng Vite; hoặc serve thư mục public bằng web server.
- Liên kết từ trang chính trong `public/index.html`.

## Cách sử dụng

1. Dán địa chỉ EVM `0x…` (chọn đúng chain) **hoặc** link hợp đồng trên Etherscan, BscScan, PolygonScan, Arbiscan, Optimistic Etherscan, BaseScan, GnosisScan, SnowTrace hoặc Blockscout được cho phép.
2. Nhấn **QUÉT RỦI RO**. UI chỉ đọc các API công khai, không cần ví, API key hoặc giao dịch.
3. Xem trạng thái có mã nguồn đã xác minh, cảnh báo các hàm/code pattern, file, dòng, proxy và phạm vi quét.
4. Xuất JSON cho lần quét cụ thể hoặc sao chép liên kết sâu.

Mạng: Ethereum, BNB Chain, Polygon, Arbitrum, Optimism, Base, Gnosis và Avalanche C-Chain.

## Mô hình dữ liệu

- Sourcify **API v2**: `GET https://sourcify.dev/server/v2/contract/{chainId}/{address}?fields=abi,sources,compilation,proxyResolution`.
- Blockscout **API v2** (mạng được cấu hình): `GET {blockscout}/api/v2/smart-contracts/{address}`.
- Nếu phát hiện proxy và có implementation address từ nguồn công khai, quét thêm source của **implementation đầu tiên** (tối đa một bước) khi truy xuất được.
- Khi không có source/ABI, **không** đưa ra điểm an toàn hoặc khẳng định “không có lỗ hổng”. Điểm số chỉ xuất hiện nếu có ít nhất dữ liệu ABI.
- Quy tắc là heuristics mã nguồn; tham số hóa, trạng thái on-chain, mạch điều khiển chính xác, proxy nâng cấp, và logic liên hợp **không** được xác minh tự động.

### Giới hạn

**Không phải Honeypot.is, không phải mô phỏng giao dịch.** Không có kiểm tra thanh khoản/giá, honeypot buy/sell, thuế giao dịch hiệu lực, quyền owner hiện tại, quyền multisig, exploitability, reentrancy theo luồng điều khiển hay toán hình thức. *Tên hàm nhạy cảm ≠ lỗ hổng hoặc bằng chứng lừa đảo*.

Từ các dự án tham khảo MaatEye, MIESC, TythanAI, ChainAudit và OpenAudit, phiên bản này chỉ áp dụng **quy tắc độc lập của Audityzer**; không gọi các engine đó. Không sao chép mã nguồn của các dự án tham khảo. Việc tích hợp Slither/Mythril/Echidna/MIESC/OpenAudit cần worker/backend được cô lập, giới hạn thời gian và tài nguyên, cùng kiểm tra giấy phép tương ứng (MIESC AGPL-3.0, TythanAI BSL-1.1).

**CORS / rate limits:** Trình duyệt hoặc API có thể từ chối/tạm ngưng yêu cầu. Giao diện hiển thị điều này và không giả lập kết quả. Nếu muốn độ tin cậy cao ở production, bổ sung backend proxy/cache + nhà cung cấp API có SLA + RPC kiểm tra deployed bytecode và proxy storage, đồng thời ghi provenance của mỗi phát hiện.

## Kiểm thử

`node --test tests/quickscan-engine.test.mjs`

## Lộ trình triển khai chuyên sâu

- Backend đọc `eth_getCode`, so khớp triển khai; phát hiện EIP-1967, beacon/diamond/minimal proxy bằng bytecode + slot.
- Phân tích access control thực tế: người nắm admin, owner, roles, multisig/timelock.
- Chạy Slither và công cụ bổ trợ trong sandbox theo commit/compiler pinned; hợp nhất findings SARIF với vị trí source thật.
- Mô phỏng buy/sell trên fork chain có thanh khoản, có giới hạn gas và báo cáo điều kiện thử nghiệm (không thay thế tư vấn tài chính).
- Chấm độ tin cậy riêng: ABI only / verified source / static tools / chain state / transaction simulation; *không chấm SAFE nếu dữ liệu thiếu*.
