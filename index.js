const {
    Client,
    GatewayIntentBits,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
    PermissionsBitField
} = require("discord.js");

const { createCanvas } = require("canvas");

/* ================= CONFIG ================= */

const TOKEN = process.env.TOKEN;
const SALON_BOUTON_ID = "1476378934072442931";
const STAFF_CHANNEL_ID = "1476598979751051460";
const STAFF_ROLE_ID = "1476383559693504574";
const CHEF_ID = "867667371930026035";

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const auctions = new Map();

/* ================= IMAGE ================= */

async function generateAuctionImage(data) {

    const width = 1200;
    const height = 600;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    /* ===== FOND ===== */
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#0b1220");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const remaining = Math.max(0, data.endTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    /* ===== BADGE DERNIÈRE MINUTE ===== */
    if (minutes < 5) {
        ctx.fillStyle = "#7f1d1d";
        ctx.fillRect(60, 40, 200, 40);

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 18px Arial";
        ctx.fillText("DERNIÈRE MINUTE", 75, 67);
    }

    /* ===== TITRE ===== */
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "bold 48px Arial";
    ctx.fillText(data.item.toUpperCase(), 60, 130);

    /* ===== VENDEUR ===== */
    ctx.fillStyle = "#9ca3af";
    ctx.font = "22px Arial";
    ctx.fillText(`Vendeur: ${data.creator.username}`, 60, 170);

    /* ===== BOX PRINCIPALE ===== */
    ctx.fillStyle = "#1e293b";
    ctx.roundRect(60, 200, width - 120, 160, 20);
    ctx.fill();

    /* ===== PRIX ACTUEL ===== */
    ctx.fillStyle = "#9ca3af";
    ctx.font = "20px Arial";
    ctx.fillText("ENCHÈRE ACTUELLE", 90, 240);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 70px Arial";
    ctx.fillText(`${data.price.toLocaleString()} $`, 90, 310);

    /* ===== CALCUL AUGMENTATION ===== */
    const diff = data.price - data.startingPrice;
    const percent = ((diff / data.startingPrice) * 100).toFixed(1);

    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 22px Arial";
    ctx.fillText(`↑ +${diff.toLocaleString()} $ (${percent}%)`, 90, 345);

    /* ===== PROCHAINE MIN (+5%) ===== */
    const nextMin = Math.ceil(data.price * 1.05);

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 26px Arial";
    ctx.fillText(`Suivante min : ${nextMin.toLocaleString()} $`, width - 420, 310);

    /* ===== EN TÊTE ===== */
    ctx.fillStyle = "#9ca3af";
    ctx.font = "20px Arial";
    ctx.fillText("EN TÊTE", 60, 420);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Arial";
    ctx.fillText(
        data.highestBidder ? data.highestBidder.username : "Personne",
        60,
        455
    );

    /* ===== TEMPS RESTANT ===== */
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("TEMPS RESTANT", width - 350, 420);

    ctx.fillStyle = minutes < 5 ? "#ef4444" : "#ffffff";
    ctx.font = "bold 28px Arial";
    ctx.fillText(`${minutes}m ${seconds}s`, width - 350, 455);

    /* ===== BARRE PROGRESSION ===== */
    const total = data.endTime - data.startTime;
    const progress = remaining / total;

    ctx.fillStyle = "#111827";
    ctx.fillRect(60, height - 80, width - 120, 20);

    ctx.fillStyle = minutes < 5 ? "#ef4444" : "#22c55e";
    ctx.fillRect(60, height - 80, (width - 120) * progress, 20);

    /* ===== FOOTER ===== */
    ctx.fillStyle = "#7c3aed";
    ctx.font = "bold 18px Arial";
    ctx.fillText("LORDBOT AUCTION V2", width - 260, height - 30);

    return new AttachmentBuilder(canvas.toBuffer(), { name: "auction.png" });
}
/* ================= READY ================= */

client.once("ready", async () => {

    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    const channel = await client.channels.fetch(SALON_BOUTON_ID);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("create_auction")
            .setLabel("Créer une enchère")
            .setStyle(ButtonStyle.Success)
    );

    await channel.send({
        content: "🎯 Clique pour créer une enchère",
        components: [row]
    });
});

/* ================= TIMER ================= */

