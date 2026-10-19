# Minh chứng chạy thực tế

Các ảnh chụp từ Chrome Windows truy cập localhost của Docker Engine trong Ubuntu 24.04 WSL2. Thời điểm ghi nhận trong đêm 19 và rạng sáng 20/10/2026, giờ Việt Nam.

- `assets.png`, `dashboard.png`: 12 hồ sơ thiết bị; TB-006 đang bảo trì.
- `asset-history.png`: TB-002 hoàn tất bảo trì, chi phí 150.000 VND và kết quả đã lưu.
- `pgadmin.png`: pgAdmin kết nối server Hải Asset PostgreSQL.
- `grafana-metrics.png`: CPU/RAM thực theo nhãn container project de16hai.
- `logql-maintenance.png`: query Loki và các sự kiện bảo trì có kết quả.
- `github-history.png`: bốn mốc kỹ thuật trước khi commit tài liệu. Lịch sử đầy đủ năm commit xem trực tiếp trên GitHub sau khi bàn giao.
- `mobile.png`: kiểm tra ở khung 390 × 844; giao diện không tràn ngang.
- `verification.txt`: kết quả kiểm tra và phục hồi thực tế đã loại thông tin bí mật.

Log có thể chứa sự kiện của bản ghi QA đã được dọn khỏi database sau kiểm thử; các dòng log vẫn được giữ theo chính sách lưu trữ. Các hình phản ánh từng thời điểm, vì vậy counter hoặc số thiết bị đang bảo trì có thể khác giữa các ảnh; hồ sơ và lịch sử thực tế được đối chiếu trong database.
