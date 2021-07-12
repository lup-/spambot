from telethon import TelegramClient

from telethon.tl.functions.channels import JoinChannelRequest, LeaveChannelRequest
from telethon.tl.functions.messages import ImportChatInviteRequest, CheckChatInviteRequest, GetAdminsWithInvitesRequest, GetChatInviteImportersRequest
from telethon.tl.types import PeerUser, PeerChat, PeerChannel, InputUserEmpty
from telethon import functions, types, errors

from sanic import Sanic
from sanic.response import json
from ttjson import ttjson
from functools import partial
import asyncio
import os
import logging
import datetime

logging.basicConfig(level=logging.DEBUG)

API_ID = os.environ['API_ID']
API_HASH = os.environ['API_HASH']
PHONE_NUMBER = os.environ['API_PHONE']
SECRET_HASH = os.environ['SECRET_HASH']

app = Sanic(name=__name__)

async def get_chat_by_id(chat_id, client):
    try:
        chat = await client.get_entity(PeerChat(chat_id))
        return chat
    except Exception:
        pass

    try:
        channel = await client.get_entity(PeerChannel(chat_id))
        return channel
    except Exception:
        pass

    return None


async def get_chat_by_something(something, client):
    chat = await get_chat_by_id(something, client)

    if chat is None:
        try:
            something = something.replace('https://t.me/joinchat/', '')
            something = something.replace('https://t.me/', '')
            something = something.replace('@', '')

            chat = await client.get_entity(something)
        except Exception:
            pass

    return chat


async def join_chat(chat_id, client):
    try:
        channel = await client.get_entity(chat_id)
        info = None
        if channel is not None:
            info = await client(JoinChannelRequest(channel))

        return info
    except Exception:
        return None


async def leave_chat(chat_id, client):
    channel = await get_chat_by_id(chat_id, client)
    if channel is not None:
        info = await client(LeaveChannelRequest(channel))
    return info


async def wait_code(sanic_app):
    logging.critical("Waiting for code...")

    loop = asyncio.get_event_loop()
    code_future = app.ctx.code_future
    if not code_future.done():
        code = await code_future
        return code.decode('utf-8')
    else:
        app.ctx.code_future = loop.create_future()


async def connect_tg_client():
    loop = asyncio.get_event_loop()
    app.ctx.code_future = loop.create_future()

    tg_client = TelegramClient('userbot', API_ID, API_HASH)
    connected = False
    while not connected:
        try:
            app.ctx.tg_client = await tg_client.start(phone=PHONE_NUMBER, code_callback=partial(wait_code, app))
            connected = True
        except Exception as e:
            logging.critical(str(e))
            app.ctx.code_future = loop.create_future()


@app.listener('after_server_stop')
async def stop_tg_client(sanic_app, loop):
    if hasattr(sanic_app.ctx, 'tg_client'):
        tg_client = sanic_app.ctx.tg_client
        if tg_client and tg_client.is_connected():
            await tg_client.disconnect()


@app.middleware('request')
async def add_tg_client(request):
    if hasattr(app.ctx, 'tg_client'):
        request.ctx.tg_client = app.ctx.tg_client
    elif request.path != "/code":
        return json({"error": "Client not started!"})


@app.route('/me')
async def get_me(request):
    me = await request.ctx.tg_client.get_me()
    json_me = ttjson(me) if me else False
    return json({"me": json_me})


@app.route('/code', methods=['POST'])
async def get_code(request):
    code = request.body
    if app.ctx.code_future:
        app.ctx.code_future.set_result(code)
        return json({"ok": True})
    else:
        return json({"ok": False})


@app.route('/initBot', methods=['POST'])
async def init_bot(request):
    bot = request.json['bot']
    client = request.ctx.tg_client
    searchInfo = await client.get_entity(bot['username'])
    info = await client.send_message(searchInfo, '/start '+SECRET_HASH)
    me = await client.get_me()

    return json({
        "info": ttjson(info),
        "searchInfo": ttjson(searchInfo),
        "bot": bot,
        "me": ttjson(me)
    })


