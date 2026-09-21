import json
import os
import secrets
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


ROOT = os.path.dirname(os.path.abspath(__file__))
RESERVATIONS_FILE = os.path.join(ROOT, "reservations.jsonl")


class ZuiRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_POST(self):
        if self.path != "/api/reservations":
            self.send_error(404, "Endpoint not found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
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

    def send_json(self, status, body):
        response = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)


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
    port = int(os.getenv("ZUI_PORT", "8000"))
    print(f"ZUII server running at http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), ZuiRequestHandler).serve_forever()
