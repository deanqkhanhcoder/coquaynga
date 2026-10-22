# Buckshot Roulette — Retro Industrial Horror

Game trình duyệt tĩnh, Three.js **0.170.0**, không có bước build, backend hoặc dependency cần cài khi deploy.

## Chạy tại máy

Trong thư mục chứa `index.html`:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Mở http://127.0.0.1:8080 bằng Chrome / Edge có WebGL 2 và tăng tốc phần cứng. Không mở bằng `file://`. Cần kết nối mạng để tải Three.js từ CDN jsDelivr; phiên bản core và addons được khóa đồng nhất trong import map.

## Deploy Netlify

1. Chọn thư mục gốc chứa `index.html` làm **Publish directory** (`.`).
2. Để trống **Build command**.
3. Deploy toàn bộ thư mục. Có thể kéo thả thư mục này vào giao diện deploy tĩnh của Netlify.

`netlify.toml` đã đặt publish là `.`. Không cần `npm install`, `npm run build`, biến môi trường hoặc API key. Các file trò chơi phải giữ cùng cấu trúc thư mục. Không cần redirect cho SPA.

## Các file chính

- `index.html`: entry point, import map, HUD và nguyên văn hướng dẫn luật chơi.
- `engine.js`: engine thuần và toàn bộ **31 câu hỏi gốc**, giữ nguyên nội dung/đáp án/thuật toán.
- `game.js`: terminal HUD, thanh vật phẩm 1–4 gọn, Web Audio, ánh xạ raycast vào engine và một chuỗi animation có thể hủy cho mỗi ván. Các hàm âm thanh cũ được giữ nguyên; chỉ thêm tiếng ma sát mâm xoay.
- `scene.js`: camera POV rộng tại từng ghế nhìn vào bàn, nhãn HTML neo vào đầu nhân vật, bàn bát giác, mâm xoay cơ khí, súng/đạn, CRT HP, mặt nạ, tay, loa/pallet/cáp/máy hiện sóng và raycasting.
- `retro-pass.js`: custom ShaderPass sau OutputPass; Bayer dithering 4×4, quantization, màu crimson/olive, grain, scanline và vignette. Render vào buffer thấp hơn viewport, texture nearest-filtered; HUD giữ nguyên độ phân giải.
- `style.css`, `fonts.css`: bố cục thích ứng và font nhúng từ bản gốc.
- `FONT-LICENSE.txt`: giấy phép SIL Open Font License của font gốc.
- `preservation.json`: SHA-256 engine và khối câu hỏi gốc, chuẩn hóa xuống dòng LF để so sánh giữa Windows/Linux.
- `retro-preservation.json`: SHA-256 toàn bộ hàm âm thanh/ambience gốc trước lần dựng lại scene retro.
- `VERIFICATION.md`: kết quả kiểm tra phiên bản hiện tại.
- `POV-VERIFICATION.md`: kết quả sửa góc nhìn tại ghế, thay cho góc chân dung của lần sửa trước.
- `tests/`: kiểm tra logic độc lập và kiểm tra trình duyệt tùy chọn.
- `artifacts/`: ảnh và báo cáo do các lần kiểm tra trình duyệt tạo ra; không phải tài nguyên bắt buộc của game.

Không dùng ảnh, mô hình hoặc âm thanh bên ngoài có bản quyền. Hình học, texture, phản xạ môi trường và hiệu ứng âm thanh được tạo bằng code. Font giữ giấy phép gốc; Three.js dùng MIT và được tải qua CDN.

## Điều khiển

