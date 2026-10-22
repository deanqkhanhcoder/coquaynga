# Camera POV tại ghế — 22/10/2026

## Cập nhật: chuyển cảnh chậm và nhìn đủ ba người

- `scene.js`: chuyển ghế **2.600 ms** với smootherstep; FOV dọc **88° tại Full HD**, khoảng **88,9° tại 1440×900**. Điều chỉnh theo aspect ratio, ưu tiên góc ngang ít nhất 115°, cap dọc 100° trên màn hẹp.
- Nâng hemisphere, phản xạ môi trường và đèn hắt mặt. Mặt nạ Tổ 4 có vật liệu da bẩn sáng hơn, vẫn là mesh PBR. Không đổi shader, câu hỏi, engine hoặc âm thanh.
- `node tests/wide-pov.cjs`: đạt **bốn ghế × hai viewport** 1920×1080 / 1280×720. Cả ba model còn lại, toàn bộ đầu và nhãn đều nằm trong khung; mặt nằm trên HUD. Chuyển cảnh 2,6 giây và restart đạt; không lỗi JavaScript/console/HTTP/tài nguyên. Báo cáo `artifacts/wide-pov-verification.json`.
- Đã xem ảnh thực tế `artifacts/wide-pov-1920-seat-1.png` đến `seat-4.png`. Đo 24 vùng trung tâm mặt trong screenshot: luminance trung bình thấp nhất **25,5/255**, percentile 90 thấp nhất **72,9/255**, không còn mặt nạ chìm đen hoàn toàn. Chi tiết: `artifacts/wide-pov-face-visibility.json`.
- `node --test tests/engine.test.mjs`: **20/20 đạt**, hash engine, 31 câu hỏi và âm thanh gốc khớp.
- `node tests/browser-check.cjs --smoke`: **14/14 đạt** trên Chrome: raycast vật phẩm/bốn CRT/mặt nạ, xoay súng/mâm, bắn thật/HP, mute, đồ họa, luật, nhật ký, fullscreen và responsive. Không có lỗi console/JS/WebGL/HTTP/tài nguyên.
- Các mục bên dưới là hồ sơ cấu hình POV trước cập nhật FOV/ánh sáng này. Màn dọc hẹp vẫn có thể crop hai bên; kiểm tra nhìn đủ ba người áp dụng cho hai viewport ngang nêu trên.

---

## Thay đổi

Source game chỉ sửa **`scene.js`**. Cập nhật `tests/camera-typography.cjs`, `tests/browser-check.cjs`, `README.md`, bổ sung báo cáo này và liên kết trong `VERIFICATION.md`. Báo cáo/ảnh cũ được giữ lại; dữ liệu kiểm tra mới dùng tiền tố `pov-` trong `artifacts/`.

Nguyên nhân: `TURN_CAMERAS` cũ đặt camera phía trước nhân vật và `lookAt` vào thân trên. Đã thay bằng Object3D gắn dưới transform từng ghế. Vị trí tầm mắt và điểm tiêu cự được chuyển từ local sang world space, không phụ thuộc animation đầu.

| Tổ | Camera world x / y / z | Điểm nhìn |
|---|---|---|
| 1 | -3.02 / 2.32 / -0.18 | Tâm bàn: 0 / 1.20 / 0 |
| 2 | 0 / 2.32 / -3.00 | Tâm bàn: 0 / 1.20 / 0 |
| 3 | 3.02 / 2.32 / -0.18 | Tâm bàn: 0 / 1.20 / 0 |
| 4 | 0 / 2.32 / 3.00 | Tâm bàn: 0 / 1.20 / 0 |

Scene có mặt bàn y=1.205, đầu model y=2.16, mắt khoảng y=2.3. Vì vậy dùng y=2.32 theo tỷ lệ hiện tại; y=1.1–1.4 sẽ nằm sát mặt bàn và thấp hơn mắt model. Góc cúi khi ổn định khoảng 20°, FOV 64° giữ nguyên. Bốn vị trí camera ở bán kính khoảng 3.0, không ở tâm bàn.

Transition 2.200 ms: smootherstep theo thời gian, đường cong theo cung ngắn nhất với bán kính tối thiểu 1.95 và nâng nhẹ khi cần tránh model gục. Camera luôn nhìn về điểm tiêu cự bàn; không đi ngang qua tâm rồi nhìn thẳng xuống. Snapshot endpoint/điểm nhìn một lần khi đổi `current`, epoch mới hoặc tổ thắng; thay transition đang chạy an toàn. `target`/`shot.target` chỉ điều khiển súng và phản ứng bắn. Tùy chọn giảm chuyển động của hệ điều hành vẫn được tôn trọng.

Bốn model không đổi vị trí, hướng ngồi hoặc identity. Model tại POV và model sát ống kính được ẩn tạm khi render để tránh xuyên mặt nạ; không xóa đối tượng hoặc tạo model mới. Hitbox thân đang ẩn không chặn raycast vật phẩm. Nhãn còn nhìn thấy vẫn chiếu từ đầu animated sau shader; nhãn chính mình và nhãn bị cắt ngoài mép được ẩn thay vì dời khỏi đầu. HUD chỉ tổ hiện tại vẫn giữ nguyên.

