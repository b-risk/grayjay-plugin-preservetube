// Platform information
const platform = {
    title: 'PreserveTube',
    url: 'https://preservetube.com',
    icon: 'https://raw.githubusercontent.com/b-risk/grayjay-plugin-preservetube/refs/heads/master/Imgs/PreserveTubeIcon.png'
}

// Media relay
// PreserveTube serves every thumbnail and every video from its CDN
// (s*.archive.party). Some ISP filters block that host, which leaves the app
// with no images and no playback, so a local relay can re-serve those files
// over the local network. The relay is only used when this plugin was loaded
// from a private address (the dev setup), so a hosted plugin never needs one.
const RELAY_PATH = "/relay?url=";
const RELAY_HOSTS = /(^|\.)(archive\.party|lain\.la|blob\.im)$/i;
var relayBase = null;

// Regex variables
const regex = {
    // PreserveTube URLs
    videoUrl: /https:\/\/preservetube\.com\/watch\?v=([\w\-_]{11})/,
    channelUrl: /https:\/\/preservetube\.com\/channel\/(@?[\w\-_]+)/,
    channelVideosUrl: /https:\/\/preservetube\.com\/channel\/(@?[\w\-_]+)\/videos/,
    // YouTube video URLs (to fetch archived versions)
    youtubeVideoWatch: /https?:\/\/(?:www\.|music\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([\w\-_]{11})/,
    youtubeVideoShare: /https?:\/\/youtu\.be\/([\w\-_]{11})/,
    youtubeVideoEmbed: /https?:\/\/(?:www\.)?youtube\.com\/embed\/([\w\-_]{11})/,
    youtubeVideoV: /https?:\/\/(?:www\.)?youtube\.com\/v\/([\w\-_]{11})/,
    youtubeVideoShorts: /https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\/([\w\-_]{11})/,
    // YouTube channel URLs
    youtubeChannelId: /https?:\/\/(?:www\.|m\.)?youtube\.com\/channel\/(UC[\w\-_]{22})/,
    youtubeChannelHandle: /https?:\/\/(?:www\.|m\.)?youtube\.com\/@([\w\-_.]+)/,
    youtubeChannelCustom: /https?:\/\/(?:www\.|m\.)?youtube\.com\/c\/([^\/\?]+)/,
    youtubeChannelUser: /https?:\/\/(?:www\.|m\.)?youtube\.com\/user\/([^\/\?]+)/
}


// State
var config = {};
var settings = {};
var state = {
    channelCache: {}
}


// Source: Enable
source.enable = function(conf, _settings, savedState) {
    config = conf;
    settings = _settings;

    if (savedState) {
        try {
            state = JSON.parse(savedState);
        } catch (e) {
            log("Failed to parse saved state: " + e.message);
        }
    }

    log("PreserveTube plugin enabled");
}

// Source: Disable
source.disable = function() {
    log("PreserveTube plugin disabled");
}

// Source: Save State
source.saveState = function() {
    return JSON.stringify(state);
}

// Source: Get Home (Latest videos)
source.getHome = function() {
    // Get PreserveTube's latest page
    const html = makeGetRequest(`${platform.url}/latest`, false);

    if (!html)
        throw new ScriptException("Failed to fetch home page from PreserveTube");

    const videoCards = parseVideoCardsFromHtml(html);
    const videos = [];

    for (const card of videoCards) {
        // Use channel info extracted from within the video card
        const author = card.channel
            ? createAuthorLink(card.channel.id, card.channel.name, card.channel.url, card.channel.avatar)
            : createAuthorLink("unknown", "Unknown", null, "");

        videos.push(new PlatformVideo({
            id: createPlatformID(card.id),
            name: card.title || `Video ${card.id}`,
            thumbnails: new Thumbnails([new Thumbnail(card.thumbnail, 0)]),
            author: author,
            uploadDate: parseDate(card.publishedDate),
            duration: 0,
            viewCount: -1,
            url: `${platform.url}/watch?v=${card.id}`,
            isLive: false
        }));
    }

    return new VideoPager(videos, false);
}

// Source: Search Capabilities
source.getSearchCapabilities = function() {
    return {
        types: ["Video", "Channel"],
        sorts: [],
        filters: []
    };
}

// Source: Search Suggestions
source.searchSuggestions = function(query) {
    return [];
}

// Source: Search
source.search = function(query, type, order, filters) {
    const html = makeGetRequest(`${platform.url}/search?search=${encodeURIComponent(query)}`, false);

    if (!html) 
        return new VideoPager([], false);

    const videoCards = parseVideoCardsFromHtml(html);
    const videos = [];

    for (const card of videoCards) {
        // Use channel info extracted from within the video card
        const author = card.channel
            ? createAuthorLink(card.channel.id, card.channel.name, card.channel.url, card.channel.avatar)
            : createAuthorLink("unknown", "Unknown", null, "");

        videos.push(new PlatformVideo({
            id: createPlatformID(card.id),
            name: card.title || `Video ${card.id}`,
            thumbnails: new Thumbnails([new Thumbnail(card.thumbnail, 0)]),
            author: author,
            uploadDate: parseDate(card.publishedDate),
            duration: 0,
            viewCount: -1,
            url: `${platform.url}/watch?v=${card.id}`,
            isLive: false
        }));
    }

    return new VideoPager(videos, false);
}

// Source: Get Search Channel Contents Capabilities
source.getSearchChannelContentsCapabilities = function() {
    return {
        types: ["Video"],
        sorts: [],
        filters: []
    };
}

// Source: Search Channel Contents
source.searchChannelContents = function(url, query, type, order, filters, continuationToken) {
    return source.search(query, type, order, filters);
}

// Source: Search Channels
source.searchChannels = function(query, continuationToken) {
    // Grab video search results, PreserveTube doesn't support channel searches
    const html = makeGetRequest(`${platform.url}/search?search=${encodeURIComponent(query)}`, false);

    if (!html)
        throw new ScriptException("Failed to search PreserveTube channels: " + query);

    const videoCards = parseVideoCardsFromHtml(html);
    const seenChannels = new Set();
    const channels = [];

    const queryLower = query.toLowerCase();

    for (const card of videoCards) {
        // Check if channel has already been found
        if (!card.channel || seenChannels.has(card.channel.id)) 
            continue;

        seenChannels.add(card.channel.id);

        if (!card.channel.name.toLowerCase().includes(queryLower)) 
            continue;

        channels.push(new PlatformChannel({
            id: createChannelPlatformID(card.channel.id),
            name: card.channel.name,
            thumbnail: card.channel.avatar,
            banner: "",
            subscribers: -1,
            description: `Archived videos from ${card.channel.name} on PreserveTube`,
            url: card.channel.url,
            links: {}
        }));
    }

    return new ChannelPager(channels, false);
}

// Source: Is Content Details URL (accepts PreserveTube and YouTube video URLs)
source.isContentDetailsUrl = function(url) {
    if (regex.videoUrl.test(url)) { // Test PreserveTube URL
        return true;
    } else {
        const videoId = extractVideoId(url); // Extract ID from YouTube URL if available
        if (!videoId) {
            return false;
        } else if (settings.usePreserveTubeArchiving) { // Claim URL if archiving is enabled to show the captcha
            return true;
        } else { // Archiving is disabled, only claim if already archived on PreserveTube
            const result = makeGetRequest(`${platform.url}/watch?v=${videoId}`, false, true);
            return result && !result.error;
        }
    }
}

// Source: Get Content Details
source.getContentDetails = function(url) {
    const videoId = extractVideoId(url);

    if (!videoId)
        throw new ScriptException("Invalid video URL: " + url);

    // Fetch the HTML watch page (JSON API is blocked with 403)
    const watchUrl = `${platform.url}/watch?v=${videoId}`;
    const result = makeGetRequest(watchUrl, false, true);

    // Check for HTTP errors
    if (result && result.error) {
        const errorCode = result.code || "unknown";
        const errorBody = result.body ? result.body.substring(0, 200) : "";
        log(`Watch page error [${errorCode}]: ${watchUrl} body: ${errorBody}`);

        if (errorCode === 404) {
            const saveUrl = buildSaveUrl(videoId);
            log(`Video ${videoId} not archived. Redirecting to save page: ${saveUrl}`);
            throw new CaptchaRequiredException(saveUrl,
                `<html><body>
                <h1>Video Not Archived</h1>
                <p>This video is not yet archived on PreserveTube.</p>
                <p>Solve the captcha to request archiving. After completion, try playing the video again.</p>
                <script>window.location.href = "${saveUrl}";</script>
                </body></html>`
            );
        }
        if (result.challenge) {
            throw new ScriptException(`PreserveTube is blocking requests right now (cloudflare challenge) for: ${videoId}`);
        }
        throw new ScriptException(`Failed to fetch video details for: ${videoId} (HTTP ${errorCode}: ${errorBody.substring(0, 100)})`);
    }

    if (!result)
        throw new ScriptException("Failed to fetch video details for (null response): " + videoId);

    const body = result;

    return parseVideoFromWatchPage(body, videoId, watchUrl);
}

// Source: Is Channel URL (accepts PreserveTube and YouTube channel URLs)
source.isChannelUrl = function(url) {
    if (regex.channelUrl.test(url)) { // Test PreserveTube URL
        return true;
    } else if (settings.youtubeChannelSeparation === false) { // Test YouTube URL scheme if separation is disabled
        return isYouTubeChannelUrl(url); 
    } else {
        return false;
    }
}

// Source: Get Channel
source.getChannel = function(url, prefetchedHtml) {
    const channelId = extractChannelId(url);

    if (!channelId) 
        throw new ScriptException("Invalid channel URL: " + url);

    // Check cache
    if (state.channelCache[channelId]) 
        return state.channelCache[channelId];

    // PreserveTube's channel pages are often behind a Cloudflare challenge, so the
    // channel info is collected from the pages that are reliably served:
    //   1. the /videos listing (also fetched by getChannelContents)
    //   2. the watch page of the newest archived video (it carries the channel profile)
    //   3. the channel page itself (best effort)
    const html = prefetchedHtml || fetchChannelVideosHtml(channelId);
    const cards = html ? parseVideoCardsFromHtml(html) : [];

    let channelName = null;
    let avatar = "";

    if (cards.length > 0 && cards[0].channel) {
        channelName = cards[0].channel.name;
        avatar = cards[0].channel.avatar;
    }

    if (html && (!channelName || !avatar)) {
        const parsed = parseChannelInfoFromHtml(html, channelId);
        if (!channelName && parsed.name) channelName = parsed.name;
        if (!avatar && parsed.avatar) avatar = parsed.avatar;
    }

    // The /videos listing never carries the channel profile, so fall back to the
    // watch page of the newest archived video, which always does.
    if (cards.length > 0 && (!channelName || !avatar)) {
        const profile = fetchChannelProfileFromWatchPage(cards[0].id);
        if (profile) {
            if (!channelName && profile.name) channelName = profile.name;
            if (!avatar && profile.avatar) avatar = profile.avatar;
        }
    }

    if (!channelName || !avatar) {
        const pageResult = makeGetRequest(`${platform.url}/channel/${channelId}`, false, true);
        if (pageResult && !pageResult.error) {
            const parsed = parseChannelInfoFromHtml(pageResult, channelId);
            if (!channelName && parsed.name) channelName = parsed.name;
            if (!avatar && parsed.avatar) avatar = parsed.avatar;
        } else if (pageResult && pageResult.error) {
            log(`PreserveTube channel page error for ${channelId}: HTTP ${pageResult.code} — using other sources`);
        }
    }

    if (!channelName) {
        log(`Could not resolve a name for channel ${channelId} — using the id`);
        channelName = channelId;
    }

    // Build channel URLs: use PreserveTube as main when separation is enabled
    const channelUrl = `${platform.url}/channel/${channelId}`;
    const youtubeChannelUrl = buildYouTubeChannelUrl(channelId);
    const mainUrl = settings.youtubeChannelSeparation !== false ? channelUrl : (youtubeChannelUrl || channelUrl);
    const urlAlternatives = settings.youtubeChannelSeparation !== false ? [] : (youtubeChannelUrl ? [channelUrl] : []);

    const channel = new PlatformChannel({
        id: createChannelPlatformID(channelId),
        name: channelName,
        thumbnail: avatar,
        banner: "",
        subscribers: -1,
        description: `Archived videos from ${channelName} on PreserveTube`,
        url: mainUrl,
        urlAlternatives: urlAlternatives,
        links: {}
    });

    // Only cache real results so a transient failure can be retried later
    if (channelName !== channelId || avatar)
        state.channelCache[channelId] = channel;

    return channel;
}

// Source: Get Channel Capabilities
source.getChannelCapabilities = function() {
    return {
        types: ["Video"],
        sorts: [],
        filters: []
    };
}

// Source: Get Channel Contents
source.getChannelContents = function(url, type, order, filters) {
    const channelId = extractChannelId(url);

    if (!channelId)
        throw new ScriptException("Invalid channel URL for contents: " + url);

    // The /videos listing is the one channel page that is not Cloudflare challenged
    const html = fetchChannelVideosHtml(channelId);

    if (!html)
        throw new ScriptException("Failed to fetch channel contents from PreserveTube: " + channelId);

    const videoCards = parseVideoCardsFromHtml(html);
    const videos = [];

    // Get channel info for author (reuses the listing already fetched above)
    let channel;
    try {
        channel = source.getChannel(url, html);
    } catch (e) {
        log("Failed to get channel info: " + e.message);
    }

    const author = channel
        ? createAuthorLink(channelId, channel.name, channel.url, channel.thumbnail)
        : createAuthorLink(channelId, channelId, `${platform.url}/channel/${channelId}`, "");

    for (const card of videoCards) {
        videos.push(new PlatformVideo({
            id: createPlatformID(card.id),
            name: card.title || `Video ${card.id}`,
            thumbnails: new Thumbnails([new Thumbnail(card.thumbnail, 0)]),
            author: author,
            uploadDate: parseDate(card.publishedDate),
            duration: 0,
            viewCount: -1,
            url: `${platform.url}/watch?v=${card.id}`,
            isLive: false
        }));
    }

    return new VideoPager(videos, false);
}


/**
 * Create PlatformID for a video or channel
 * @param {string} id
 * @returns {PlatformID}
 */
function createPlatformID(id) {
    return new PlatformID(platform.title, id, config?.id);
}

/**
 * Create PlatformID for a channel (with prefix when separation is enabled)
 * @param {string} channelId
 * @returns {PlatformID}
 */
function createChannelPlatformID(channelId) {
    const prefixed = settings.youtubeChannelSeparation !== false ? "preservetube://" + channelId : channelId;
    return createPlatformID(prefixed);
}

/**
 * Create PlatformAuthorLink
 * @param {string} channelId
 * @param {string} channelName
 * @param {string|null} channelUrl
 * @param {string} thumbnail
 * @returns {PlatformAuthorLink}
 */
function createAuthorLink(channelId, channelName, channelUrl, thumbnail) {
    return new PlatformAuthorLink(
        createChannelPlatformID(channelId),
        channelName || "Unknown",
        channelUrl || `${platform.url}/channel/${channelId}`,
        thumbnail || ""
    );
}

/**
 * Parse date string to Unix timestamp
 * @param {string|null} dateStr
 * @returns {number}
 */
function parseDate(dateStr) {
    if (!dateStr) return Math.floor(Date.now() / 1000);
    try {
        // Handle formats like "December 17, 2023" or ISO dates
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return Math.floor(Date.now() / 1000);
        }
        return Math.floor(date.getTime() / 1000);
    } catch (e) {
        return Math.floor(Date.now() / 1000);
    }
}

