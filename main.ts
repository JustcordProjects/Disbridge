import * as fs from 'node:fs';
import * as dsc from 'discord.js';
import process from "node:process";


interface BotServerConfiguration {
    bridgedChannels: string[];
    administrators: string[];
    serverId: string;
}

interface BotConfiguration {
    servers: BotServerConfiguration[];
    botAdmins: string[];
}

const DEFAULT_CONF: BotConfiguration = {
    servers: [],
    botAdmins: ['990959984005222410']
};

if (!fs.existsSync('bot') || !fs.existsSync('bot/.token')) {
    console.error('musisz stworzyć folder bot z plikiem .token z tokenem bota Discorda');
    process.exit(1);
}

class ConfigurationManager {
    private conf: BotConfiguration;

    constructor() {
        if (!fs.existsSync('bot/configuration.json')) {
            fs.writeFileSync(
                'bot/configuration.json',
                JSON.stringify(DEFAULT_CONF, null, 4)
            );
        }

        this.conf = JSON.parse(
            fs.readFileSync('bot/configuration.json', 'utf8')
        );

        setInterval(() => {
            fs.writeFileSync(
                'bot/configuration.json',
                JSON.stringify(this.conf, null, 4)
            );
        }, 5000);
    }

    private ensureServer(serverId: string): BotServerConfiguration {
        let server = this.conf.servers.find(
            s => s.serverId === serverId
        );

        if (!server) {
            server = {
                serverId,
                administrators: [],
                bridgedChannels: []
            };

            this.conf.servers.push(server);
        }

        return server;
    }

    addBotAdministrator(id: string): boolean {
        if (this.conf.botAdmins.includes(id))
            return false;

        this.conf.botAdmins.push(id);
        return true;
    }

    removeBotAdministrator(id: string): boolean {
        const index = this.conf.botAdmins.indexOf(id);

        if (index === -1)
            return false;

        this.conf.botAdmins.splice(index, 1);
        return true;
    }

    isBotAdministrator(id: string): boolean {
        return this.conf.botAdmins.includes(id);
    }

    addServerAdministrator(serverId: string, id: string): boolean {
        const server = this.ensureServer(serverId);

        if (server.administrators.includes(id))
            return false;

        server.administrators.push(id);
        return true;
    }

    removeServerAdministrator(serverId: string, id: string): boolean {
        const server = this.ensureServer(serverId);

        const index = server.administrators.indexOf(id);

        if (index === -1)
            return false;

        server.administrators.splice(index, 1);
        return true;
    }

    setServerAdministrators(
        serverId: string,
        administrators: string[]
    ): boolean {
        const server = this.ensureServer(serverId);
        server.administrators = [...new Set(administrators)];
        return true;
    }

    getServerAdministrators(serverId: string): string[] {
        return this.ensureServer(serverId).administrators;
    }

    addBridgedChannel(serverId: string, channelId: string): boolean {
        const server = this.ensureServer(serverId);

        if (server.bridgedChannels.includes(channelId))
            return false;

        server.bridgedChannels.push(channelId);
        return true;
    }

    removeBridgedChannel(serverId: string, channelId: string): boolean {
        const server = this.ensureServer(serverId);

        const index = server.bridgedChannels.indexOf(channelId);

        if (index === -1)
            return false;

        server.bridgedChannels.splice(index, 1);
        return true;
    }

    setBridgedChannels(
        serverId: string,
        channels: string[]
    ): boolean {
        const server = this.ensureServer(serverId);
        server.bridgedChannels = [...new Set(channels)];
        return true;
    }

    getBridgedChannels(serverId: string): string[] {
        return this.ensureServer(serverId).bridgedChannels;
    }

    getConfiguration(): BotConfiguration {
        return this.conf;
    }
}

class DisbridgeBot extends ConfigurationManager {
    private discord_client: dsc.Client;

    constructor() {
        super();

        this.discord_client = new dsc.Client({
            intents: [
                dsc.GatewayIntentBits.Guilds, dsc.GatewayIntentBits.GuildMembers,
                dsc.GatewayIntentBits.GuildMessages, dsc.GatewayIntentBits.MessageContent,
                dsc.GatewayIntentBits.GuildMembers
            ],
            partials: [
                dsc.Partials.Message, dsc.Partials.GuildMember, dsc.Partials.User
            ]
        });
        this.initializeDiscordHandlers();
    }

    public login() {
        this.discord_client.login(fs.readFileSync('bot/.token', 'utf8').trim());
    }

