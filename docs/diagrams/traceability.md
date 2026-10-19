# Nguồn kiểm chứng sơ đồ

Nguồn: compose.yaml, compose.monitoring.yaml, compose.logging.yaml và app/db/schema.sql của cùng repository.

Architecture là sơ đồ triển khai: trình duyệt Windows dùng localhost được WSL2 chuyển tiếp; Nginx → Express bằng HTTP và app → PostgreSQL bằng SQL. pgAdmin kết nối PostgreSQL qua mạng database. Nguồn chạy nằm trên filesystem Linux, daemon Docker Engine độc lập với Docker Desktop.

Observability là sơ đồ luồng metrics và log. Prometheus scrape năm jobs, trong đó chính Prometheus không vẽ thành một nút nguồn thứ hai. Grafana truy vấn Prometheus và Loki. Promtail đọc volume log riêng của project rồi push Loki; không đọc log toàn máy.

ERD là sơ đồ logic phạm vi bốn bảng nghiệp vụ; tên bảng, PK/FK, uniqueness và nullability khớp SQL. categories 1 → assets 0..*, locations 1 → assets 0..*, assets 1 → maintenance 0..*. Hai bảng kỹ thuật admins và sessions được mô tả riêng trong báo cáo; sessions lưu JSON và không có FK trực tiếp tới admins, vì vậy không vẽ quan hệ giả. Partial unique index giới hạn một phiếu in_progress cho mỗi asset; không giới hạn tổng số lịch sử.

Không có vai trò cấp phát/thu hồi, không có MySQL, không có frontend React. Chỉ có một actor quản trị viên cho ứng dụng.