/**
 * Extract video ID from URL (supports PreserveTube and YouTube URLs)
 * @param {string} url
 * @returns {string|null}
 */
function extractVideoId(url) {
    // Try PreserveTube URL first
    let match = url.match(regex.videoUrl);
    if (match) return match[1];

    // Try all YouTube URL patterns
    match = url.match(regex.youtubeVideoWatch);
    if (match) return match[1];

    match = url.match(regex.youtubeVideoShare);
    if (match) return match[1];

    match = url.match(regex.youtubeVideoEmbed);
    if (match) return match[1];

    match = url.match(regex.youtubeVideoV);
    if (match) return match[1];

    match = url.match(regex.youtubeVideoShorts);
    if (match) return match[1];

    return null;
}

/**
 * Check if URL is a YouTube video URL
 * @param {string} url
 * @returns {boolean}
 */
function isYouTubeVideoUrl(url) {
    return regex.youtubeVideoWatch.test(url) ||
           regex.youtubeVideoShare.test(url) ||
           regex.youtubeVideoEmbed.test(url) ||
           regex.youtubeVideoV.test(url) ||
           regex.youtubeVideoShorts.test(url);
}

/**
 * Extract channel ID from URL (supports PreserveTube and YouTube URLs)
 * @param {string} url
 * @returns {string|null}
 */
