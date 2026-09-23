import json
import os
import secrets
import smtplib
import time
from http import cookies
from urllib.parse import urlparse
from datetime import datetime, timezone
from email.message import EmailMessage
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


ROOT = os.path.dirname(os.path.abspath(__file__))
RESERVATIONS_FILE = os.path.join(ROOT, "reservations.jsonl")
IS_PRODUCTION = os.getenv("ZUI_ENV", "development").lower() == "production"
STAFF_USERNAME = os.getenv("ZUI_STAFF_USERNAME", "")
STAFF_PASSWORD = os.getenv("ZUI_STAFF_PASSWORD", "")
if not IS_PRODUCTION:
    STAFF_USERNAME = STAFF_USERNAME or "staff"
    STAFF_PASSWORD = STAFF_PASSWORD or "zuii-staff"
if IS_PRODUCTION and (not STAFF_USERNAME or not STAFF_PASSWORD):
    raise RuntimeError("ZUI_STAFF_USERNAME and ZUI_STAFF_PASSWORD are required in production.")
STAFF_COOKIE_SECURE = IS_PRODUCTION
STAFF_SESSION_TTL = 8 * 60 * 60
STAFF_SESSIONS = {}
FAILED_LOGINS = {}
MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 15 * 60
MAX_REQUEST_BODY_BYTES = 32 * 1024


class ZuiRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/staff/login":
            self.handle_staff_login()
            return
        if path == "/api/staff/logout":
            self.handle_staff_logout()
            return
        if path != "/api/reservations":
            self.send_error(404, "Endpoint not found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length > MAX_REQUEST_BODY_BYTES:
                self.send_json(413, {"error": "Request payload is too large."})
                return
            payload = json.loads(self.rfile.read(content_length))
            reservation = validate_reservation(payload)
            reservation["reference"] = f"ZUII-{secrets.token_hex(4).upper()}"
            reservation["received_at"] = datetime.now(timezone.utc).isoformat()
            with open(RESERVATIONS_FILE, "a", encoding="utf-8") as file:
                file.write(json.dumps(reservation, ensure_ascii=False) + "\n")
            notify_restaurant(reservation)
            self.send_json(201, {"reference": reservation["reference"]})
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(500, {"error": "The reservation could not be received. Please try again."})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_security_headers()
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/staff/session":
            self.send_json(200, {"authenticated": self.is_staff_authenticated()})
            return
        if path == "/api/staff/reservations":
            if not self.is_staff_authenticated():
                self.send_json(401, {"error": "Staff authentication required."})
                return
            self.send_json(200, {"reservations": load_reservations()})
            return
        super().do_GET()

    def handle_staff_login(self):
        now = time.time()
        client_ip = self.client_address[0]
        attempts = [
            timestamp for timestamp in FAILED_LOGINS.get(client_ip, [])
            if now - timestamp < LOGIN_WINDOW_SECONDS
        ]
        FAILED_LOGINS[client_ip] = attempts
        if len(attempts) >= MAX_LOGIN_ATTEMPTS:
            self.send_json(429, {"error": "Too many login attempts. Please try again later."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length > MAX_REQUEST_BODY_BYTES:
                self.send_json(413, {"error": "Request payload is too large."})
                return
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict):
                raise ValueError
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", ""))
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Please enter a valid username and password."})
            return

        if not (
            secrets.compare_digest(username, STAFF_USERNAME)
            and secrets.compare_digest(password, STAFF_PASSWORD)
        ):
            FAILED_LOGINS[client_ip].append(now)
            self.send_json(401, {"error": "Invalid staff credentials."})
            return

        session_id = secrets.token_urlsafe(32)
        STAFF_SESSIONS[session_id] = now + STAFF_SESSION_TTL
        FAILED_LOGINS.pop(client_ip, None)
        secure = "; Secure" if STAFF_COOKIE_SECURE else ""
        self.send_json(
            200,
            {"authenticated": True},
            f"zuii_staff={session_id}; Path=/; HttpOnly; SameSite=Lax{secure}",
        )

    def handle_staff_logout(self):
        session_id = self.get_staff_session()
        if session_id:
            STAFF_SESSIONS.pop(session_id, None)
        secure = "; Secure" if STAFF_COOKIE_SECURE else ""
        self.send_json(
            200,
            {"authenticated": False},
            f"zuii_staff=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax{secure}",
        )

    def get_staff_session(self):
        parsed = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        morsel = parsed.get("zuii_staff")
        return morsel.value if morsel else None

    def is_staff_authenticated(self):
        session_id = self.get_staff_session()
        expires_at = STAFF_SESSIONS.get(session_id) if session_id else None
        if not expires_at:
            return False
        if expires_at <= time.time():
            STAFF_SESSIONS.pop(session_id, None)
            return False
        return True

    def send_json(self, status, body, set_cookie=None):
        response = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_security_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_cors_headers()
        self.send_header("Content-Length", str(len(response)))
        if set_cookie:
            self.send_header("Set-Cookie", set_cookie)
        self.end_headers()
        self.wfile.write(response)

    def send_security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")

    def send_cors_headers(self):
        origin = self.headers.get("Origin")
        allowed_origin = os.getenv("ZUI_ALLOWED_ORIGIN", "").rstrip("/")
        local_origin = origin and (
            origin.startswith("http://localhost:")
            or origin.startswith("http://127.0.0.1:")
        )
        if origin and (origin == allowed_origin or (not IS_PRODUCTION and local_origin)):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")


# Deployment platforms can discover this top-level request handler automatically.
handler = ZuiRequestHandler


def validate_reservation(payload):
    required = ("date", "time", "guests", "name", "phone", "email")
    if not isinstance(payload, dict) or any(not str(payload.get(field, "")).strip() for field in required):
        raise ValueError("Please complete all required reservation fields.")
    reservation = {field: str(payload.get(field, "")).strip() for field in (*required, "requests")}

    normalized_date = reservation["date"]
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            normalized_date = datetime.strptime(reservation["date"], fmt).strftime("%d/%m/%Y")
            break
        except ValueError:
            continue
    else:
        raise ValueError("Please choose a valid reservation date and time.")

    try:
        reservation_datetime = datetime.strptime(
            f"{normalized_date} {reservation['time']}", "%d/%m/%Y %H:%M"
        ).astimezone()
    except ValueError as error:
        raise ValueError("Please choose a valid reservation date and time.") from error

    if reservation_datetime <= datetime.now().astimezone():
        raise ValueError("Please choose a future reservation date and time.")

    reservation["date"] = normalized_date
    return reservation


def load_reservations():
    if not os.path.exists(RESERVATIONS_FILE):
        return []
    reservations = []
    with open(RESERVATIONS_FILE, "r", encoding="utf-8") as file:
        for line in file:
            if not line.strip():
                continue
            try:
                reservations.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return list(reversed(reservations))


def notify_restaurant(reservation):
    smtp_host = os.getenv("ZUI_SMTP_HOST")
    restaurant_email = os.getenv("ZUI_RESTAURANT_EMAIL")
    if not smtp_host or not restaurant_email:
        return

    message = EmailMessage()
    message["Subject"] = f"New ZUII reservation request — {reservation['reference']}"
    message["From"] = os.getenv("ZUI_SMTP_FROM", restaurant_email)
    message["To"] = restaurant_email
    message.set_content("\n".join(f"{key.title()}: {value}" for key, value in reservation.items()))
    with smtplib.SMTP(smtp_host, int(os.getenv("ZUI_SMTP_PORT", "587")), timeout=15) as smtp:
        smtp.starttls()
        smtp.login(os.getenv("ZUI_SMTP_USERNAME", ""), os.getenv("ZUI_SMTP_PASSWORD", ""))
        smtp.send_message(message)


if __name__ == "__main__":
    host = os.getenv("ZUI_HOST", "0.0.0.0" if os.getenv("PORT") else "127.0.0.1")
    port = int(os.getenv("PORT", os.getenv("ZUI_PORT", "8000")))
    print(f"ZUII server running at http://{host}:{port}")
    ThreadingHTTPServer((host, port), ZuiRequestHandler).serve_forever()
