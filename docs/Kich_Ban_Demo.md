# Demo Đề 16 Hải Asset

Nguyễn Xuân Hải · dtc245200551 · CNTT K23D · Giảng viên Vũ Việt Dũng.

## 1. Mở hệ thống

Mở Ubuntu WSL2, vào `~/projects/de16-quan-ly-tai-san`, chạy `sh scripts/start.sh`. Daemon phải là Docker Engine của Ubuntu. Giữ terminal Ubuntu mở, hoặc dùng wrapper PowerShell có WSL keepalive.

Mở Chrome Windows: website 8086, pgAdmin 8087, Grafana 3003 và Prometheus 9092. Đăng nhập website bằng `admin`, xem mật khẩu trên máy tại `.local/secrets/admin_password`. Không đưa mật khẩu lên ảnh hoặc GitHub.

## 2. Tạo một thiết bị mới

Thêm mã `DEMO-<ngay-gio>` để mỗi lần demo không trùng. Ví dụ tên “Laptop trình bày”, serial `DEMO-SN-<ngay-gio>`, danh mục Máy tính và phụ kiện, vị trí Phòng thực hành A101, giá trị 15.000.000 VND, trạng thái đang sử dụng. Mở chi tiết để đối chiếu thông tin vừa lưu. Tìm lại bằng mã và thử bộ lọc vị trí.

## 3. Thực hiện một vòng bảo trì

Từ chi tiết thiết bị, lập lịch “Vệ sinh và kiểm tra định kỳ”, chỉ định Tổ kỹ thuật ICTU. Bắt đầu phiếu: kiểm tra trạng thái thiết bị chuyển sang đang bảo trì. Hoàn tất với kết quả “Đã vệ sinh và kiểm tra, hoạt động ổn định”, chi phí 150.000 VND. Hồ sơ trả lại đang sử dụng và lưu lịch sử kèm kết quả/chi phí.

Trong dữ liệu minh chứng sẵn có, TB-002 có phiếu hoàn tất và TB-006 đang bảo trì. Không cần sửa các hồ sơ này để chạy lại demo.

## 4. Chỉ ra kiểm soát dữ liệu

Thử nhập mã thiết bị đã tồn tại hoặc số tiền âm để xem thông báo. Thiết bị có lịch bảo trì mở chưa được ngừng sử dụng. Chạy `sh scripts/test.sh` để minh họa 25 trường hợp, gồm hai yêu cầu bắt đầu đồng thời chỉ có một yêu cầu thành công. Bộ kiểm thử dùng tài khoản/dữ liệu QA riêng rồi dọn; không đổi mật khẩu admin chính.

## 5. Database và giám sát

pgAdmin đăng nhập bằng `admin@hai.edu.vn`, mật khẩu riêng trong `.local/secrets/pgadmin_password`. Mở nhóm Đề 16 → Hải Asset PostgreSQL, dùng mật khẩu role `asset_migrate` từ `.local/secrets/db_migrate_password`. Chỉ ra database assets và các bảng nghiệp vụ.

Prometheus `/targets` có 5 jobs UP. Trong Grafana mở Đề 16 Nguyễn Xuân Hải → Hải Asset | Thiết bị và vận hành. Chỉ ra CPU/RAM từng container, Nginx, PostgreSQL, số thiết bị theo trạng thái và thao tác bảo trì. Rate cần hai chu kỳ scrape; counter bắt đầu lại khi app restart.

## 6. LogQL

Grafana → Explore → Loki → Code. Dùng ba truy vấn tại `observability/logql.md`, khoảng thời gian Last 1 hour. Chạy query vòng đời bảo trì và chỉ ra `maintenance_id`, `asset_id`, `request_id` từ thao tác vừa thực hiện.

Để tạo lỗi HTTP 403 có kiểm soát, gửi POST không có CSRF:

```sh
curl -s -o /dev/null -w 'HTTP %{http_code}\n' -X POST http://localhost:8086/auth/login
```

Để minh họa cảnh báo dữ liệu, sau đăng nhập truy cập `/assets?status=invalid`; website từ chối bằng 400. Sau khi Promtail đẩy log, chạy lại query 1 và 3. Không cần làm hỏng dịch vụ để có log minh chứng.

## 7. Hardening và sao lưu

Chạy `python3 scripts/check-hardening.py`. Chỉ ra app/Nginx non-root, read-only, dropped capabilities, network nội bộ, port localhost và secrets ngoài Git. Giải thích cAdvisor là ngoại lệ có quyền quản trị host Docker.

Chạy `sh scripts/backup.sh`, lấy đường dẫn in ra rồi chạy `sh scripts/restore.sh --verify-current <duong-dan>`. Lệnh phục hồi vào DB tạm và đối chiếu dữ liệu, không thay DB demo. Không chạy `--apply` trong buổi trình bày trừ khi chủ động phục hồi thay dữ liệu.

Kết thúc bằng `sh scripts/stop.sh` khi không cần xem giao diện nữa; dữ liệu vẫn được giữ. Repository private nên cần cấp quyền đọc cho giảng viên qua thao tác GitHub của chủ tài khoản.
