import {
    makeWASocket,
    useMultiFileAuthState,
    generateWAMessageFromContent,
    DisconnectReason,
    Browsers,
    prepareWAMessageMedia,
} from "baileys";
import { createInterface } from "node:readline";
import { keepAlive } from "./server.js";
import { Boom } from "@hapi/boom";
import { pino } from "pino";
import { randomBytes } from "crypto";
import fs from 'fs/promises';
import path from 'path';

// Settings bot
const config = {
    botName: 'Kenshin Bot',
    ownerNumber: '6281310994964', // Nomermu
    prefix: '!',
    version: '1.0.0',
    groupLink: 'https://chat.whatsapp.com/HfHcf1Cjv1A9OrUkAjbzqv',
    githubRepo: 'https://github.com/kenshinaru'
};

// Fungsi Logger
const logger = pino({
    level: 'silent',
    transport: {
        target: 'pino-pretty'
    }
});

// Fungsi Koneksi 
async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const browser = Browsers.appropriate("chrome");

    const client = makeWASocket({
        logger: pino({ level: "silent" }),
        mobile: false,
        auth: state,
        browser
    });

    client.ev.on("messages.upsert", async ({ type, messages }) => {
        if (!messages[0]?.message) return;
        if (type !== "notify") return;
        if (messages[0]?.key?.fromMe) return;

        const msg = messages[0];
        const from = msg.key.remoteJid;
        const body = msg.message?.conversation || 
                    msg.message?.imageMessage?.caption || 
                    msg.message?.videoMessage?.caption || 
                    msg.message?.extendedTextMessage?.text || '';

        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            switch(command) {
                case 'button1':
                    await sendQuickReplyButton(client, from);
                    break;
                case 'button2':
                    await sendCopyCodeButton(client, from);
                    break;
                case 'button3':
                    await sendCallButton(client, from);
                    break;
                case 'button4':
                    await sendInteractiveButton(client, from);
                    break;
                default:
                    await client.sendMessage(from, { text: `commands tidak tersedia: ${command}` });
                    break;
            }
        }
    });

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const shouldReconnect = 
                (lastDisconnect.error instanceof Boom)?.output?.statusCode !== 
                DisconnectReason.loggedOut;

            if (shouldReconnect) {
                startSock();
            }
        } else if (connection === "open") {
            keepAlive();
            console.log("Bot terhubung");
        }
    });

    client.ev.on("creds.update", saveCreds);
}

// Fungsi pembantu untuk button
async function sendQuickReplyButton(client, jid) {
    const messageContent = {
        interactiveMessage: {
            body: { text: 'Contoh tombol balasan cepat' },
            nativeFlowMessage: {
                buttons: [
                    {
                        buttonParamsJson: JSON.stringify({
                            display_text: "Balas sekarang!",
                            id: "quick_reply_option",
                        }),
                        name: "quick_reply",
                    },
                ],
                messageParamsJson: "{}",
                messageVersion: 1,
            },
        },
    };

    const proto = generateWAMessageFromContent(jid, messageContent, { userJid: client.user.id });
    await client.relayMessage(jid, proto.message, { messageId: proto.key.id });
}

async function sendCopyCodeButton(client, jid) {
    const messageContent = {
        interactiveMessage: {
            body: { text: 'Contoh tombol untuk menyalin kode' },
            nativeFlowMessage: {
                buttons: [
                    {
                        buttonParamsJson: JSON.stringify({
                            display_text: "Salin kode ini",
                            id: "copy_code",
                            copy_code: "123456",
                        }),
                        name: "cta_copy",
                    },
                ],
                messageParamsJson: "{}",
                messageVersion: 1,
            },
        },
    };

    const proto = generateWAMessageFromContent(jid, messageContent, { userJid: client.user.id });
    await client.relayMessage(jid, proto.message, { messageId: proto.key.id });
}

async function sendCallButton(client, jid) {
    const messageContent = {
        interactiveMessage: {
            body: { text: 'Contoh tombol untuk panggilan' },
            nativeFlowMessage: {
                buttons: [
                    {
                        buttonParamsJson: JSON.stringify({
                            display_text: "Hubungi Dukungan",
                            phone_number: "1234567890",
                        }),
                        name: "cta_call",
                    },
                ],
                messageParamsJson: "{}",
                messageVersion: 1,
            },
        },
    };

    const proto = generateWAMessageFromContent(jid, messageContent, { userJid: client.user.id });
    await client.relayMessage(jid, proto.message, { messageId: proto.key.id });
}

async function sendInteractiveButton(client, jid) {
    const sections = [
        {
            title: "Opsi Lanjutan",
            rows: [
                { title: "Pilihan 1", description: "Deskripsi Pilihan 1", id: "pilihan_1" },
                { title: "Pilihan 2", description: "Deskripsi Pilihan 2", id: "pilihan_2" },
            ],
        },
    ];

    const messageContent = {
        interactiveMessage: {
            body: { text: 'Contoh tombol interaktif dengan opsi' },
            nativeFlowMessage: {
                buttons: [
                    {
                        name: "single_select",
                        buttonParamsJson: JSON.stringify({
                            title: "Menu Opsi",
                            sections: sections,
                        }),
                    },
                ],
                messageParamsJson: "{}",
                messageVersion: 1,
            },
        },
    };

    const proto = generateWAMessageFromContent(jid, messageContent, { userJid: client.user.id });
    await client.relayMessage(jid, proto.message, { messageId: proto.key.id });
}

// Iniciar el bot
await startSock();
