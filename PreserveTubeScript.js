// Platform information
const platform = {
    title: 'PreserveTube',
    url: 'https://preservetube.com'
}

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
source.getChannel = function(url) {
    const channelId = extractChannelId(url);

    if (!channelId) 
        throw new ScriptException("Invalid channel URL: " + url);

    // Check cache
    if (state.channelCache[channelId]) 
        return state.channelCache[channelId];

    // Fetch channel page to get metadata
    const channelUrl = `${platform.url}/channel/${channelId}`;
    const htmlResult = makeGetRequest(channelUrl, false, true);

    let channelName = channelId;
    let avatar = "";

    if (htmlResult && htmlResult.error) {
        log(`PreserveTube channel page error for ${channelId}: HTTP ${htmlResult.code} — using fallback info`);
    } else if (htmlResult) {
        const parsed = parseChannelInfoFromHtml(htmlResult, channelId);
        channelName = parsed.name;
        avatar = parsed.avatar;
    }

    // Build channel URLs: use PreserveTube as main when separation is enabled
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

    // Cache the channel
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

    // Try the /videos endpoint first for archived-only videos
    let channelUrl = `${platform.url}/channel/${channelId}/videos`;
    let html = null;
    try {
        html = makeGetRequest(channelUrl, false);
    } catch (e) {
        log(`Channel /videos page failed, trying main page: ${e.message}`);
    }

    // If that fails, try the main channel page
    if (!html) {
        channelUrl = `${platform.url}/channel/${channelId}`;
        html = makeGetRequest(channelUrl, false);
    }

    if (!html)
        throw new ScriptException("Failed to fetch channel contents from PreserveTube: " + channelId);

    const videoCards = parseVideoCardsFromHtml(html);
    const videos = [];

    // Get channel info for author
    let channel;
    try {
        channel = source.getChannel(url);
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
            if (!resp.isOk) {
                log(`Request failed with status ${resp.code}: ${url} (attempt ${attempt}/${maxRetries})`);
                if (resp.code === 404) {
                    if (returnError) {
                        return { error: true, code: 404, body: resp.body };
                    }
                    return null;
                }
                if (attempt < maxRetries && retryStatuses.includes(resp.code)) {
                    bridge.toast("PreserveTube is having issues, retrying...");
                    continue;
                }
                if (returnError) {
                    bridge.toast("PreserveTube is unavailable right now");
                    return { error: true, code: resp.code, body: resp.body };
                }
                bridge.toast("PreserveTube is unavailable right now");
                throw new ScriptException(`PreserveTube request failed: ${url} (HTTP ${resp.code})`);
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
        const thumbnail = img ? img.getAttribute('src') || "" : "";

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
                        avatar: channelImg ? channelImg.getAttribute('src') || "" : "",
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

    const profileEl = doc.querySelector('.channel-profile');
    if (profileEl) {
        const channelImg = profileEl.querySelector('img');
        const channelLink = profileEl.querySelector('a[href*="/channel/"]');
        if (channelImg) channelAvatar = channelImg.getAttribute('src') || "";
        if (channelLink) {
            const chHref = channelLink.getAttribute('href');
            const chIdMatch = chHref.match(/\/channel\/(@?[\w\-_]+)/);
            if (chIdMatch) {
                channelId = chIdMatch[1];
                channelName = channelLink.textContent.trim();
            }
        }
    }

    const videoEl = doc.querySelector('video');
    const sourceUrl = videoEl
        ? videoEl.getAttribute('src') || `https://s0.archive.party/preservetube/${videoId}.webm`
        : `https://s0.archive.party/preservetube/${videoId}.webm`;
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
        thumbnails: new Thumbnails([new Thumbnail(thumbnail || "", 0)]),
        author: author,
        uploadDate: parseDate(publishedDate),
        duration: 0,
        viewCount: -1,
        url: watchUrl,
        isLive: false,
        description: description,
        video: new VideoSourceDescriptor([
            new VideoUrlSource({
                name: "MP4",
                container: "video/mp4",
                url: sourceUrl,
                width: 0,
                height: 0,
                duration: 0,
                codec: "h264"
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
    const doc = domParser.parseFromString(html, "text/html");
    let channelName = channelId;
    let avatar = "";

    let nameFound = false;
    const h1El = doc.querySelector('h1');
    if (h1El) {
        channelName = h1El.textContent.trim();
        nameFound = true;
    }

    if (!nameFound) {
        const titleEl = doc.querySelector('title');
        if (titleEl) {
            const titleText = titleEl.textContent;
            const titleParts = titleText.split('|');
            if (titleParts.length > 0) {
                channelName = titleParts[0].trim();
                nameFound = true;
            }
        }
    }

    if (!nameFound) {
        const ogEl = doc.querySelector('meta[property="og:title"]');
        if (ogEl) {
            const content = ogEl.getAttribute('content');
            if (content) {
                channelName = content.replace(/\s*\|\s*PreserveTube\s*$/i, '').trim();
                nameFound = true;
            }
        }
    }

    if (!nameFound) {
        const channelLink = doc.querySelector('a[href*="/channel/"]');
        if (channelLink) {
            channelName = channelLink.textContent.trim();
        }
    }

    let avatarEl = doc.querySelector('img[class*="avatar"]');
    if (avatarEl) avatar = avatarEl.getAttribute('src') || "";

    if (!avatar) {
        avatarEl = doc.querySelector('img[style*="border-radius"]');
        if (avatarEl) avatar = avatarEl.getAttribute('src') || "";
    }

    if (!avatar) {
        avatarEl = doc.querySelector('.channel-profile img');
        if (avatarEl) avatar = avatarEl.getAttribute('src') || "";
    }

    if (!avatar) {
        avatarEl = doc.querySelector('img[src*="yt3.googleusercontent.com"]');
        if (avatarEl) avatar = avatarEl.getAttribute('src') || "";
    }

    if (!avatar) {
        const allImgs = doc.querySelectorAll('img');
        for (let i = 0; i < allImgs.length; i++) {
            const img = allImgs[i];
            const cls = img.getAttribute('class') || "";
            if (cls.indexOf('thumbnail') === -1) {
                avatar = img.getAttribute('src') || "";
                break;
            }
        }
    }

    return { name: channelName, avatar: avatar };
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
