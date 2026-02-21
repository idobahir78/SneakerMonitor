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

        // 1. Filter by targetSize (Exact Match)
        let filtered = results;
        if (targetSize && targetSize !== '*') {
            filtered = results.filter(item => {
                const sizes = item.available_sizes || item.sizes || [];
                return sizes.some(s => s.toString() === targetSize.toString());
            });
        }

        if (filtered.length === 0) return;

        // 2. Sort by price and take top 5
        const topResults = filtered
            .sort((a, b) => (a.price_ils || 0) - (b.price_ils || 0))
            .slice(0, 5);

        console.log(`[Telegram] Sending alert for ${topResults.length} items...`);

        // 3. Prepare Media Group (Images)
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
                // Send album if images exist
                await this._apiCall('sendMediaGroup', {
                    chat_id: this.chatId,
                    media: JSON.stringify(media)
                });
            } else {
                // Text only fallback
                await this._apiCall('sendMessage', {
                    chat_id: this.chatId,
                    text: this._buildSummaryCaption(topResults, targetSize),
                    parse_mode: 'MarkdownV2'
                });
            }

            // 4. Send "Buy" buttons as separate messages (Telegram MediaGroup doesn't support inline keyboards for individual photos well)
            for (const item of topResults) {
                const buttonText = `🛒 Buy ${item.display_title || item.title}`;
                await this._apiCall('sendMessage', {
                    chat_id: this.chatId,
                    text: `🔗 [${this._escape(item.display_title || item.title)}](${item.buy_link || item.link})`,
                    parse_mode: 'MarkdownV2',
                    reply_markup: JSON.stringify({
                        inline_keyboard: [[{ text: 'Buy Now', url: item.buy_link || item.link }]]
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
        // Basic MarkdownV2 escaping
        return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
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