## Bảo toàn

`artifacts/pov-preservation-before.json` và `artifacts/pov-preservation-after.json` so SHA-256 **toàn file**: `engine.js`, `game.js` (gồm âm thanh), `style.css`, `index.html`, `retro-pass.js`, `netlify.toml`, `fonts.css`. Cả bảy file không thay đổi. Engine, 31 câu hỏi, HP/đạn/vật phẩm, âm thanh, kích thước chữ, HUD và shader giữ nguyên.

`node --test tests/engine.test.mjs`: **20/20 đạt**, gồm hash gốc, luật chơi, năm vật phẩm, câu hỏi tuần hoàn và 100 ván seeded.

## Ảnh và bố cục thực tế

Mở game qua static HTTP server `127.0.0.1:8080`, Chrome / WebGL 2 / SwiftShader. Đã chụp và xem trực tiếp cả bốn POV tại 1920×1080:

- `artifacts/pov-chrome-seat-1.png`: nhìn từ ghế Tổ 1 sang Tổ 3.
- `artifacts/pov-chrome-seat-2.png`: nhìn từ ghế Tổ 2 sang Tổ 4.
- `artifacts/pov-chrome-seat-3.png`: nhìn từ ghế Tổ 3 sang Tổ 1; không có mặt Tổ 3 trước camera.
- `artifacts/pov-chrome-seat-4.png`: nhìn từ ghế Tổ 4 sang Tổ 2, loa/máy hiện sóng phía sau.

Súng nằm trên mâm ở trung cảnh, đầu đối diện và hậu cảnh ở phía trên, bàn/ô đồ vật ở tiền cảnh. Với HUD câu đầu, toàn bộ silhouette súng nằm phía trên panel. Mép dưới súng lần lượt khoảng **553, 508, 594, 515 px**, trong khi panel bắt đầu ở **644 px**. Panel cao nhất trong 31 câu bắt đầu khoảng **627 px**, vẫn thấp hơn súng.

## Giới hạn

Kiểm tra bằng software WebGL và ảnh trình duyệt; không phải benchmark GPU thật. Góc nhìn dọc hẹp crop hai bên theo phối cảnh; nút terminal vẫn thao tác đầy đủ. Các nhân vật sát mép màn hình có thể bị crop và nhãn tương ứng được ẩn. Lượt này kiểm tra Chrome, không chạy lại Edge hoặc nguyên ván trình duyệt đến chiến thắng; các kết quả cũ vẫn được giữ trong báo cáo trước. Chưa deploy thực tế lên tài khoản Netlify; cấu hình vẫn publish `.` và không có build command.

## Các bài kiểm tra đã chạy trên mã POV

- `node tests/camera-typography.cjs`: **18/18 đạt**, thời gian animation gốc, báo cáo `artifacts/pov-camera-chrome-verification.json`.
- Bốn POV: camera ở đúng ghế, thân/đầu chính mình được ẩn, thấy nhân vật đối diện và toàn bộ súng phía trên HUD. Nhãn còn trong khung bám đúng đầu với sai số phép chiếu < 0.02 px.
- **16 đường nối ghế × 2 tư thế model**, lấy mẫu với raycast 100 mm theo sáu hướng: không chạm mesh và không ẩn nhân vật trung gian để vượt qua. Đây là kiểm tra lấy mẫu các đường đã cấu hình, không phải một physics engine.
- Chuyển ghế đối diện vẫn nhìn vào bàn; thay transition ở giữa không nhảy vị trí; 100 lần render HUD không tạo thêm transition.
- **Hai vòng lượt thật** 1 → 2 → 3 → 4 → 1, bóp cò/bắn giữ camera thuộc `current`. Còng và loại Tổ 2 đều chuyển từ POV Tổ 1 đến đúng POV Tổ 3. Đổi `target` không đổi tọa độ camera hoặc số transition.
- Năm restart liên tiếp giữ nguyên UUID/vị trí/hướng ngồi của bốn model, bốn nhãn và một canvas. Câu 31 tuần hoàn về câu 1.
- 31 câu × 4 đáp án tại **1920×1080, 1280×720, 390×844** vẫn đọc/chọn đầy đủ; HUD không đổi. Toàn màn hình và tooltip hoạt động.
- `node tests/browser-check.cjs --smoke`: **14/14 đạt**, báo cáo `artifacts/pov-regression-chrome-verification.json`. Click thật vật phẩm 3D, reindex inventory, kính lúp/thuốc lá/cưa/bia, bốn CRT từ ghế đối diện, click mặt nạ, hướng súng/mâm, live recoil/flash/HP, mute, chất lượng, nhật ký, luật và toàn màn hình. Chọn mục tiêu không đổi POV.
- Console/JavaScript/WebGL/shader/HTTP/tài nguyên: **0 lỗi** trong cả hai lượt kiểm tra cuối.