@app.route('/chatByInvite', methods=['POST'])
async def find_chat_by_invite(request):
    link = request.json['link']
    hash = link.replace('https://t.me/joinchat/', '')
    client = request.ctx.tg_client

    try:
        info = await client(ImportChatInviteRequest(hash=hash))
        chat = info.chats[0]
    except Exception:
        info = await client(CheckChatInviteRequest(hash=hash))
        chat = info.chat

    await leave_chat(chat.id, client)

    return json({"info": ttjson(chat)})


@app.route('/chatByUsername', methods=['POST'])
async def find_chat_by_username(request):
    username = request.json['username']
    username = username.replace('https://t.me/', '')
    username = username.replace('@', '')
    chat = await request.ctx.tg_client.get_entity(username)

    return json({"info": ttjson(chat) if chat is not None else False})


@app.route('/chatByChatId', methods=['POST'])
async def find_chat_by_id(request):
    chat_id = request.json['id']
    chat = await get_chat_by_id(chat_id, request.ctx.tg_client)

    return json({"info": ttjson(chat) if chat is not None else False})


@app.route('/chatStat', methods=['POST'])
async def get_chat_stat(request):
    return json({"ok": True})


@app.route('/joinChat', methods=['POST'])
async def join_chat_route(request):
    chat_id = request.json['chat_id']
    info = await join_chat(chat_id, request.ctx.tg_client)
    return json({"info": ttjson(info)})


@app.route('/leaveChat', methods=['POST'])
async def leave_chat_route(request):
    chat_id = request.json['chat_id']
    info = await leave_chat(chat_id, request.ctx.tg_client)
    return json({"info": ttjson(info)})


@app.route('/linksStat', methods=['POST'])
async def get_link_stat(request):
    link = request.json['link']
    hash = link.replace('https://t.me/joinchat/', '')
    client = request.ctx.tg_client
    info = await client(CheckChatInviteRequest(hash=hash))
    chat = info.chat
    tomorrow = datetime.date.today() + datetime.timedelta(days=1)

    try:
        info = await client(GetChatInviteImportersRequest(
            peer=chat,
            link=link,
            offset_date=tomorrow,
            offset_user=InputUserEmpty(),
            limit=100
        ))
    except Exception:
        info = False

    return json({"info": ttjson(info) if info else False})


@app.route('/generateLink', methods=['POST'])
async def generate_link(request):
    chat_id = request.json['chatId']
    time_limit_in_hours = request.json['timeLimitInHours']
    member_limit = request.json['usersLimit']

    client = request.ctx.tg_client
    chat = await get_chat_by_something(chat_id, client)

    expire_date = None
    if time_limit_in_hours > 0:
        now = datetime.datetime.now()
        hours_added = datetime.timedelta(hours=time_limit_in_hours)
        expire_date = now + hours_added

    client = request.ctx.tg_client
    invite = await client(functions.messages.ExportChatInviteRequest(
        peer=chat,
        expire_date=expire_date,
        usage_limit=member_limit
    ))

    return json({"invite": ttjson(invite)})


@app.route('/revokeLink', methods=['POST'])
async def revoke_link(request):
    chat_id = request.json['chatId']
    link = request.json['link']

    client = request.ctx.tg_client
    chat = await get_chat_by_something(chat_id, client)
    needs_delete = False
    is_deleted = False

    try:
        revoked_invite = await client(functions.messages.EditExportedChatInviteRequest(
            peer=chat,
            link=link,
            revoked=True,
        ))
        needs_delete = True
    except errors.rpcerrorlist.InviteHashExpiredError:
        needs_delete = False
        is_deleted = True

    if needs_delete:
        is_deleted = await client(functions.messages.DeleteExportedChatInviteRequest(
            peer=chat,
            link=link
        ))

    return json({"isDeleted": is_deleted})

app.add_task(connect_tg_client())
app.run(host='0.0.0.0', port=3000)
