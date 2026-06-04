# Disbridge

A Discord bot that uses webhooks to bridge your messages through multiple Discord servers.

## Getting started

You can [invite the main instance](https://discord.com/oauth2/authorize?client_id=1512020063870255125) to your server and ask bot developers for assistance with setting this bot up on [Justcord Discord server](https://dsc.gg/justcord).

Alternatively, **self-host** the bot:

> [!IMPORTANT]
> Make sure you have cloned the repo first.

1. Go to [Discord developer portal](https://discord.com/developers/applications) and create a new application.
2. Go into "Installation" tab and uncheck "User installation", if you want your bot to be private set installation link to "None".
3. Go into "Bot" tab and make sure the following intents are checked: 
  - Message Content intent 
  - Guild Members intent 
  - Guild Presences intent (optionally)
4. In the same tab, click "Reset Token" (you may be prompted for your Discord 2FA code)
5. Copy the token.
6. Create a folder called bot in repo directory.
7. Create a file called .token in that folder and paste your token there.
8. Run the bot for the first time, let it generate the default configuration and stop the bot.
9. Add your Discord user ID to bot developers. 
10. Invite your bot to the first server and start it!