setInterval(async () => {

    for (const [channelId, auction] of auctions) {

        const remaining = auction.endTime - Date.now();
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) continue;

        const message = await channel.messages.fetch(auction.messageId).catch(() => null);
        if (!message) continue;

        if (remaining > 0) {

            const image = await generateAuctionImage(auction);
            await message.edit({ files: [image] });

        } else {

            auctions.delete(channelId);

            if (!auction.highestBidder) {
                await channel.send("❌ Personne n'a enchéri.");
                continue;
            }

            const tax = Math.floor(auction.price * 0.01);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_${auction.creator.id}`)
                    .setLabel("✅ Confirmer la vente")
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId(`tax_${auction.creator.id}`)
                    .setLabel("💰 Payer taxe (1%)")
                    .setStyle(ButtonStyle.Danger)
            );

            await channel.send({
                content:
`🏆 Gagnant : ${auction.highestBidder}

💵 Prix final : ${auction.price.toLocaleString()} $
💸 Taxe : ${tax.toLocaleString()} $`,
                components: [row]
            });
        }

    }

}, 10000);

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async (interaction) => {

    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    /* ===== CREATE BUTTON ===== */
    if (interaction.customId === "create_auction") {

        const modal = new ModalBuilder()
            .setCustomId("auction_modal")
            .setTitle("Créer une enchère");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("item").setLabel("Objet").setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("price").setLabel("Prix de départ").setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("time").setLabel("Durée (heures)").setStyle(TextInputStyle.Short)
            )
        );

        return interaction.showModal(modal);
    }
/* ===== CONFIRM SALE ===== */
if (interaction.isButton() && interaction.customId.startsWith("confirm_")) {

    const ownerId = interaction.customId.split("_")[1];

    if (interaction.user.id !== ownerId) {
        return interaction.reply({
            content: "❌ Seul le créateur peut confirmer la vente.",
            ephemeral: true
        });
    }

    await interaction.reply({
        content: "✅ Vente confirmée avec succès !",
        ephemeral: false
    });

    // 🔒 Désactiver boutons
    const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
    );

    await interaction.message.edit({ components: [disabledRow] });
}


/* ===== PAY TAX ===== */
if (interaction.isButton() && interaction.customId.startsWith("tax_")) {

    const ownerId = interaction.customId.split("_")[1];

    if (
        !interaction.member.roles.cache.has(STAFF_ROLE_ID) &&
        interaction.user.id !== CHEF_ID
    ) {
        return interaction.reply({
            content: "❌ Seul le staff peut valider la taxe.",
            ephemeral: true
        });
    }

    await interaction.reply({
        content: "💰 Taxe validée par le staff.",
        ephemeral: false
    });

    const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
    );

    await interaction.message.edit({ components: [disabledRow] });
}

    /* ===== CREATE MODAL ===== */
    if (interaction.customId === "auction_modal") {

        const item = interaction.fields.getTextInputValue("item");
        const price = parseInt(interaction.fields.getTextInputValue("price"));
        const hours = parseInt(interaction.fields.getTextInputValue("time"));

        const staffChannel = await client.channels.fetch(STAFF_CHANNEL_ID);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`create_accept_${interaction.user.id}_${item}_${price}_${hours}`)
                .setLabel("✅ Accepter")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`create_reject_${interaction.user.id}`)
                .setLabel("❌ Refuser")
                .setStyle(ButtonStyle.Danger)
        );

        await staffChannel.send({
            content: `Nouvelle demande\n${interaction.user}\n${item}\n${price}$\n${hours}h`,
            components: [row]
        });

        return interaction.reply({ content: "⏳ Demande envoyée.", ephemeral: true });
    }

    /* ===== ACCEPT CREATE ===== */
    if (interaction.customId.startsWith("create_accept_")) {
await interaction.deferUpdate();
        if (
            !interaction.member.roles.cache.has(STAFF_ROLE_ID) &&
            interaction.user.id !== CHEF_ID
        ) {
            return interaction.reply({ content: "❌ Permission refusée.", ephemeral: true });
        }

        const parts = interaction.customId.split("_");

        const userId = parts[2];
        const item = parts[3];
        const price = parseInt(parts[4]);
        const hours = parseInt(parts[5]);

        const startTime = Date.now();
        const endTime = startTime + hours * 3600000;

        const channel = await interaction.guild.channels.create({
            name: `enchere-${item}`,
            type: ChannelType.GuildText
        });

        const auction = {
            item,
            price,
            highestBidder: null,
            startTime,
            endTime,
            creator: await client.users.fetch(userId)
        };

        const image = await generateAuctionImage(auction);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("bid_5").setLabel("⚡ +5%").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("bid_custom").setLabel("💰 Montant libre").setStyle(ButtonStyle.Secondary)
        );

        const msg = await channel.send({ files: [image], components: [row] });

        auction.messageId = msg.id;
        auctions.set(channel.id, auction);

        await interaction.editReply({ content: "✅ Enchère créée.", components: [] });
    }
 /* ===== bid ===== */

if (interaction.isButton() && interaction.customId === "bid_custom") {

    const auction = auctions.get(interaction.channel.id);
    if (!auction)
        return interaction.reply({
            content: "❌ Enchère terminée.",
            ephemeral: true
        });

    const min = Math.ceil(auction.price * 1.05);

    const modal = new ModalBuilder()
        .setCustomId("bid_modal")
        .setTitle("Montant libre");

    const input = new TextInputBuilder()
        .setCustomId("amount")
        .setLabel(`Minimum ${min} $`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(input)
    );

    return interaction.showModal(modal);
}

if (interaction.isButton() && interaction.customId === "bid_5") {

    const auction = auctions.get(interaction.channel.id);
    if (!auction)
        return interaction.reply({
            content: "❌ Enchère terminée.",
            ephemeral: true
        });

    const newAmount = Math.ceil(auction.price * 1.05);

    auction.price = newAmount;
    auction.highestBidder = interaction.user;
    auction.bidCount = (auction.bidCount || 0) + 1;

    const message = await interaction.channel.messages.fetch(auction.messageId);
    const image = await generateAuctionImage(auction);

    await message.edit({
        files: [image],
        components: message.components
    });

    return interaction.reply({
        content: "✅ Enchère appliquée.",
        ephemeral: true
    });
}
/* ===== BID MODAL SUBMIT ===== */
if (interaction.isModalSubmit() && interaction.customId === "bid_modal") {

    const auction = auctions.get(interaction.channel.id);
    if (!auction)
        return interaction.reply({
            content: "❌ Enchère terminée.",
            ephemeral: true
        });

    const amount = parseInt(interaction.fields.getTextInputValue("amount"));

    const min = Math.ceil(auction.price * 1.05);

    if (isNaN(amount) || amount < min) {
        return interaction.reply({
            content: `❌ Montant invalide. Minimum : ${min.toLocaleString()} $`,
            ephemeral: true
        });
    }

    auction.price = amount;
    auction.highestBidder = interaction.user;

    const message = await interaction.channel.messages.fetch(auction.messageId);
    const image = await generateAuctionImage(auction);

    await message.edit({ files: [image] });

    return interaction.reply({
        content: "✅ Enchère validée.",
        ephemeral: true
    });
}

});
client.login(TOKEN);