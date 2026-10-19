# Sơ đồ Hải Asset

`architecture.dot`: kiến trúc triển khai ứng dụng. `observability.dot`: luồng metrics và log. `erd.dot`: ERD logic của bốn bảng nghiệp vụ. Các file SVG và PNG 2400 px được render từ cùng nguồn DOT; PNG đã có metadata 300 DPI để chèn Word.

`traceability.md` ghi nguồn đối chiếu bảng/khóa ngoại, thành phần và luồng. Hai bảng kỹ thuật admins/sessions được mô tả riêng; không vẽ khóa ngoại giả cho JSON session.

Có thể chỉnh sửa DOT rồi render bằng Graphviz hoặc helper `word-uml-diagrams/scripts/render_dot.mjs` trong môi trường Codex có bundled @viz-js/viz và sharp. Khi thay schema hoặc Compose cần cập nhật cả nguồn, ảnh và phần mô tả trong báo cáo.
