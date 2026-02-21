const fs = require('fs');

class TelegramService {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        this.apiUrl = `https://api.telegram.org/bot${this.token}`;
    }

    async sendNotification(results, targetSize) {
        if (!this.token || !this.chatId) {
            console.warn('[Telegram] Skipping notification: Missing BOT_TOKEN or CHAT_ID in environment.');
            return;
        }

        let filtered = results;
        if (targetSize && targetSize !== '*') {
            filtered = results.filter(item => {
                const sizes = item.available_sizes || item.sizes || [];
                return sizes.some(s => s.toString() === targetSize.toString());
            });
        }

        if (filtered.length === 0) return;

        const topResults = filtered
            .sort((a, b) => (a.price_ils || 0) - (b.price_ils || 0))
            .slice(0, 5);

        const caption = this._buildSummaryCaption(topResults, targetSize);
        const media = topResults
            .filter(item => item.image_url)
            .map((item, index) => ({
                type: 'photo',
                media: String(item.image_url),
                caption: index === 0 ? caption : '',
                parse_mode: 'MarkdownV2'
            }));

        try {
            if (media.length > 0) {
                await this._apiCall('sendMediaGroup', {
                    chat_id: this.chatId,
                    media: JSON.stringify(media)
                });
            } else {
                await this._apiCall('sendMessage', {
                    chat_id: this.chatId,
                    text: caption,
                    parse_mode: 'MarkdownV2'
                });
            }

            for (const item of topResults) {
                const title = this._cleanMetadata(item.display_title || item.title);
                const escapedTitle = this.escapeMarkdownV2(title);
                const url = item.buy_link || item.link;
                await this._apiCall('sendMessage', {
                    chat_id: this.chatId,
                    text: `🔗 [${escapedTitle}](${url})`,
                    parse_mode: 'MarkdownV2',
                    reply_markup: JSON.stringify({
                        inline_keyboard: [[{ text: '🛒 Buy Now', url: url }]]
                    })
                });
            }
        } catch (error) {
            if (error.message.includes('Bad Request') || error.message.includes('parse entities')) {
                console.log('[Telegram] Markdown parsing failed. Attempting Fallback...');
                await this._sendFallback(topResults, targetSize);
            } else {
                console.error('[Telegram] Error sending notification:', error.message);
                if (topResults[0]) {
                    console.log('[Telegram] Failed Text Sample:', topResults[0].display_title || topResults[0].title);
                }
            }
        }
    }

    async _sendFallback(items, targetSize) {
        try {
            const plainText = this._buildPlainTextSummary(items, targetSize);
            await this._apiCall('sendMessage', {
                chat_id: this.chatId,
                text: plainText,
                parse_mode: null
            });
            for (const item of items) {
                const url = item.buy_link || item.link;
                await this._apiCall('sendMessage', {
                    chat_id: this.chatId,
                    text: `🛒 Buy ${item.display_title || item.title}: ${url}`,
                    parse_mode: null
                });
            }
            console.log('[Telegram] Fallback notification sent successfully.');
        } catch (e) {
            console.error('[Telegram] Fallback failed:', e.message);
        }
    }

    _buildSummaryCaption(items, targetSize) {
        let lines = [`*👟 New Sneaker Found\\!*`];
        if (targetSize && targetSize !== '*') {
            lines.push(`🎯 Target Size: *${this.escapeMarkdownV2(targetSize)}*`);
        }
        lines.push('');

        items.forEach(item => {
            const rawTitle = item.display_title || item.title;
            const cleanTitle = this._cleanMetadata(rawTitle);
            const title = this.escapeMarkdownV2(cleanTitle);
            const price = this.escapeMarkdownV2(item.price_ils?.toString() || '0');
            const store = this.escapeMarkdownV2(item.store_name || item.store);
            const sizesList = this.escapeMarkdownV2((item.available_sizes || item.sizes || []).join(', '));

            lines.push(`• *${title}*`);
            lines.push(`  💰 *₪${price}* - _${store}_`);
            lines.push(`  📏 ${sizesList}`);
            lines.push('');
        });

        const final = lines.join('\n');
        return this.escapeMarkdownV2(final, true);
    }

    _buildPlainTextSummary(items, targetSize) {
        let lines = [`👟 New Sneaker Found!`];
        if (targetSize && targetSize !== '*') lines.push(`🎯 Target Size: ${targetSize}`);
        lines.push('');
        items.forEach(item => {
            const title = this._cleanMetadata(item.display_title || item.title);
            const store = item.store_name || item.store;
            const price = item.price_ils || 0;
            const sizes = (item.available_sizes || item.sizes || []).join(', ');
            lines.push(`• ${title}`);
            lines.push(`  Price: ₪${price} - Store: ${store}`);
            lines.push(`  Sizes: ${sizes}`);
            lines.push('');
        });
        return lines.join('\n');
    }

    _cleanMetadata(text) {
        if (!text) return '';
        return String(text)
            .replace(/\s*[|\-]\s*Intent\s*:\s*\w+/gi, '')
            .replace(/\s*[|\-]\s*Model\s*:\s*[^|\-]+/gi, '')
            .replace(/\|/g, '-')
            .trim();
    }

    escapeMarkdownV2(text, isFinal = false) {
        if (!text) return '';
        const escaped = String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
        return isFinal ? escaped.replace(/\\+/g, '\\') : escaped;
    }

    async _apiCall(method, body) {
        const response = await fetch(`${this.apiUrl}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!data.ok) throw new Error(data.description || 'Unknown API error');
        return data;
    }
}

module.exports = new TelegramService();
