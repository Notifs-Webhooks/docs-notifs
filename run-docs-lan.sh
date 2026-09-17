#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export DOCKER_USER="${DOCKER_USER:-$(id -u)}"
export LAN_HOST="${LAN_HOST:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
LAN_HOST="${LAN_HOST:-127.0.0.1}"

action="${1:-start}"
compose=(docker compose -f compose.yml -f compose.lan.yml)
app_services=(
    app-dev
    celery-dev
    celery-beat-dev
    frontend-development
    y-provider-development
    y-provider-development-converter
    nginx
)

case "$action" in
    start)
        "${compose[@]}" up -d "${app_services[@]}"
        ;;
    restart)
        if [[ -z "$("${compose[@]}" ps --all --quiet app-dev)" ]]; then
            printf 'Docs is not started; run %s without an argument first.\n' "${0##*/}" >&2
            exit 1
        fi
        "${compose[@]}" restart "${app_services[@]}"
        ;;
    send)
        if [[ -z "$("${compose[@]}" ps --quiet app-dev)" ]]; then
            printf 'Docs is not running; start it before forcing a digest check.\n' >&2
            exit 1
        fi
        "${compose[@]}" exec -T app-dev python manage.py send_notification_digests
        exit 0
        ;;
    *)
        printf 'Usage: %s [start|restart|send]\n' "${0##*/}" >&2
        exit 2
        ;;
esac

printf 'Docs:      http://%s:3000\n' "$LAN_HOST"
printf 'API:       http://%s:8071\n' "$LAN_HOST"
printf 'Connexion: http://%s:8083\n' "$LAN_HOST"
