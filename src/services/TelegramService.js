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

        console.log(`[Telegram] Sending alert for ${topResults.length} items...`);

        const media = topResults
            .filter(item => item.image_url)
            .map((item, index) => ({
                type: 'photo',
                media: item.image_url,
                caption: index === 0 ? this._buildSummaryCaption(topResults, targetSize) : '',
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
                    text: this._buildSummaryCaption(topResults, targetSize),
                    parse_mode: 'MarkdownV2'
                });
            }

            for (const item of topResults) {
                const escapedTitle = this._escape(item.display_title || item.title);
                const url = item.buy_link || item.link;
                await this._apiCall('sendMessage', {
                    chat_id: this.chatId,
                    text: `🔗 [${escapedTitle}](${url})`,
                    parse_mode: 'MarkdownV2',
                    reply_markup: JSON.stringify({
                        inline_keyboard: [[{ text: 'Buy Now', url: url }]]
                    })
                });
            }

            console.log(`DEBUG: Telegram alert sent for ${topResults.length} items.`);
        } catch (error) {
            console.error('[Telegram] Error sending notification:', error.message);
        }
    }

    _buildSummaryCaption(items, targetSize) {
        let lines = [`*👟 New Sneaker Found\\!*`];
        if (targetSize && targetSize !== '*') {
            lines.push(`🎯 Target Size: *${this._escape(targetSize)}*`);
        }
        lines.push('');

        items.forEach(item => {
            const title = this._escape(item.display_title || item.title);
            const price = this._escape(item.price_ils?.toString() || '0');
            const store = this._escape(item.store_name || item.store);
            const sizesList = this._escape((item.available_sizes || item.sizes || []).join(', '));

            lines.push(`• *${title}*`);
            lines.push(`  💰 *₪${price}* | _${store}_`);
            lines.push(`  📏 ${sizesList}`);
            lines.push('');
        });

        return lines.join('\n');
    }

    _escape(text) {
        if (!text) return '';
        const str = text.toString();
        // Mandatory escaping for MarkdownV2: _ * [ ] ( ) ~ ` > # + - = | { } . !
        return str.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    }

    async _apiCall(method, body) {
        const response = await fetch(`${this.apiUrl}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.description || `API error: ${response.status}`);
        }
        return response.json();
    }
}

module.exports = new TelegramService();
