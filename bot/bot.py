import asyncio
import os
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, Router
from aiogram.filters import Command
from aiogram.types import Message
import watcher

load_dotenv()

BOT_TOKEN = os.environ["BOT_TOKEN"]
POLL_INTERVAL = 30

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)

subscribed_chats: set[int] = set()
seen_event_ids: set[str] = set()


def _progress_bar(filled: int, total: int = 10) -> str:
    filled = max(0, min(filled, total))
    return "█" * filled + "░" * (total - filled)


def _format_launch(launch: dict) -> str:
    lid = launch.get("id", "?")
    ledger = launch.get("ledger", "?")
    return f"*Launch* `{lid}` — ledger {ledger}"


@router.message(Command("start"))
async def cmd_start(message: Message):
    await message.answer(
        "*LumenMarket Bot*\n\n"
        "/launches — list recent launches\n"
        "/price <id> — show price for a launch\n"
        "/subscribe — get alerts for new launches & migrations",
        parse_mode="Markdown",
    )


@router.message(Command("launches"))
async def cmd_launches(message: Message):
    launches = await watcher.get_launches()
    if not launches:
        await message.answer("No launches found.")
        return
    lines = [_format_launch(l) for l in launches[-10:]]
    await message.answer("\n".join(lines), parse_mode="Markdown")


@router.message(Command("price"))
async def cmd_price(message: Message):
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2 or not parts[1].isdigit():
        await message.answer("Usage: /price <launch_id>")
        return
    launch_id = int(parts[1])
    price = await watcher.get_launch_price(launch_id)
    bar = _progress_bar(int(price * 10) % 11)
    await message.answer(
        f"*Launch* `{launch_id}`\nPrice: *{price:.7f} XLM*\n{bar}",
        parse_mode="Markdown",
    )


@router.message(Command("subscribe"))
async def cmd_subscribe(message: Message):
    chat_id = message.chat.id
    if chat_id in subscribed_chats:
        await message.answer("Already subscribed.")
    else:
        subscribed_chats.add(chat_id)
        await message.answer("Subscribed to launch & migration alerts.")


async def _poll():
    while True:
        await asyncio.sleep(POLL_INTERVAL)
        if not subscribed_chats:
            continue
        try:
            launches = await watcher.get_launches()
            for launch in launches:
                eid = f"L:{launch['id']}"
                if eid not in seen_event_ids:
                    seen_event_ids.add(eid)
                    text = f"🚀 *New Launch!*\n{_format_launch(launch)}"
                    for chat_id in list(subscribed_chats):
                        await bot.send_message(chat_id, text, parse_mode="Markdown")

            migrations = await watcher.get_migrations()
            for m in migrations:
                eid = f"M:{m['id']}"
                if eid not in seen_event_ids:
                    seen_event_ids.add(eid)
                    text = f"✅ *Migrated to DEX!*\nEvent `{m['id']}` — ledger {m['ledger']}"
                    for chat_id in list(subscribed_chats):
                        await bot.send_message(chat_id, text, parse_mode="Markdown")
        except Exception as e:
            print(f"[poll] error: {e}")


async def main():
    asyncio.create_task(_poll())
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
