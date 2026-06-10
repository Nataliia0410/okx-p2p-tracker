from google import genai
from google.genai import types
import json
import os
from pathlib import Path

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

HISTORY_PROMPT = """
Ти парсиш скріншот з OKX, розділ "Історія" (фандинг-акаунт).

Витягни всі транзакції та поверни JSON масив. Для кожної:
{
  "type": один з ["buy_usdt", "deposit", "withdrawal", "cancel_order", "internal", "other"],
  "date": "YYYY-MM-DD HH:MM",
  "usdt_amount": число (абсолютне значення),
  "direction": "in" або "out",
  "description": оригінальна назва операції
}

Маппінг:
- "Разместить ордер" з мінусом → type="buy_usdt", direction="out"
- "Отменить ордер" з плюсом → type="cancel_order", direction="in"
- "Внесение средств" з плюсом → type="deposit", direction="in"
- "Получено с торгового аккаунта" або "Переведено на торговый аккаунт" → type="internal"
- Інше → type="other"

Місяці (рос): января=01, февраля=02, марта=03, апреля=04, мая=05, июня=06, июля=07, августа=08, сентября=09, октября=10, ноября=11, декабря=12.
Формат дати у скрині: "6 июня 2026 г., 07:22" → "2026-06-06 07:22"

Поверни ТІЛЬКИ валідний JSON масив, без пояснень.
"""

ORDERS_PROMPT = """
Ти парсиш скріншот з OKX, розділ "Ордера → Завершено" (P2P ордери).

Витягни всі ордери та поверни JSON масив. Для кожного:
{
  "type": "sell_usdt" або "buy_usdt",
  "date": "YYYY-MM-DD HH:MM",
  "usdt_amount": число USDT,
  "uah_amount": число UAH,
  "price_per_usdt": ціна за 1 USDT в UAH,
  "counterparty": нік/ім'я контрагента (якщо видно),
  "status": "completed" або "cancelled"
}

- "Продать USDT" → type="sell_usdt"
- "Купить USDT" → type="buy_usdt"
- "Выполнено" → status="completed"
- "Отменено" → status="cancelled"
- Формат дати: "08.06.2026, 07:07" → "2026-06-08 07:07"

Поверни ТІЛЬКИ валідний JSON масив, без пояснень.
"""


def parse_screenshot(image_path: str, screenshot_type: str) -> list[dict]:
    prompt = HISTORY_PROMPT if screenshot_type == "history" else ORDERS_PROMPT
    suffix = Path(image_path).suffix.lower()
    mime = "image/png" if suffix == ".png" else "image/jpeg"

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime),
            prompt,
        ],
    )

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())
