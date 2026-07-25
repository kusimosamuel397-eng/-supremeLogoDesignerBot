require('dotenv').config();
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!BOT_TOKEN || !OPENAI_API_KEY) {
  console.error('Missing BOT_TOKEN or OPENAI_API_KEY in environment variables.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Simple in-memory state per user (style preference)
const userState = new Map();

const STYLES = {
  minimal: 'minimalist, clean lines, flat vector style, lots of white space',
  modern: 'modern, bold geometric shapes, gradient accents, tech-forward',
  vintage: 'vintage badge style, retro typography, distressed texture',
  luxury: 'elegant, luxury feel, gold or monochrome accents, refined serif lettering',
  playful: 'playful, rounded shapes, bright colors, friendly mascot style'
};

function buildPrompt(description, styleKey) {
  const styleText = STYLES[styleKey] || STYLES.modern;
  return `A professional logo design for: "${description}". Style: ${styleText}. ` +
    `Vector-style illustration, centered composition, solid or transparent-looking background, ` +
    `high contrast, suitable for a brand identity, no text unless the brand name is short and iconic.`;
}

bot.start((ctx) => {
  userState.set(ctx.from.id, { style: 'modern' });
  ctx.reply(
    `👋 Welcome to Supreme Logo Designer Bot!\n\n` +
    `Send me a short description of your business or brand (e.g. "a coffee shop called Brew Haven") ` +
    `and I'll generate a logo concept for you.\n\n` +
    `Commands:\n` +
    `/style - choose a design style (minimal, modern, vintage, luxury, playful)\n` +
    `/help - show this message again`
  );
});

bot.command('help', (ctx) => {
  ctx.reply(
    `Just send a text description of your brand and I'll generate a logo.\n` +
    `Use /style to change the visual style first.\n\n` +
    `Available styles: ${Object.keys(STYLES).join(', ')}`
  );
});

bot.command('style', (ctx) => {
  const options = Object.keys(STYLES).map(s => `• ${s}`).join('\n');
  ctx.reply(
    `Reply with one of these style names to set it:\n${options}\n\n` +
    `Example: just type "luxury"`
  );
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;
  const state = userState.get(userId) || { style: 'modern' };

  // Check if the message is just a style selection
  const lower = text.toLowerCase();
  if (STYLES[lower]) {
    state.style = lower;
    userState.set(userId, state);
    return ctx.reply(`✅ Style set to "${lower}". Now send me your brand description.`);
  }

  if (text.startsWith('/')) return; // ignore unknown commands

  try {
    await ctx.sendChatAction('upload_photo');
    const waitMsg = await ctx.reply('🎨 Generating your logo, please wait...');

    const prompt = buildPrompt(text, state.style);

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      n: 1
    });

    const b64 = response.data[0].b64_json;
    const buffer = Buffer.from(b64, 'base64');

    await ctx.replyWithPhoto(
      { source: buffer },
      { caption: `Here's your logo concept for: "${text}" (style: ${state.style})\n\nWant a different look? Try /style or send a refined description.` }
    );

    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  } catch (err) {
    console.error('Generation error:', err);
    ctx.reply('⚠️ Something went wrong generating your logo. Please try again in a moment.');
  }
});

bot.catch((err, ctx) => {
  console.error(`Bot error for update ${ctx.updateType}:`, err);
});

bot.launch();
console.log('Supreme Logo Designer Bot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