- MC bấm **BẮT ĐẦU**, chờ nạp đủ sáu viên, rồi chọn A–D bằng chuột hoặc bàn phím.
- Sau câu trả lời đúng, nhấp trực tiếp vật phẩm 3D trong ô của tổ hiện tại. Hover có viền và tooltip điều kiện sử dụng. Có thể dùng hàng phím tắt nhỏ ở terminal hoặc phím **1–4**. Chỉ số ô được cập nhật ngay sau khi dùng vật phẩm.
- Nhấp mặt nạ hoặc CRT của tổ để nhắm, rồi bấm **KHAI HỎA**. Nút **TỔ 1–4** ở terminal là lựa chọn tương đương. Súng và mâm xoay hướng về mục tiêu trong không gian.
- Vị trí cố định: Tổ 1 trái, Tổ 2 phía xa, Tổ 3 phải, Tổ 4 phía gần. Camera nằm ở tầm mắt tại chính ghế đang chơi (y=2.32 theo tỷ lệ model hiện có), nhìn về tâm bàn `(0,1.20,0)`. Anchor là Object3D con của transform ghế; vị trí/hướng được suy ra theo ghế, không theo đầu đang animation. Đổi lượt di chuyển chậm theo đường cong **2,6 giây**, smootherstep với vận tốc/gia tốc bằng 0 ở hai đầu, vẫn nhìn tâm bàn. Chọn mục tiêu chỉ xoay súng, không đổi POV.
- FOV dọc tối thiểu **88°**, tự mở thêm để duy trì góc ngang tối thiểu 115° khi có thể, giới hạn 100° trên màn hẹp. Desktop 1920×1080 và 1280×720 nhìn đủ cả ba mặt nạ còn lại. Ánh sáng môi trường/đèn hắt mặt và bề mặt mặt nạ Tổ 4 được cân lại để thấy rõ khuôn mặt; shader retro giữ nguyên. Màn dọc hẹp vẫn có thể crop hai bên; dùng màn ngang để quan sát đồng thời cả ba tổ.
- Bốn model giữ nguyên identity/vị trí. Model ở sát camera được ẩn tạm để tránh xuyên mặt nạ; hiện lại khi nhìn từ ghế khác. Không tạo thêm tay/cơ thể POV. Nhãn tên/HP được chiếu từ đầu đang chuyển động và ghép sau shader. Nhãn chính mình, nhãn ngoài khung hoặc bị cắt ở mép được ẩn; HUD luôn cho biết tổ đang chơi. CRT vẫn có ba tia sét; vật phẩm/CRT ngoài góc nhìn và tự bắn vẫn thao tác qua terminal.
- Canvas phủ 100vw × 100dvh. Terminal nằm ở mép dưới, tự thu gọn khi nạp/bóp cò/bắn/bỏ đạn/dùng vật phẩm. Nút **THU GỌN / MỞ TERMINAL** điều khiển thủ công; **NHẬT KÝ** mở/đóng cửa sổ log nhỏ.
- Ở 1920×1080: câu hỏi 44 px, đáp án 32 px, A–D/tên tổ 36 px, HP 28 px, tên lượt 38 px, nút 26–30 px, log 22 px. Font nhúng, đậm, tương phản cao và không đi qua shader. Full HD hiển thị đủ cả 31 câu với bốn đáp án không cần cuộn; màn hẹp giữ chữ lớn và cuộn bên trong terminal khi cần.
- Câu trả lời sai tự bắn vào tổ hiện tại theo luật gốc.
- **CHƠI LẠI**, âm thanh, toàn màn hình và hướng dẫn nằm ngay trên giao diện.
- **Đồ họa** chuyển qua tự động → thấp → cao. Chế độ tự động giảm độ phân giải và shadow map khi thiết bị yếu. Canvas DPR 1; render buffer tối đa rộng 960 px (cao), 640 px (thấp), cao tối đa 720 px. Shadow map 1024 / 512. Giới hạn render 45 / 30 FPS. Cả hai mức giữ phong cách PSX, không làm mượt hậu kỳ.

## Kiểm tra

Logic (chỉ cần Node, không cần package):

```sh
node --test tests/engine.test.mjs
```

Kiểm tra trình duyệt dành cho môi trường phát triển **đã có Playwright**, chạy cùng static server phía trên:

```sh
node tests/browser-check.cjs
node tests/camera-typography.cjs
node tests/wide-pov.cjs
```

Thêm `--layout-only` vào script camera để kiểm tra nhanh bố cục, chữ và bốn POV mà không chạy hai vòng lượt thật. Báo cáo/ảnh mới dùng tiền tố `pov-`; các báo cáo retro/camera cũ được giữ lại để đối chiếu.

Script dùng Chrome đã cài. Có thể đặt `BROWSER_CHANNEL=msedge` để chọn Edge; `PLAYWRIGHT_PATH` trỏ tới package Playwright đã có nếu không ở đường dẫn Node mặc định. Các biến này chỉ dành cho script kiểm tra, không dùng trong game hoặc Netlify. Thêm `--smoke` vào `browser-check.cjs` để kiểm tra ngắn phần hiển thị, raycast, vật phẩm, bắn và bố cục; chế độ này không chạy lại toàn bộ một ván đến chiến thắng. `camera-typography.cjs` kiểm tra anchor/đường chuyển, nhãn, 31 câu ở Full HD, hai vòng lượt thật, bỏ lượt/loại tổ, restart, responsive và hash trước/sau. Mọi chế độ giữ thời gian animation gốc.

Script chèn quyền truy cập engine **chỉ vào response kiểm tra** để đặt tình huống đạn/vật phẩm xác định. Game phát hành không có giao diện debug. Ván kiểm tra từ đầu đến chiến thắng dùng thuật toán xáo đạn và tương tác HUD thực tế.

Một renderer và một RAF được tạo cho vòng đời trang. Chơi lại chỉ reset trạng thái/animation, hủy timeout cũ và dừng âm thanh cũ. Cảnh tái sử dụng geometry/material; các mesh tĩnh được gộp theo material. Tab ẩn dừng render và tạm ngưng âm thanh; khi rời trang, tài nguyên WebGL được giải phóng. Tùy chọn giảm chuyển động của hệ điều hành cũng được áp dụng.

## Thiết kế render

Pipeline: `RenderPass → OutputPass → IndustrialPSX ShaderPass`. Tone mapping/color management được áp dụng trước quantization trên màu sRGB. Các vùng gần đen không nhận hạt sáng để giữ nền tối đặc; texture bẩn và Bayer vẫn hiện trong vùng được chiếu sáng. Không có asset hình ảnh/mô hình lấy từ bản game thương mại: toàn bộ geometry, bề mặt, ký hiệu CRT và shader được tạo trong source.

Inventory dùng pool cố định 16 ô × 5 mẫu vật phẩm; các mẫu chia sẻ geometry/material và chỉ bật mẫu đang có trong state. Bounds raycast tính theo từng loại đồ, tránh hộp click của lon bia chặn kính lúp/cưa nằm thấp bên cạnh. CRT chỉ vẽ lại khi HP/lượt/trạng thái thay đổi. Dao động máy hiện sóng cập nhật 5–10 Hz; mâm xoay không làm thay đổi kết quả viên đạn.