function extractChannelId(url) {
    // Try PreserveTube URL first
    let match = url.match(regex.channelUrl);
    if (match) return match[1];

    // Try YouTube channel ID (UCxxx)
    match = url.match(regex.youtubeChannelId);
    if (match) return match[1];

    // Try YouTube handle (@name)
    match = url.match(regex.youtubeChannelHandle);
    if (match) return "@" + match[1];

    // Try YouTube custom URL (/c/name)
    match = url.match(regex.youtubeChannelCustom);
    if (match) return match[1];

    // Try YouTube user URL (/user/name)
    match = url.match(regex.youtubeChannelUser);
    if (match) return match[1];

    return null;
}

/**
 * Check if URL is a YouTube channel URL
 * @param {string} url
 * @returns {boolean}
 */
function isYouTubeChannelUrl(url) {
    return regex.youtubeChannelId.test(url) ||
           regex.youtubeChannelHandle.test(url) ||
           regex.youtubeChannelCustom.test(url) ||
           regex.youtubeChannelUser.test(url);
}

/**
 * Make HTTP GET request with retry logic for transient failures
 * @param {string} url
 * @param {boolean} [parseJson=true]
 * @param {boolean} [returnError=false]
 * @returns {object|string|null}
 */
function makeGetRequest(url, parseJson = true, returnError = false) {
    const maxRetries = 3;
    const retryStatuses = [408, 429, 500, 502, 503, 504];

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const resp = http.GET(url, {});
            const challenged = isCloudflareChallenge(resp.body);

            if (!resp.isOk) {
                log(`Request failed with status ${resp.code}${challenged ? " (cloudflare challenge)" : ""}: ${url} (attempt ${attempt}/${maxRetries})`);
                if (resp.code === 404) {
                    if (returnError) {
                        return { error: true, code: 404, body: resp.body };
                    }
                    return null;
                }
                if (attempt < maxRetries && (retryStatuses.includes(resp.code) || challenged)) {
                    bridge.toast("PreserveTube is having issues, retrying...");
                    continue;
                }
                if (returnError) {
                    bridge.toast("PreserveTube is unavailable right now");
                    return { error: true, code: resp.code, challenge: challenged, body: resp.body };
                }
                bridge.toast("PreserveTube is unavailable right now");
                throw new ScriptException(`PreserveTube request failed: ${url} (HTTP ${resp.code}${challenged ? ", cloudflare challenge" : ""})`);
            }

            // A challenge can also be served with HTTP 200, never treat it as content
            if (challenged) {
                if (attempt < maxRetries) {
                    log(`Cloudflare challenge served for ${url} (attempt ${attempt}/${maxRetries})`);
                    bridge.toast("PreserveTube is having issues, retrying...");
                    continue;
                }
                if (returnError) {
                    return { error: true, code: resp.code, challenge: true, body: resp.body };
                }
                throw new ScriptException(`PreserveTube is blocking this request (cloudflare challenge): ${url}`);
            }

            if (attempt > 1) {
                bridge.toast("PreserveTube recovered");
            }
            if (parseJson) {
                return JSON.parse(resp.body);
            }
            return resp.body;
        } catch (e) {
            if (e instanceof ScriptException) throw e;
            lastError = e;
            log(`Request error (attempt ${attempt}/${maxRetries}): ${e.message}`);
            if (attempt < maxRetries) {
                bridge.toast("PreserveTube is having issues, retrying...");
            }
        }
    }

    bridge.toast("PreserveTube is unavailable right now");
    if (returnError) {
        return { error: true, code: 0, body: lastError ? lastError.message : "Unknown error" };
    }
    throw new ScriptException(`PreserveTube request failed after ${maxRetries} attempts: ${url} - ${lastError ? lastError.message : "Unknown error"}`);
}

