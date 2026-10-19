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

Prometheus `/targets` có 5 jobs: chính Prometheus, app, Nginx, PostgreSQL và cAdvisor. Grafana tự nạp dashboard **Hải Asset | Thiết bị và vận hành** trong thư mục **Đề 16 Nguyễn Xuân Hải**, gồm 18 panel theo dõi container, HTTP, DB và trạng thái tài sản. Cần ít nhất hai lần scrape để biểu đồ rate có dữ liệu.

```sh
docker compose -f compose.yaml -f compose.monitoring.yaml exec -T app node < scripts/check-monitoring.js
```

Kiểm tra xác nhận target UP, exporter kết nối, RAM thực của app/nginx/postgres có đúng nhãn project và gauge đọc được tài sản từ DB. Chi tiết tại `observability/README.md`. cAdvisor là ngoại lệ: chạy privileged và đọc host cgroup/Docker qua các mount chỉ đọc. Cảnh báo hiện xem tại Prometheus, chưa gửi ra email.

## Log tập trung

Loki + Promtail đọc log JSON app, access log Nginx và JSON log PostgreSQL từ các volume riêng. Grafana có datasource Loki và 3 panel log bổ sung. Xem ba truy vấn đã kiểm chứng ở `observability/logql.md`.

```sh
docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml exec -T app node < scripts/check-logs.js
```

Cần tạo sự kiện bảo trì và thử dữ liệu không hợp lệ trước khi kiểm tra. Logrotate xoay file 5 MB, giữ 3 bản; Loki giữ 7 ngày. Promtail mount chỉ đọc log volume, có volume lưu vị trí đọc; không mount Docker socket. Công cụ đã EOL 02/03/2026, được giữ theo đề; hướng thay thế Grafana Alloy được ghi trong báo cáo.

## Kiểm thử và gia cố

```sh
sh scripts/test.sh
python3 scripts/check-hardening.py
```

Bộ kiểm thử gồm 25 trường hợp qua HTTP thật và PostgreSQL: xác thực/CSRF, CRUD danh mục và vị trí, mã/serial trùng, ngày/tiền sai, chống mất cập nhật, tìm kiếm tham số hóa, bắt đầu bảo trì đồng thời, hoàn tất/hủy, ngừng sử dụng, headers/cookie, quyền DB và vô hiệu hóa phiên khi đổi mật khẩu. Dữ liệu QA có tiền tố riêng, được dọn sau mỗi lần chạy; mật khẩu admin chính không đổi. Kết quả lưu tại `.local/test-results/`.

App/Nginx dùng non-root, root filesystem chỉ đọc, bỏ capabilities và no-new-privileges. Container có giới hạn RAM/PID. Schema public chỉ cấp quyền cho role cần thiết; migration sở hữu các bảng, app không được xóa hồ sơ hoặc tạo bảng, exporter chỉ có pg_monitor. Secrets nằm ngoài Git, mật khẩu được băm bằng scrypt; form có CSRF và giới hạn đăng nhập 15 lần/15 phút theo IP qua Nginx. Không log mật khẩu, body hoặc cookie.

Ngoại lệ cần hiểu: storage init dùng root và CHOWN/FOWNER/DAC_OVERRIDE để chuẩn bị volume; logrotate dùng quyền hẹp trên ba volume log; PostgreSQL bootstrap bắt đầu root rồi chuyển postgres; cAdvisor privileged và có Docker socket nên là thành phần quản trị được tin cậy. Cấu hình demo chưa phải dịch vụ Internet có HTTPS.

## Sao lưu và phục hồi

```sh
sh scripts/backup.sh
sh scripts/restore.sh --verify-current .local/backups/<ten-tep>.dump
sh scripts/restore.sh --verify .local/backups/<ban-cu>.dump
```

Backup là archive PostgreSQL dạng custom và SHA-256, giữ schema, dữ liệu, ownership và ACL. File chứa tài khoản/phiên nên được tạo với quyền 0600 trong thư mục riêng. `--verify` phục hồi vào database tạm rồi tự dọn; `--verify-current` yêu cầu dữ liệu nghiệp vụ khớp database hiện tại, phù hợp để kiểm chứng bản vừa sao lưu khi không có người đang sửa dữ liệu.

Chỉ khi cần thay dữ liệu hiện có:

```sh
sh scripts/restore.sh --apply .local/backups/<ten-tep>.dump
```

Lệnh kiểm tra archive ở database tạm trước, yêu cầu nhập `PHUC HOI HAI`, dừng app/Nginx rồi phục hồi cả quyền và dữ liệu. Nếu lỗi, ứng dụng giữ trạng thái dừng để kiểm tra. Mật khẩu tài khoản theo bản sao lưu; các file mật khẩu khởi tạo không tự viết lại. Bài đã kiểm chứng phục hồi ở DB tạm và đối chiếu 12 thiết bị/3 phiếu cùng nội dung dữ liệu; không phục hồi đè database demo.

## WSL2 và xử lý lỗi

Giữ cửa sổ Ubuntu mở khi dùng lệnh Linux. Wrapper PowerShell `scripts/start.ps1` tạo một tiến trình WSL ẩn để giữ distro hoạt động; `scripts/stop.ps1` chỉ dừng tiến trình do wrapper ghi nhận và giữ các volume. Daemon do systemd quản lý. Không shutdown toàn bộ WSL để dừng bài.

- Không kết nối daemon: trong PowerShell chạy `wsl -d Ubuntu-24.04 -u root -- systemctl start docker`, sau đó kiểm tra `DOCKER_HOST` trỏ socket Ubuntu.
- Xem dịch vụ/log với `docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml ps -a` và `logs --tail 50 <service>`.
- pgAdmin dùng tài khoản `admin@hai.edu.vn`; mật khẩu kết nối PostgreSQL khác mật khẩu đăng nhập pgAdmin.
- Thiếu biểu đồ rate: chờ hai chu kỳ scrape rồi kiểm tra target và đúng nhãn project; không chỉ nhìn UP.
- Thiếu log: tạo thao tác mới, xem khoảng thời gian, Promtail và quyền file; Nginx phải ghi file thường, không trỏ symlink stdout.
- Không đổi secret PostgreSQL sau khi tạo volume vì mật khẩu role đã lưu trong database. Dừng bình thường không xóa dữ liệu.

Mốc cuối bổ sung báo cáo Word, sơ đồ, ảnh minh chứng và kịch bản demo.
