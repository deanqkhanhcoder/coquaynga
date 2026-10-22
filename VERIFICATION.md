> Bản sửa mới nhất chuyển camera sang **POV tại ghế**, xem [POV-VERIFICATION.md](./POV-VERIFICATION.md). Các kết quả dưới đây ghi lại lần sửa góc chân dung trước đó.

# Sửa camera theo tổ và typography trình chiếu — 22/10/2026

## Phạm vi và bảo toàn

Sửa `scene.js`, `style.css`, `index.html`, `game.js`; cập nhật script hồi quy, thêm `tests/camera-typography.cjs` và hướng dẫn. Không đổi engine, dữ liệu câu hỏi, thuật toán, âm thanh gốc, shader hoặc cấu hình deploy.

Danh sách bàn giao: `scene.js`, `style.css`, `index.html`, `game.js`, `tests/browser-check.cjs`, `tests/camera-typography.cjs`, `README.md`, `VERIFICATION.md`; manifest hash, ảnh và kết quả kiểm tra trong `artifacts/`.

SHA-256 trước/sau lưu tại `artifacts/camera-typography-before.json` và `artifacts/camera-typography-after.json`. Cả sáu giá trị khớp: toàn file engine, vùng engine, 31 câu hỏi/phương án/đáp án, vùng âm thanh gốc, toàn file shader, toàn file Netlify. Kiểm tra các vùng mã dùng LF như manifest cũ. Bộ `node --test tests/engine.test.mjs`: **20/20 đạt**.

## Camera và nhãn

Nguyên nhân cũ: mỗi frame đặt lại camera về `(0, 3.45, 3.8)`; đầu/thân Tổ 4 bị ẩn trên layer riêng; lớp HTML tên tổ chưa được dùng.

Mỗi model và chỗ ngồi giữ nguyên identity, vị trí, hướng mặt. Bốn anchor camera được đặt riêng trước mặt từng tổ:

| Tổ | Camera x / y / z | Điểm nhìn x / y / z |
|---|---|---|
| 1 | -0.72 / 2.70 / 0.10 | -3.02 / 1.65 / -0.18 |
| 2 | 0.10 / 2.74 / -0.66 | 0 / 1.65 / -3.04 |
| 3 | 0.72 / 2.72 / 0.12 | 3.02 / 1.65 / -0.18 |
| 4 | -0.08 / 2.75 / 0.66 | 0 / 1.65 / 3.04 |

Camera dịch chuyển vật lý trong **1.000 ms**, smoothstep vị trí, quaternion slerp theo cung ngắn nhất. Chỉ khởi tạo khi đổi `current`, sang tổ chiến thắng hoặc epoch mới khi restart; chọn mục tiêu và render HUD không khởi tạo lại chuyển động. Transition mới chụp lại vị trí/hướng hiện tại rồi thay thế transition cũ, không thêm timer/RAF. Đổi kích thước chỉ cập nhật phép chiếu. Reduced motion dùng anchor cuối ngay lập tức.

Đầu/thân Tổ 4 hiện trên layer chung; đèn hắt cũ dịch về phía mặt khi quan sát tổ này, không thêm nguồn sáng. Tên/HP HTML được tạo đúng một lần cho mỗi model và chiếu từ một Object3D con của đầu sau khi cập nhật camera và animation. Nhãn ngoài frustum hoặc sau camera được ẩn. Chữ không đi qua pixelation/dither/vignette; CRT 3D vẫn giữ nguyên.

## Typography và kết quả Chrome

Ở **1920×1080**: câu hỏi **44 px**, đáp án **32 px**, A–D **36 px**, tên tổ **36 px**, HP **28 px**, tên lượt **38 px**, nút **26–30 px**, nhật ký **22 px**. Font Google Sans nhúng, đậm, tương phản cao; terminal hai cột và vẫn tự thu trong animation.

