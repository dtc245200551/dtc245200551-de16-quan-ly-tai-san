# Ba truy vấn LogQL

Mở Grafana → Explore → chọn datasource **Loki**, chọn khoảng thời gian chứa thao tác vừa làm. Dùng Code mode để nhập nguyên truy vấn.

## 1. Lỗi HTTP từ Nginx

```logql
{job="nginx", project="de16hai"} | json | status >= 400
```

Thử truy cập đường dẫn không tồn tại hoặc gửi dữ liệu bị từ chối để có log. `status` được ghi dạng số trong JSON.

## 2. Vòng đời phiếu bảo trì

```logql
{job="app", project="de16hai"} | json | event=~"maintenance_(scheduled|started|completed|cancelled)"
```

Xem `maintenance_id`, `asset_id` và `request_id` trong bản ghi, không đưa các ID thay đổi liên tục thành labels.

## 3. Cảnh báo và lỗi ứng dụng

```logql
{job="app", project="de16hai"} | json | level=~"warn|error"
```

Ví dụ lỗi xác thực dữ liệu `request_rejected` khi chọn trạng thái thiết bị không hợp lệ. Không tạo lỗi 500 giả để minh họa. Tra một request cụ thể bằng cách thêm `| request_id="..."` sau `| json`.

## PostgreSQL bổ sung

```logql
{job="postgres", project="de16hai"} | json | error_severity=~"ERROR|FATAL"
```

PostgreSQL lưu JSON có `timestamp` gốc; thời điểm index của dòng PostgreSQL là thời điểm Promtail đọc. Log app/Nginx dùng thời điểm từ JSON. Hệ thống không log body, cookie hoặc mật khẩu; PostgreSQL tắt ghi statement và chỉ đính kèm statement ở mức panic.

Promtail đọc volume riêng của project ở chế độ chỉ đọc, vị trí đọc lưu bền vững. Logrotate kiểm tra mỗi 60 giây, xoay file 5 MB và giữ 3 bản nén; file PostgreSQL theo ngày được dọn sau 7 ngày. Loki giữ dữ liệu 168 giờ, có độ trễ xóa của compactor.

Promtail đã hết hỗ trợ từ 02/03/2026; vẫn giữ theo đề thực hành. Hướng thay thế là Grafana Alloy: https://grafana.com/docs/loki/latest/send-data/promtail/.
