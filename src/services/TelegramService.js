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

        const isChatValid = /^-?\d+$/.test(this.chatId);
        if (!isChatValid) {
            console.error(`[Telegram] Invalid CHAT_ID format: "${this.chatId}". Must be numeric.`);
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
                parse_mode: 'HTML'
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
                    parse_mode: 'HTML'
                });
            }

            for (const item of topResults) {
                const title = this._cleanMetadata(item.display_title || item.title);
                const url = item.buy_link || item.link;
                await this._apiCall('sendMessage', {
                    chat_id: this.chatId,
                    text: `🔗 <a href="${url}">${title}</a>`,
                    parse_mode: 'HTML',
                    reply_markup: JSON.stringify({
                        inline_keyboard: [[{ text: '🛒 Buy Now', url: url }]]
                    })
                });
            }
        } catch (error) {
            if (error.message.includes('chat not found') || error.message.includes('unauthorized')) {
                console.log('\n[Telegram] ACTION REQUIRED: Send a /start message to your bot first or check your CHAT_ID.\n');
            } else {
                console.error('[Telegram] Error sending notification:', error.message);
            }
        }
    }

    _buildSummaryCaption(items, targetSize) {
        let lines = [`<b>👟 New Sneaker Found!</b>`];
        if (targetSize && targetSize !== '*') {
            lines.push(`🎯 Target Size: <b>${targetSize}</b>`);
        }
        lines.push('');

        items.forEach(item => {
            const rawTitle = item.display_title || item.title;
            const title = this._cleanMetadata(rawTitle);
            const price = item.price_ils?.toString() || '0';
            const store = item.store_name || item.store;
            const sizesList = (item.available_sizes || item.sizes || []).join(', ');

            lines.push(`• <b>${title}</b>`);
            lines.push(`  💰 <b>₪${price}</b> - <i>${store}</i>`);
            lines.push(`  📏 ${sizesList}`);
            lines.push('');
        });

        return lines.join('\n');
    }

    _cleanMetadata(text) {
        if (!text) return '';
        return String(text)
            .replace(/\s*[|\-]\s*Intent\s*:\s*\w+/gi, '')
            .replace(/\s*[|\-]\s*Model\s*:\s*[^|\-]+/gi, '')
            .replace(/[<>]/g, '')
            .trim();
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

module.exports = TelegramService;