/**
 * Build YouTube URL from video ID
 * @param {string} videoId
 * @returns {string}
 */
function buildYouTubeUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Build YouTube channel URL from channel ID
 * @param {string} channelId
 * @returns {string|null}
 */
function buildYouTubeChannelUrl(channelId) {
    if (!channelId) return null;

    // Channel ID format (UCxxxxxxx - 24 chars starting with UC)
    if (channelId.startsWith("UC") && channelId.length === 24) {
        return `https://www.youtube.com/channel/${channelId}`;
    }

    // Handle format (@name)
    if (channelId.startsWith("@")) {
        return `https://www.youtube.com/${channelId}`;
    }

    // For other formats (custom names), use the @handle format
    return `https://www.youtube.com/@${channelId}`;
}

/**
 * Parse video cards from HTML
 * @param {string} html
 * @returns {Array<{id: string, title: string, thumbnail: string, publishedDate: string|null, archivedDate: string|null, channel: {id: string, name: string, avatar: string, url: string}|null}>}
 */
function parseVideoCardsFromHtml(html) {
    const videos = [];
    const seenIds = new Set();
    const doc = domParser.parseFromString(html, "text/html");
    const cards = doc.querySelectorAll('.video');

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const link = card.querySelector('a[href*="/watch?v="]');
        if (!link) continue;
        const href = link.getAttribute('href');
        const videoIdMatch = href.match(/\/watch\?v=([\w\-_]{11})/);
        if (!videoIdMatch) continue;
        const videoId = videoIdMatch[1];
        if (seenIds.has(videoId)) continue;
        seenIds.add(videoId);

        const img = card.querySelector('img');
        const thumbnail = relayUrl(img ? img.getAttribute('src') || "" : "");

        const titleEl = card.querySelector('.title');
        let title = titleEl ? titleEl.textContent.trim() : `Video ${videoId}`;
        title = title.replace(/\s+/g, ' ').trim();

        let publishedDate = null;
        let archivedDate = null;
        const dateEl = card.querySelector('.date');
        if (dateEl) {
            const dateText = dateEl.textContent;
            const pubMatch = dateText.match(/Published on\s+([^|]+)/i);
            if (pubMatch) publishedDate = pubMatch[1].trim();
            const archMatch = dateText.match(/Archived on\s+(.+)/i);
            if (archMatch) archivedDate = archMatch[1].trim();
        }

        let channelInfo = null;
        const profileEl = card.querySelector('.channel-profile');
        if (profileEl) {
            const channelLink = profileEl.querySelector('a[href*="/channel/"]');
            const channelImg = profileEl.querySelector('img');
            if (channelLink) {
                const chHref = channelLink.getAttribute('href');
                const chIdMatch = chHref.match(/\/channel\/(@?[\w\-_]+)/);
                if (chIdMatch) {
                    channelInfo = {
                        id: chIdMatch[1],
                        name: channelLink.textContent.trim(),
                        avatar: relayUrl(channelImg ? channelImg.getAttribute('src') || "" : ""),
                        url: `${platform.url}/channel/${chIdMatch[1]}`
                    };
                }
            }
        }

        videos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            publishedDate: publishedDate,
            archivedDate: archivedDate,
            channel: channelInfo
        });
    }

    return videos;
}