    private async discordMessageHandler(msg: dsc.Message) {
        if (msg.partial) return; // this should not happen since we set message partial 
        if (msg.author.bot || !msg.inGuild()) return;
        
        const bridged_channels = this.getBridgedChannels(msg.guildId);
        if (msg.content?.startsWith('dbr!') && bridged_channels.includes(msg.channelId))
            return await msg.reply('nie możesz używać komend bota na bridge channel');

        if (msg.content?.startsWith('dbr!')) {
            const args = msg.content.slice(4).split(' ');
            const command = args.shift()!;

            if (
                ['add-bridge-channel', 'rm-bridge-channel', 'add-server-adm', 'rm-server-adm'].includes(command) &&
                !this.getServerAdministrators(msg.guildId).includes(msg.author.id) &&
                !this.isBotAdministrator(msg.author.id)
            )
                return await msg.reply('tylko admini to mogą');

            const ch_mention = msg.mentions.channels.first();
            if (!ch_mention && ['add-bridge-channel', 'rm-bridge-channel'].includes(command))
                return await msg.reply('kanał musisz podać btw');

            const u_mention = msg.mentions.channels.first();
            if (!u_mention && ['add-server-adm', 'rm-server-adm'].includes(command))
                return await msg.reply('osobe musisz podać btw');

            switch (command) {
                case 'help': {
                    return await msg.reply([
                        'siema!',
                        'disbridge bridguje kanały discorda pomiędzy serwerami tworząc coś w stylu global chat dla wszystkich serwerów w obrębie danej instancji!',
                        '',
                        'dostępne komendy:',
                        '- `eval` (dev-only): wykonuje kod JS',
                        '- `add-server-adm` oraz `rm-server-adm` (dev-only & existing server admins): kolejno dodaje lub usuwa kogoś z bycia adminem serwera',
                        '- `add-bridge-channel` i `rm-bridge-channel` (dev-only & existing server admins): te komendy z kolei dodają i usuwają bridge channels',
                        '- `help`: to co widzisz teraz'
                    ].join('\n'));
                }

                case 'add-server-adm': {
                    if (this.getServerAdministrators(msg.guildId).includes(u_mention!.id)) 
                        return await msg.reply('ta osoba jest juz adminem serwera');

                    this.addServerAdministrator(msg.guildId, msg.author.id);

                    break;
                }

                case 'rm-server-adm': {
                    if (!this.getServerAdministrators(msg.guildId).includes(u_mention!.id)) 
                        return await msg.reply('ta osoba nie jest adminem serwera');

                    this.removeServerAdministrator(msg.guildId, msg.author.id);

                    break;
                }
                
                case 'add-bridge-channel': {
                    if (this.getBridgedChannels(msg.guildId).includes(ch_mention!.id))
                        return await msg.reply('brother taki bridge channel juz istnieje');
                    
                    this.addBridgedChannel(msg.guildId, ch_mention!.id)

                    break;
                }

                case 'rm-bridge-channel': {
                    if (!this.getBridgedChannels(msg.guildId).includes(ch_mention!.id))
                        return await msg.reply('brother taki bridge channel nie istnieje');
                    
                    this.removeBridgedChannel(msg.guildId, ch_mention!.id)

                    break;
                }

                case 'eval': {
                    const what = args.join(' ');

                    if (this.isBotAdministrator(msg.author.id)) {
                        return await msg.reply(
                            JSON.stringify({
                                result: eval(what),
                                args
                            })
                        );
                    } else {
                        return await msg.reply('ale to dev komenda jest brother');
                    }
                }

                default:
                    return await msg.reply('nie ma takiej komendy')
            }

            return await msg.reply('jeżeli to widzisz to znaczy że komenda nie odpowiedziała w switchu, w 99% przypadków to znaczy że sie udało');
        } else {
            if (!bridged_channels.includes(msg.channelId)) return;
            if (!msg.content && !msg.attachments) return;

            const cfg = this.getConfiguration();
            for (const server_cfg of cfg.servers) {
                if (server_cfg.serverId == msg.guildId) continue;

                try {
                    const server = await this.discord_client.guilds.fetch(server_cfg.serverId);
                    const webhooks = await server.fetchWebhooks();

                    for (const channel_id of server_cfg.bridgedChannels) {
                        try {
                            let webhook = webhooks.find((w) => w.channelId == channel_id && w.owner?.id == this.discord_client.user?.id);
                            if (!webhook) {
                                const channel = await server.channels.fetch(channel_id);
                                if (!channel?.isTextBased() || channel.isThread() || channel.isDMBased()) throw 'could not create webhook';
                                webhook = await channel.createWebhook({
                                    name: 'bridge webhook for channel: ' + channel.id
                                });
                            }
                            webhook.send({
                                content: msg.content || undefined,
                                allowedMentions: {
                                    parse: []
                                },
                                avatarURL: msg.author.displayAvatarURL(),
                                username: msg.member?.displayName,
                                files: msg.attachments.map((a) => a.url)
                            });
                        } catch {
                            // ...
                        }
                    }
                } catch {
                    // ...
                }
            }
            
            try {
                const reaction = await msg.react('✅');
                await new Promise((resolve) => {
                    setTimeout(resolve, 2000)
                });
                await reaction.remove();
            } catch {
                // ...
            }
        }
    }

    private initializeDiscordHandlers() {
        this.discord_client
            .on('messageCreate', this.discordMessageHandler)
            .on('clientReady', (client) => console.log(client.user.id))
            .on('clientReady', (client) => {
                process.on('uncaughtException', async (e) => {
                    try {
                        console.error(e);
                        const operator = await client.users.fetch(this.getConfiguration().botAdmins[0]);
                        (await operator.createDM()).send(e.stack ?? e.message);
                    } catch {
                        // ...
                    }
                })
            })
    }
}

const disbridge = new DisbridgeBot();
disbridge.login();