`tests/camera-typography.cjs`: **17/17 mục đạt** trên Chrome / WebGL 2 / SwiftShader, static HTTP, thời gian gameplay gốc. Báo cáo: `artifacts/camera-typography-chrome-verification.json`.

- Đo cả **31 câu**: đủ bốn đáp án, không tràn/cắt hoặc cần cuộn ở Full HD. Panel cao tối đa **439 / 1080 px**. Câu dài nhất là câu 16, 221 ký tự hiển thị; ảnh `artifacts/camera-chrome-longest-question.png`.
- Bốn camera ở phía trước mặt model đúng ID (dot hướng mặt > 0.997), cách đầu khoảng 2.37–2.44 đơn vị. Không va chạm trong phép lấy mẫu 100 mm trên **16 đường nối anchor** bằng raycasting với mesh thực tế. Đây là kiểm tra các đường mẫu, không phải hệ thống vật lý liên tục.
- Bốn ảnh trực diện ở `artifacts/camera-chrome-seat-1.png` đến `seat-4.png`. Nhãn bám đầu, sai số phép chiếu dưới 0.02 px; khuôn mặt ở phía trên panel câu hỏi.
- Chuyển hai chỗ ngồi đối diện, thay transition giữa chừng, 100 lần render HUD: vị trí/hướng chuyển đúng, không khởi động lại transition.
- **Hai vòng lượt thật** 1 → 2 → 3 → 4, dùng trả lời sai và tự bắn lép theo engine. Camera giữ đúng người đang chơi trong aiming/shot, sau đó chuyển đến người kế tiếp.
- Còng bỏ Tổ 2 chuyển thẳng sang Tổ 3; loại Tổ 2 cũng chuyển đến tổ còn sống tiếp theo. Nhãn tổ bị loại cập nhật đúng.
- Năm restart liên tiếp: giữ nguyên bốn UUID/model/vị trí/hướng mặt, bốn nhãn và một canvas; mỗi restart thay transition cũ.
- Câu 31 quay về câu 1 ngay trong trình duyệt.
- **1920×1080, 1280×720, 390×844**, không tràn ngang, canvas phủ viewport. Trên điện thoại, terminal cuộn để đọc/chọn đủ bốn đáp án với chữ lớn. Toàn màn hình hoạt động.
- Lỗi JavaScript/console/shader/HTTP/tài nguyên: **0**.

## Hồi quy đầy đủ và kiểm tra mã cuối

- `node tests/browser-check.cjs`: **20/20 đạt trên Chrome**, báo cáo `artifacts/camera-regression-chrome-verification.json`. Chơi từ bắt đầu đến thắng bằng UI và thuật toán gốc: **22 phát / 4 băng**, Tổ 1 thắng với 1 HP. Kiểm tra đáp án đúng/sai, ép tự bắn, giữ lượt khi lép, súng/mâm xoay, live flash/recoil, HP CRT, năm vật phẩm, click thật cả bốn CRT/mặt nạ, mute, toàn màn hình và chơi lại từ màn thắng.
- Năm restart giữa animation vẫn giữ một renderer/canvas; sau làm nóng, GPU giữ **154 geometry / 18 texture**. Theo dõi mọi cập nhật phase: camera luôn thuộc tổ hiện tại hoặc tổ thắng, không thuộc mục tiêu đang bị nhắm.
- `BROWSER_CHANNEL=msedge node tests/browser-check.cjs --smoke`: **14/14 đạt**, `artifacts/camera-regression-msedge-verification.json`. Kiểm tra tương tác/hiển thị, bốn góc qua bốn CRT, vật phẩm, súng, HP, âm thanh và responsive; không chạy thêm ván đầy đủ trên Edge.
- Lượt cuối `node tests/camera-typography.cjs --layout-only`: **13/13 đạt**, `artifacts/camera-layout-chrome-verification.json`. Chạy lại camera, phép chiếu nhãn, chữ Full HD và kiểm tra **31 × 4 đáp án ở cả ba viewport**. Nhãn của cả bốn tổ không đè nút điều khiển, hộp lượt hoặc hộp đạn. Tooltip chữ lớn nằm trọn viewport kể cả con trỏ ở góc dưới phải. Các lỗi console/WebGL/JavaScript/HTTP/tài nguyên đều bằng **0**.