/**
 * Parse video details from PreserveTube watch page HTML
 * @param {string} body
 * @param {string} videoId
 * @param {string} watchUrl
 * @returns {PlatformVideoDetails}
 */
function parseVideoFromWatchPage(body, videoId, watchUrl) {
    const doc = domParser.parseFromString(body, "text/html");

    const titleEl = doc.querySelector('h1');
    const title = titleEl ? titleEl.textContent.trim() : `Video ${videoId}`;

    let channelId = null;
    let channelName = "Unknown";
    let channelAvatar = "";

    const profile = parseChannelProfileFromHtml(body);
    if (profile) {
        if (profile.id) channelId = profile.id;
        if (profile.name) channelName = profile.name;
        if (profile.avatar) channelAvatar = profile.avatar;
    }

    // The media url comes from the player, its <source>, or the download link.
    // It is never guessed: older archives are .webm and on a different shard.
    const sourceUrl = resolveVideoUrl(doc);
    if (!sourceUrl)
        throw new ScriptException(`PreserveTube watch page for ${videoId} has no playable source`);

    const source = describeVideoSource(sourceUrl);

    const videoEl = doc.querySelector('video');
    const thumbnail = videoEl ? videoEl.getAttribute('poster') || "" : "";

    let publishedDate = null;
    const dateEl = doc.querySelector('.date');
    if (dateEl) {
        const dateText = dateEl.textContent;
        const dateMatch = dateText.match(/Published on\s+(\d{4}-\d{2}-\d{2})/i);
        if (dateMatch) publishedDate = dateMatch[1];
    }

    const descEl = doc.querySelector('.description');
    const description = descEl ? descEl.textContent.trim() : "";

    const author = createAuthorLink(
        channelId || "unknown",
        channelName,
        channelId ? `${platform.url}/channel/${channelId}` : null,
        channelAvatar
    );

    return new PlatformVideoDetails({
        id: createPlatformID(videoId),
        name: title,
        thumbnails: new Thumbnails([new Thumbnail(relayUrl(resolveUrl(thumbnail)), 0)]),
        author: author,
        uploadDate: parseDate(publishedDate),
        duration: 0,
        viewCount: -1,
        url: watchUrl,
        isLive: false,
        description: description,
        video: new VideoSourceDescriptor([
            new VideoUrlSource({
                name: source.label,
                container: source.container,
                url: relayUrl(sourceUrl),
                width: 0,
                height: 0,
                duration: 0,
                codec: source.codec
            })
        ])
    });
}

