# Hải Asset — Quản lý tài sản và thiết bị

**Đề 16 · Nguyễn Xuân Hải · dtc245200551 · CNTT K23D**  
Trường Đại học Công nghệ Thông tin và Truyền thông · Khoa Công nghệ Thông tin.  
Giảng viên: **Vũ Việt Dũng**. Môn Triển khai và Quản trị Hệ thống Phần mềm.

Website quản lý thiết bị riêng lẻ, danh mục, vị trí, lịch và lịch sử bảo trì. Node.js 24, Express 5, EJS, PostgreSQL 17, pgAdmin và Nginx. Toàn bộ dịch vụ chạy bằng Docker Compose trên **Docker Engine cài trực tiếp trong Ubuntu 24.04 WSL2**, không dùng daemon Docker Desktop.

## Chuẩn bị Ubuntu và Docker Engine

Trên PowerShell Windows đã bật WSL2:

```powershell
wsl --install --distribution Ubuntu-24.04 --no-launch
wsl -d Ubuntu-24.04 -u root
```

Trong Ubuntu, cài Engine từ APT repository chính thức theo https://docs.docker.com/engine/install/ubuntu/. Script `scripts/install-engine.sh` ghi đầy đủ các lệnh cho Ubuntu 24.04 mới: thêm Docker signing key/repository, cài Engine/Buildx/Compose, bật service systemd và chuẩn bị tài khoản `hai` thuộc nhóm docker.

WSL cần `[boot] systemd=true` trong `/etc/wsl.conf`. Bản cài cho bài này có `[user] default=hai`. Tài khoản Linux không có mật khẩu khởi tạo; nếu cần sudo, tự đặt bằng `wsl -d Ubuntu-24.04 -u root -- passwd hai`. Quyền nhóm docker tương đương quyền quản trị daemon, chỉ dành cho người quản lý máy.

## Chạy bài từ filesystem Linux

Mở `wsl -d Ubuntu-24.04 -u hai`. Clone vào filesystem Linux để giữ quyền và hiệu năng mount:

```sh
mkdir -p ~/projects
cd ~/projects
git clone --branch codex/de16-quan-ly-tai-san https://github.com/dtc245200551-jpg/dtc245200551-de16-quan-ly-tai-san.git de16-quan-ly-tai-san
cd de16-quan-ly-tai-san
sh scripts/start.sh
```

Repository private nên tài khoản clone cần được cấp quyền. Bản nguồn gốc trên máy thực hiện: `/home/hai/projects/de16-quan-ly-tai-san`; từ Explorer Windows mở `\\wsl.localhost\Ubuntu-24.04\home\hai\projects\de16-quan-ly-tai-san`. Không sửa đồng thời một bản sao ở ổ C.

Script luôn chọn `unix:///var/run/docker.sock` của Ubuntu. Kiểm tra bằng:

```sh
systemctl is-active docker
docker info --format '{{.OperatingSystem}} | {{.ServerVersion}} | {{.CgroupVersion}}'
docker compose version
```

Mở Chrome Windows:

| Dịch vụ | Địa chỉ | Tài khoản | Mật khẩu khởi tạo |
|---|---|---|---|
| Hải Asset | http://localhost:8086 | admin | `.local/secrets/admin_password` |
| pgAdmin | http://localhost:8087 | admin@hai.edu.vn | `.local/secrets/pgadmin_password` |
| Grafana | http://localhost:3003 | admin | `.local/secrets/grafana_password` |
| Prometheus | http://localhost:9092 | Không yêu cầu | Chỉ mở localhost |

pgAdmin có sẵn server `postgres:5432`, database `assets`, role `asset_migrate`; mật khẩu kết nối trong `.local/secrets/db_migrate_password`. Role này dùng cho quản trị/migration trong demo, app sử dụng `asset_app` với quyền hạn chế hơn.