## Giới hạn thực tế

Chưa kiểm tra bằng màn chiếu và khoảng cách vật lý 5 mét, chưa nghe qua loa thật hoặc benchmark GPU vật lý. Đã xác nhận kích thước CSS/ảnh Full HD và chạy bằng software WebGL. Chưa deploy vào tài khoản Netlify; cấu hình zero-build giữ nguyên: publish thư mục chứa `index.html` (`.`), build command để trống.

---

# Báo cáo bản Retro Industrial Horror trước lần sửa này (giữ để đối chiếu)

## Những file đã thay đổi

- `scene.js`: dựng lại toàn bộ phòng, bàn, camera, nhân vật, CRT và inventory; tái sử dụng mô hình shotgun cơ khí đã có.
- `retro-pass.js`: thêm custom post-processing ShaderPass.
- `index.html`, `style.css`, `game.js`: canvas toàn màn hình và terminal HUD gọn; ánh xạ click vật phẩm/CRT vào engine cũ.
- `retro-preservation.json`, `tests/engine.test.mjs`, `tests/browser-check.cjs`: đối chiếu âm thanh và kiểm tra giao diện 3D mới.
- `README.md`, `VERIFICATION.md`: cập nhật kiến trúc, thao tác và kết quả kiểm tra.

`engine.js`, toàn bộ 31 câu hỏi, các phương án và đáp án không sửa. Các hàm âm thanh và ambience cũ không sửa; tiếng ma sát mâm là hiệu ứng bổ sung độc lập, tuân theo mute và không lấy số ngẫu nhiên từ engine.

## 20/20 kiểm tra logic/đối chiếu đạt

Lệnh thực tế: `node --test tests/engine.test.mjs`.

- SHA-256 engine và khối **31 câu hỏi gốc** khớp manifest, chuẩn hóa xuống dòng LF.
- SHA-256 toàn bộ hàm ambience/sound gốc khớp trước lần dựng lại scene retro.
- Bốn tổ, 3 HP, 2 vật phẩm khởi đầu, giới hạn 4 vật phẩm và thứ tự lượt.
- 500 lần nạp đúng 6 viên, 2–4 thật; câu hỏi qua hơn ba vòng danh sách không có `undefined`.
- Các nhánh đúng/sai, tự bắn, sát thương cưa, giữ lượt, bỏ lượt, loại tổ, năm vật phẩm và chống xử lý phát bắn hai lần.
- Chơi lại reset trạng thái; **100 ván seeded** kết thúc với đúng một tổ thắng.

## Chrome: một ván đầy đủ và các kiểm tra nhánh

Chạy bằng static HTTP server ở `127.0.0.1:8080`, Chrome headless / WebGL 2 / SwiftShader. **Giữ thời gian animation gốc**.

Đợt kiểm tra chính có **17/17 mục đạt**, lưu ở `artifacts/retro-chrome-verification.json`:

- Canvas đúng 1440×900, phủ toàn viewport; FOV 64°, bốn CRT, 16 ô inventory vật lý.
- Pipeline thật: `RenderPass → OutputPass → ShaderPass`; buffer thấp hơn viewport, texture nearest.
- Không còn thẻ tổ, thanh HP hoặc kho đồ dạng card 2D; terminal câu hỏi đầu tiên khoảng 220 px trên màn 900 px, và thu lại còn thanh 26 px trong hành động.
- Click thật lên kính lúp 3D: đúng owner/index, viền highlight, sau dùng chỉ số vật phẩm dịch đúng. Bounds raycast theo hình dáng từng loại đồ, không dùng hộp cao đồng loạt chặn đồ nằm phẳng.
- Kính lúp, thuốc lá, cưa, bia qua thanh shortcut giữ đúng luật.
- Click mặt nạ chọn đúng tổ; vector nòng súng khớp mục tiêu (dot > 0.98); mâm xoay chuyển động.
- Bắn thật có recoil/flash/point light và trừ đúng HP, CRT đổi từ ba tia sáng xuống một tia khi trúng cưa.
- Trả lời sai tự bắn đúng 1 HP; đạn lép không có flash/light thật và tự bắn lép giữ lượt.
- Còng có mô hình ở tay; bia bỏ viên cuối nạp lại và giữ câu hỏi/lượt.
- Năm lần restart liên tiếp: một canvas, HP/lượt/đạn mới đúng; tài nguyên GPU sau làm nóng ổn định ở 148 geometry và 18 texture trong lần chạy này.
- Âm thanh/mute, đồ họa, nhật ký, luật chơi và toàn màn hình hoạt động.
- **Ván đầy đủ: 22 phát bắn / 4 băng; Tổ 1 thắng với 1 HP.** Nút chơi lại ở màn thắng khôi phục bốn tổ.
- Layout 1280×720 và 390×844: canvas phủ viewport, bốn đáp án còn thao tác được, không tràn ngang.
- Lỗi shader, JavaScript, console, HTTP và tài nguyên: **0**.

Kiểm tra bổ sung trên mã cuối: click trực tiếp cả **bốn CRT**, xác nhận target lần lượt 0/1/2/3, gồm vị trí POV; thu/mở terminal, đèn chấm mâm xoay và âm thanh ma sát. Kết quả/ảnh ở `artifacts/retro-final-interactions.json` và `artifacts/retro-final-preview.png`. Bốn kiểm tra CRT cũng đã được đưa vào script trình duyệt để tái chạy.

Một lượt kiểm tra reload riêng trên mã cuối xác nhận súng cùng xoay với mâm, terminal ẩn trong animation và góc xoay cục bộ của súng trở về 0 khi vào câu hỏi. Không có lỗi console/JS. Kết quả: `artifacts/retro-reload-check.json`; assertion tương ứng đã được thêm vào script trình duyệt.

## Edge: kiểm tra tương thích

Chạy `BROWSER_CHANNEL=msedge node tests/browser-check.cjs --smoke`, thời gian animation gốc, WebGL 2 / SwiftShader.

**11/11 mục đạt** ở `artifacts/retro-msedge-verification.json`: scene/camera/shader, inventory raycast/viền, bốn vật phẩm qua shortcut, chọn mặt nạ/xoay súng/mâm, flash/sát thương/CRT và HUD tự thu, mute, chất lượng, nhật ký, luật, toàn màn hình, hai kích thước màn hình. Lỗi console/JS/shader/tài nguyên: **0**. Lượt Edge này không chạy thêm một ván đầy đủ.

## Giới hạn đã ghi nhận

- Các lần kiểm tra dùng software rendering, không phải benchmark FPS của GPU vật lý. Chưa đánh giá âm thanh qua loa thật.
- Ở màn dọc hẹp, giữ FOV 64° và dolly nhẹ nên một số vị trí cạnh bàn bị crop; nút chọn tổ/vật phẩm gọn vẫn cho phép thao tác đầy đủ bằng chuột/chạm. Desktop giữ bố cục POV sát bàn.
- Đã kiểm tra qua HTTP static server; chưa publish vào tài khoản Netlify thực tế.

## Netlify

Publish directory **`.`** (thư mục chứa `index.html`), Build command **để trống**. Không có bước cài dependency, bundler, backend, API key hay đường dẫn tuyệt đối của máy phát triển. Three.js/core/addons cố định **0.170.0**, tải qua HTTPS CDN; các module của game dùng đường dẫn tương đối.