/**
 * Parse channel info from PreserveTube channel page HTML
 * @param {string} html
 * @param {string} channelId
 * @returns {{name: string, avatar: string}}
 */
function parseChannelInfoFromHtml(html, channelId) {
    let channelName = null;
    let avatar = "";

    if (!html || isCloudflareChallenge(html))
        return { name: channelName, avatar: relayUrl(avatar) };

    const doc = domParser.parseFromString(html, "text/html");

    // The channel header is only rendered on the channel page itself
    const h1El = doc.querySelector('h1');
    if (h1El) channelName = cleanChannelName(h1El.textContent, channelId);

    if (!channelName) {
        const ogEl = doc.querySelector('meta[property="og:title"]');
        if (ogEl) channelName = cleanChannelName(ogEl.getAttribute('content'), channelId);
    }

    if (!channelName) {
        const titleEl = doc.querySelector('title');
        if (titleEl) channelName = cleanChannelName(titleEl.textContent, channelId);
    }

    if (!channelName) {
        const channelLink = doc.querySelector('a[href*="/channel/"]');
        if (channelLink) channelName = cleanChannelName(channelLink.textContent, channelId);
    }

    let avatarEl = doc.querySelector('.channel-profile img');
    if (avatarEl) avatar = avatarEl.getAttribute('src') || "";

    if (!avatar) {
        avatarEl = doc.querySelector('img[class*="avatar"]');
        if (avatarEl) avatar = avatarEl.getAttribute('src') || "";
    }

    if (!avatar) {
        avatarEl = doc.querySelector('img[style*="border-radius"]');
        if (avatarEl) avatar = avatarEl.getAttribute('src') || "";
    }

    // Never guess from an unlabelled image: that would pick up a video thumbnail
    if (!avatar) {
        avatarEl = doc.querySelector('img[src*="yt3.googleusercontent.com"]');
        if (avatarEl) avatar = avatarEl.getAttribute('src') || "";
    }

    return { name: channelName, avatar: relayUrl(avatar) };
}

