# Giám sát Hải Asset

Mở Prometheus http://localhost:9092/targets: 5 jobs phải UP. Grafana http://localhost:3003, user `admin`, mật khẩu `.local/secrets/grafana_password`; thư mục **Đề 16 Nguyễn Xuân Hải**, dashboard **Hải Asset | Thiết bị và vận hành**.

Chỉ số CPU là phần trăm của một lõi, RAM là working set từng container. Bộ đếm HTTP/bảo trì bắt đầu lại khi app restart; gauge tài sản đọc PostgreSQL nên giữ số lượng. Các biểu đồ rate cần ít nhất hai lần scrape (30 giây).

Nginx exporter chỉ đọc `stub_status` trên mạng nội bộ; PostgreSQL exporter dùng role riêng với `pg_monitor`. cAdvisor là ngoại lệ hardening: privileged, host cgroup và các mount đọc Docker host để có metrics. Trên WSL2 phải kiểm tra label `container_label_com_docker_compose_project="de16hai"` và service app/nginx/postgres; target UP riêng lẻ chưa đủ chứng minh có số liệu container.

Cảnh báo được đánh giá tại Prometheus `/alerts`; bài demo chưa cấu hình gửi email hoặc Alertmanager.
