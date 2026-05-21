
export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface DiscordEmbedImage {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedThumbnail {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedVideo {
  url?: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedProvider {
  name?: string;
  url?: string;
}

export interface DiscordEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  type?: 'rich' | 'image' | 'video' | 'gifv' | 'article' | 'link';
  description?: string;
  url?: string;
  timestamp?: string; // Moet een ISO8601 timestamp zijn
  color?: number;     // RGB-kleur omgezet naar een integer (bijv. 16711680 voor rood)
  footer?: DiscordEmbedFooter;
  image?: DiscordEmbedImage;
  thumbnail?: DiscordEmbedThumbnail;
  video?: DiscordEmbedVideo;
  provider?: DiscordEmbedProvider;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
}
export async function sendMessageToDiscord(embed: DiscordEmbed) {

        const webhookUrl = process.env.DC_WEBHOOK_URL
        if (!webhookUrl) {
            console.warn('No webhook url configured')
            return { success: false, message: 'No webhook url configured' }
        }
        let content = ''
        if (process.env.DC_WEBHOOK_PING_PPL === 'true') {
            content += `KIJK LOGS! <@&1491883346081615955>!`
        } else {
            content += 'we zijn aan het testen...'
        }
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content,
                embeds: [embed]
            })
        })
        // [{
        //             title: 'Forum Post Deleted by Admin: ' + post.title,
        //             description: post.content,
        //             timestamp: new Date().toISOString(),
        //             author: {
        //                 name: ctx.user.name
        //             },
        //         }]
        if (!response.ok) {
            console.error('Failed to send webhook', await response.text())
        }
}