/**
 * Detect a Cloudflare challenge/interstitial page
 * @param {string} body
 * @returns {boolean}
 */
function isCloudflareChallenge(body) {
    if (!body || typeof body !== "string") return false;

    return body.indexOf("Just a moment") !== -1 ||
           body.indexOf("_cf_chl_opt") !== -1 ||
           body.indexOf("Enable JavaScript and cookies to continue") !== -1;
}

/**
 * Normalize a channel name scraped from a page, rejecting id-only values
 * @param {string|null} raw
 * @param {string} channelId
 * @returns {string|null}
 */
function cleanChannelName(raw, channelId) {
    if (!raw) return null;

    let name = raw.replace(/\s+/g, ' ').trim();
    name = name.replace(/\s*\|\s*PreserveTube\s*$/i, '').trim();
    name = name.replace(/\s+videos\s*$/i, '').trim();

    // Page titles fall back to the raw id, e.g. "UC... videos | PreserveTube"
    if (!name || name === channelId || name.replace(/^@/, '') === (channelId || "").replace(/^@/, ''))
        return null;

    return name;
}

/**
 * Parse the channel profile (.channel-profile) used by watch pages and video cards
 * @param {string} html
 * @returns {{id: string, name: string, avatar: string}|null}
 */
function parseChannelProfileFromHtml(html) {
    if (!html || isCloudflareChallenge(html)) return null;

    const doc = domParser.parseFromString(html, "text/html");
    const profileEl = doc.querySelector('.channel-profile');
    if (!profileEl) return null;

    const channelImg = profileEl.querySelector('img');
    const channelLink = profileEl.querySelector('a[href*="/channel/"]');
    const href = channelLink ? channelLink.getAttribute('href') : "";
    const idMatch = href ? href.match(/\/channel\/(@?[\w\-_]+)/) : null;
    const name = channelLink ? channelLink.textContent.trim() : "";

    if (!name && !channelImg) return null;

    return {
        id: idMatch ? idMatch[1] : "",
        name: name,
        avatar: relayUrl(channelImg ? channelImg.getAttribute('src') || "" : "")
    };
}

/**
 * Fetch the channel videos listing (the channel page itself is usually challenged)
 * @param {string} channelId
 * @returns {string|null}
 */
function fetchChannelVideosHtml(channelId) {
    const videosResult = makeGetRequest(`${platform.url}/channel/${channelId}/videos`, false, true);
    if (videosResult && !videosResult.error && !isCloudflareChallenge(videosResult))
        return videosResult;

    if (videosResult && videosResult.error)
        log(`Channel /videos page error for ${channelId}: HTTP ${videosResult.code}`);

    const pageResult = makeGetRequest(`${platform.url}/channel/${channelId}`, false, true);
    if (pageResult && !pageResult.error && !isCloudflareChallenge(pageResult))
        return pageResult;

    if (pageResult && pageResult.error)
        log(`Channel page error for ${channelId}: HTTP ${pageResult.code}`);

    return null;
}

