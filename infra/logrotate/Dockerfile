FROM alpine:3.23.3
RUN apk add --no-cache logrotate
COPY config /etc/logrotate.d/hai
CMD ["sh", "-ec", "while :; do logrotate -s /var/lib/logrotate/status /etc/logrotate.d/hai; find /logs/postgres -type f -name 'postgresql-*.json*' -mtime +7 -delete; sleep 60; done"]
