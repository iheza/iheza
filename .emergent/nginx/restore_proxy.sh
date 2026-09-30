#!/bin/sh
# Self-healing restore for the IHEZA nginx backend-proxy.
#
# WHY THIS EXISTS
# ---------------
# The supervisor program "backend-proxy" runs:
#     nginx -g "daemon off;" -c /etc/nginx/nginx-backend-proxy.conf
# but /etc is NOT part of the persistent /app PVC. When the preview pod is
# recreated/resumed (roughly weekly), /etc/nginx/nginx-backend-proxy.conf is
# missing, nginx exits immediately ("Exited too quickly"), and every external
# request returns 502/503/520.
#
# This script restores the config from the persistent workspace copy and
# (re)starts the proxy. It is safe to run repeatedly and is wired into cron so
# the proxy self-heals within a minute of any pod resume.
set -eu

SRC=/app/.emergent/nginx/nginx-backend-proxy.conf
DST=/etc/nginx/nginx-backend-proxy.conf
CRON_SRC=/app/.emergent/nginx/iheza-proxy-restore.cron
CRON_DST=/etc/cron.d/iheza-proxy-restore
LOG=/var/log/iheza-proxy-restore.log

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >> "$LOG" 2>/dev/null || true; }

# Heartbeat so we can confirm the cron job is actually firing.
HEARTBEAT=/var/log/iheza-proxy-restore.heartbeat
date +'%Y-%m-%d %H:%M:%S' > "$HEARTBEAT" 2>/dev/null || true

# 0) Self-heal the cron entry itself (so auto-recovery survives pod recreation).

if [ -f "$CRON_SRC" ]; then
    if [ ! -f "$CRON_DST" ] || ! cmp -s "$CRON_SRC" "$CRON_DST"; then
        mkdir -p /etc/cron.d 2>/dev/null || true
        cp "$CRON_SRC" "$CRON_DST" 2>/dev/null || true
        chmod 0644 "$CRON_DST" 2>/dev/null || true
        log "restored $CRON_DST from persistent copy"
    fi
fi

# 1) Restore the config file if it is missing or differs from the persistent copy.

if [ -f "$SRC" ]; then
    if [ ! -f "$DST" ] || ! cmp -s "$SRC" "$DST"; then
        mkdir -p /etc/nginx 2>/dev/null || true
        cp "$SRC" "$DST" 2>/dev/null || true
        log "restored $DST from persistent copy"
    fi
else
    log "ERROR: persistent config $SRC not found"
    exit 1
fi

# 2) Validate the config before touching the running service.
if ! nginx -t -c "$DST" >/dev/null 2>&1; then
    log "ERROR: nginx config test failed for $DST"
    exit 1
fi

# When invoked by the supervisor program command, only restore/validate config.
# Do not call supervisorctl here; supervisor is already starting this program.
if [ "${IHEZA_PROXY_SUPERVISOR_START:-0}" = "1" ]; then
    log "supervisor start mode: config restored and validated; launching nginx"
    exit 0
fi

# 3) Make sure the supervisor program is running.
STATUS="$(supervisorctl status backend-proxy 2>/dev/null || true)"
case "$STATUS" in
    *RUNNING*)
        # Already running — nothing to do.
        ;;
    *)
        log "backend-proxy not running ($STATUS); starting"
        supervisorctl start backend-proxy >> "$LOG" 2>&1 || true
        ;;
esac

# 4) Final health check: is port 80 answering?
if command -v curl >/dev/null 2>&1; then
    CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:80/ 2>/dev/null || echo 000)"
    if [ "$CODE" != "200" ]; then
        log "health check returned $CODE; restarting backend-proxy"
        supervisorctl restart backend-proxy >> "$LOG" 2>&1 || true
    fi
fi

exit 0