/**
 * Fetch the channel profile from a video watch page
 * @param {string} videoId
 * @returns {{id: string, name: string, avatar: string}|null}
 */
function fetchChannelProfileFromWatchPage(videoId) {
    const html = makeGetRequest(`${platform.url}/watch?v=${videoId}`, false, true);
    if (!html || html.error) {
        if (html && html.error)
            log(`Watch page error for channel lookup ${videoId}: HTTP ${html.code}`);
        return null;
    }

    return parseChannelProfileFromHtml(html);
}

/**
 * Resolve the playable media url from a watch page
 * @param {Document} doc
 * @returns {string|null}
 */
function resolveVideoUrl(doc) {
    const videoEl = doc.querySelector('video');
    if (videoEl) {
        const src = videoEl.getAttribute('src');
        if (src) return resolveUrl(src);

        const sourceEl = videoEl.querySelector('source');
        if (sourceEl && sourceEl.getAttribute('src'))
            return resolveUrl(sourceEl.getAttribute('src'));
    }

    // The metadata block links straight to the archived file
    const downloadEl = doc.querySelector('a[href*="/preservetube/"]');
    if (downloadEl && downloadEl.getAttribute('href'))
        return resolveUrl(downloadEl.getAttribute('href'));

    return null;
}

/**
 * Determine the container and codec for an archived file. PreserveTube serves
 * newer archives as .mp4 and older ones as .webm, so this cannot be hardcoded.
 * @param {string} sourceUrl
 * @returns {{container: string, codec: string, label: string}}
 */
function describeVideoSource(sourceUrl) {
    const path = sourceUrl.split('?')[0].toLowerCase();

    if (path.endsWith('.webm')) {
        return { container: "video/webm", codec: "vp9", label: "WEBM" };
    }
    if (path.endsWith('.mkv')) {
        return { container: "video/x-matroska", codec: "h264", label: "MKV" };
    }
    if (path.endsWith('.m3u8')) {
        return { container: "application/vnd.apple.mpegurl", codec: "", label: "HLS" };
    }

    return { container: "video/mp4", codec: "h264", label: "MP4" };
}

/**
 * Base url of the local media relay, derived from where this plugin is served
 * from. Only a plugin loaded from a private address uses a relay.
 * @returns {string}
 */
function getRelayBase() {
    if (relayBase !== null) return relayBase;

    const sourceUrl = (config && (config.sourceUrl || config.scriptUrl)) || "";
    const match = sourceUrl.match(/^(https?:\/\/[^\/]+)\//i);
    const isPrivate = match && /^https?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|127\.)/i.test(match[1]);

    relayBase = isPrivate ? match[1] + RELAY_PATH : "";

    if (relayBase) log("Relaying PreserveTube media through " + relayBase);
    return relayBase;
}

/**
 * Point urls that still target the retired minio.lain.la mirror at the host
 * that serves the same files. Older archives were scraped with that mirror and
 * it does not serve anything any more, so their thumbnails would be broken.
 * @param {string|null} url
 * @returns {string}
 */
function migrateCdnUrl(url) {
    if (!url) return "";

    return url.replace(/^https?:\/\/minio\.lain\.la\//i, "https://s0.archive.party/");
}

/**
 * Route a PreserveTube CDN url through the local relay when there is one
 * @param {string|null} url
 * @returns {string}
 */
function relayUrl(url) {
    url = migrateCdnUrl(url);
    if (!url) return "";

    const base = getRelayBase();
    if (!base) return url;

    const hostMatch = url.match(/^https?:\/\/([^\/\?#]+)/i);
    if (!hostMatch || !RELAY_HOSTS.test(hostMatch[1].split(':')[0]))
        return url;

    return base + encodeURIComponent(url);
}

/**
 * Make a scraped url absolute
 * @param {string|null} url
 * @returns {string}
 */
function resolveUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf('//') === 0) return "https:" + url;
    if (url.charAt(0) === '/') return platform.url + url;
    return `${platform.url}/${url}`;
}

/**
 * Build PreserveTube save URL for archiving
 * @param {string} videoId
 * @returns {string}
 */
function buildSaveUrl(videoId) {
    const youtubeUrl = buildYouTubeUrl(videoId);
    return `${platform.url}/save?url=${encodeURIComponent(youtubeUrl)}`;
}

log("PreserveTube plugin loaded");