`prepare.sh` sinh mật khẩu mạnh và giữ lại khi chạy tiếp. `.local/` và thư mục secrets có mode 0700; file secret 0644 để UID container đọc được qua Compose bind mount. Thư mục cha chặn người dùng Linux khác. Secrets và backup không vào Git. Sau khi đổi mật khẩu trên website, tệp mật khẩu khởi tạo không tự cập nhật.

Đổi cổng bằng cách sao chép `.env.example` thành `.env`. Mặc định web 8086, pgAdmin 8087. Các cổng chỉ bind localhost và được WSL chuyển tiếp sang Windows. PostgreSQL, app, secret và volume thuộc project riêng `de16hai`.

```sh
BASE_ONLY=1 sh scripts/start.sh
sh scripts/stop.sh
```

Dừng giữ dữ liệu, không xóa volume. Các script PowerShell chỉ là wrapper gọi Ubuntu; không gọi Docker Desktop. Không dùng `wsl --shutdown`, `docker system prune` hoặc xóa volume toàn máy để xử lý bài này.

## Nghiệp vụ

Một tài sản là một thiết bị, mã và serial duy nhất. Có bốn trạng thái: sẵn sàng, đang sử dụng, đang bảo trì, ngừng sử dụng. Giá trị/chi phí là VND nguyên không âm.

Lập lịch → bắt đầu → hoàn tất/hủy. Bắt đầu lưu trạng thái trước và chuyển thiết bị sang bảo trì; kết thúc trả lại trạng thái đó. Mỗi thiết bị có tối đa một phiếu đang thực hiện; transaction và khóa dòng bảo vệ thao tác đồng thời. Thiết bị ngừng sử dụng không nhận lịch mới, và còn lịch mở thì chưa thể ngừng sử dụng. Hồ sơ và lịch sử được giữ để đối chiếu.

Seed có 12 thiết bị, 3 danh mục, 3 vị trí và 3 lịch bảo trì. Chạy lại không nhân đôi hoặc đặt lại mật khẩu. Phạm vi một quản trị viên; không có quy trình cấp phát/thu hồi hoặc kế toán khấu hao.

## Bảo mật và cấu trúc

App/Nginx chạy non-root, filesystem chỉ đọc, bỏ capability và bật `no-new-privileges`. PostgreSQL tách role owner, migration, app và exporter. App không có quyền xóa thiết bị/phiếu. Nginx thêm CSP, chống MIME sniffing, chống nhúng iframe và giới hạn body. `/metrics` và `/readyz` bị chặn ở cổng website.

HTTP localhost là cấu hình demo; khi triển khai Internet cần HTTPS và `COOKIE_SECURE=true`. PostgreSQL image khởi tạo bằng root rồi hạ quyền sang postgres; không mô tả toàn bộ container là non-root từ lúc init.

`app/`: ứng dụng, schema, giao diện. `infra/`: cấu hình PostgreSQL, pgAdmin, Nginx. `scripts/`: vận hành Linux và wrapper Windows. `.local/`: secret, kết quả chạy và backup, được Git bỏ qua.

## Giám sát

Prometheus `/targets` có 5 jobs: chính Prometheus, app, Nginx, PostgreSQL và cAdvisor. Grafana tự nạp dashboard **Hải Asset | Thiết bị và vận hành** trong thư mục **Đề 16 Nguyễn Xuân Hải**, gồm 15 panel theo dõi container, HTTP, DB và trạng thái tài sản. Cần ít nhất hai lần scrape để biểu đồ rate có dữ liệu.

```sh
docker compose -f compose.yaml -f compose.monitoring.yaml exec -T app node < scripts/check-monitoring.js
```

Kiểm tra xác nhận target UP, exporter kết nối, RAM thực của app/nginx/postgres có đúng nhãn project và gauge đọc được tài sản từ DB. Chi tiết tại `observability/README.md`. cAdvisor là ngoại lệ: chạy privileged và đọc host cgroup/Docker qua các mount chỉ đọc. Cảnh báo hiện xem tại Prometheus, chưa gửi ra email.

Các mốc tiếp theo bổ sung Loki/Promtail, gia cố/sao lưu/kiểm thử và báo cáo minh chứng.
