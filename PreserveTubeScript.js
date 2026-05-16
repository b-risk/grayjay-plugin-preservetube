const PLATFORM = "PreserveTube";
const PLATFORM_BASE_URL = "https://preservetube.com";

// URL patterns - PreserveTube
const REGEX_VIDEO_URL = /https:\/\/preservetube\.com\/watch\?v=([\w\-_]{11})/;
const REGEX_CHANNEL_URL = /https:\/\/preservetube\.com\/channel\/(@?[\w\-_]+)/;
const REGEX_CHANNEL_VIDEOS_URL = /https:\/\/preservetube\.com\/channel\/(@?[\w\-_]+)\/videos/;

// URL patterns - YouTube Video (to fetch archived versions)
// Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/v/,
//           youtube.com/shorts/, music.youtube.com/watch?v=
const REGEX_YOUTUBE_VIDEO_WATCH = /https?:\/\/(?:www\.|music\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([\w\-_]{11})/;
const REGEX_YOUTUBE_VIDEO_SHARE = /https?:\/\/youtu\.be\/([\w\-_]{11})/;
const REGEX_YOUTUBE_VIDEO_EMBED = /https?:\/\/(?:www\.)?youtube\.com\/embed\/([\w\-_]{11})/;
const REGEX_YOUTUBE_VIDEO_V = /https?:\/\/(?:www\.)?youtube\.com\/v\/([\w\-_]{11})/;
const REGEX_YOUTUBE_VIDEO_SHORTS = /https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\/([\w\-_]{11})/;

// URL patterns - YouTube Channel
// Supports: youtube.com/channel/UCxxx, youtube.com/@handle, youtube.com/c/name, youtube.com/user/name
const REGEX_YOUTUBE_CHANNEL_ID = /https?:\/\/(?:www\.|m\.)?youtube\.com\/channel\/(UC[\w\-_]{22})/;
const REGEX_YOUTUBE_CHANNEL_HANDLE = /https?:\/\/(?:www\.|m\.)?youtube\.com\/@([\w\-_.]+)/;
const REGEX_YOUTUBE_CHANNEL_CUSTOM = /https?:\/\/(?:www\.|m\.)?youtube\.com\/c\/([^\/\?]+)/;
const REGEX_YOUTUBE_CHANNEL_USER = /https?:\/\/(?:www\.|m\.)?youtube\.com\/user\/([^\/\?]+)/;

// State
let config = {};
let _settings = {};
let state = {
    channelCache: {}
};

// Source: Enable
source.enable = function(conf, settings, savedState) {
    config = conf ?? {};
    _settings = settings ?? {};

    if (savedState) {
        try {
            state = JSON.parse(savedState);
        } catch (e) {
            log("Failed to parse saved state: " + e.message);
        }
    }

    log("PreserveTube plugin enabled");
};

// Source: Disable
source.disable = function() {
    log("PreserveTube plugin disabled");
};

// Source: Save State
source.saveState = function() {
    return JSON.stringify(state);
};

// Source: Get Home (Latest videos)
source.getHome = function() {
    const url = `${PLATFORM_BASE_URL}/latest`;
    const html = makeGetRequest(url, false);

    if (!html) {
        throw new ScriptException("Failed to fetch home page from PreserveTube");
    }

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
            url: `${PLATFORM_BASE_URL}/watch?v=${card.id}`,
            isLive: false
        }));
    }

    return new VideoPager(videos, false);
};

// Source: Search Capabilities
source.getSearchCapabilities = function() {
    return {
        types: ["Video", "Channel"],
        sorts: [],
        filters: []
    };
};

// Source: Search Suggestions
source.searchSuggestions = function(query) {
    return [];
};

// Source: Search
source.search = function(query, type, order, filters) {
    const url = `${PLATFORM_BASE_URL}/search?search=${encodeURIComponent(query)}`;
    const html = makeGetRequest(url, false);

    if (!html) {
        throw new ScriptException("Failed to search PreserveTube: " + query);
    }

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
            url: `${PLATFORM_BASE_URL}/watch?v=${card.id}`,
            isLive: false
        }));
    }

    return new VideoPager(videos, false);
};

// Source: Get Search Channel Contents Capabilities
source.getSearchChannelContentsCapabilities = function() {
    return {
        types: ["Video"],
        sorts: [],
        filters: []
    };
};

// Source: Search Channel Contents
source.searchChannelContents = function(url, query, type, order, filters, continuationToken) {
    return source.search(query, type, order, filters);
};

// Source: Search Channels
source.searchChannels = function(query, continuationToken) {
    const url = `${PLATFORM_BASE_URL}/search?search=${encodeURIComponent(query)}`;
    const html = makeGetRequest(url, false);

    if (!html) {
        throw new ScriptException("Failed to search PreserveTube channels: " + query);
    }

    const videoCards = parseVideoCardsFromHtml(html);
    const seenChannels = new Set();
    const channels = [];

    const queryLower = query.toLowerCase();

    for (const card of videoCards) {
        if (!card.channel || seenChannels.has(card.channel.id)) continue;
        seenChannels.add(card.channel.id);

        if (!card.channel.name.toLowerCase().includes(queryLower)) continue;

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
};

// Helper: Build PreserveTube save URL for archiving
function buildSaveUrl(videoId) {
    const youtubeUrl = buildYouTubeUrl(videoId);
    return `${PLATFORM_BASE_URL}/save?url=${encodeURIComponent(youtubeUrl)}`;
}

// Source: Is Content Details URL (accepts PreserveTube and YouTube video URLs)
source.isContentDetailsUrl = function(url) {
    if (REGEX_VIDEO_URL.test(url)) return true;
    return !!extractVideoId(url);
};

// Source: Get Content Details
source.getContentDetails = function(url) {
    const videoId = extractVideoId(url);

    if (!videoId) {
        throw new ScriptException("Invalid video URL: " + url);
    }

    // Fetch the HTML watch page (JSON API is blocked with 403)
    const watchUrl = `${PLATFORM_BASE_URL}/watch?v=${videoId}`;
    const result = makeGetRequest(watchUrl, false, true);

    // Helper: redirect to YouTube when video isn't available on PreserveTube
    function redirectToYouTube() {
        return new PlatformNestedMediaContent({
            id: createPlatformID(videoId),
            name: videoId,
            author: createAuthorLink("youtube", "YouTube", "https://youtube.com", ""),
            datetime: Math.floor(Date.now() / 1000),
            url: url,
            contentUrl: buildYouTubeUrl(videoId),
            contentName: videoId,
            contentProvider: "Youtube"
        });
    }

    // Check for HTTP errors
    if (result && result.error) {
        const errorCode = result.code || "unknown";
        const errorBody = result.body ? result.body.substring(0, 200) : "";
        log(`Watch page error [${errorCode}]: ${watchUrl} body: ${errorBody}`);

        if (errorCode === 404) {
            if (_settings.usePreserveTubeArchiving === true) {
                // Video not archived - throw captcha exception to allow archiving
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
            log(`Video ${videoId} not archived, redirecting to YouTube`);
            return redirectToYouTube();
        }

        bridge.toast("PreserveTube error, falling back to YouTube");
        log(`Falling back to YouTube for ${videoId} (HTTP ${errorCode})`);
        return redirectToYouTube();
    }

    if (!result) {
        log(`Null response for ${videoId}, falling back to YouTube`);
        return redirectToYouTube();
    }

    const body = result;

    // Parse title from h1
    const titleMatch = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : `Video ${videoId}`;

    // Parse channel info from channel-profile section
    let channelId = null;
    let channelName = "Unknown";
    let channelAvatar = "";

    const channelMatch = body.match(/<div class="channel-profile">\s*<img src="([^"]*)"[^>]*>\s*<span class="channel-name"><a href="\/channel\/(@?[\w\-_]+)">([^<]+)<\/a><\/span>\s*<\/div>/i);
    if (channelMatch) {
        channelAvatar = channelMatch[1];
        channelId = channelMatch[2];
        channelName = channelMatch[3].trim();
    }

    // Parse video source from <video> tag
    const videoSrcMatch = body.match(/<video[^>]*src="([^"]*)"/i);
    const sourceUrl = videoSrcMatch ? videoSrcMatch[1] : `https://s0.archive.party/preservetube/${videoId}.webm`;

    // Parse thumbnail from poster attribute
    const posterMatch = body.match(/<video[^>]*poster="([^"]*)"/i);
    const thumbnail = posterMatch ? posterMatch[1] : "";

    // Parse published date
    const dateMatch = body.match(/Published on (\d{4}-\d{2}-\d{2})/i);
    const publishedDate = dateMatch ? dateMatch[1] : null;

    // Parse description
    const descMatch = body.match(/<p class="description">([\s\S]*?)<\/p>/i);
    const description = descMatch ? descMatch[1].trim() : "";

    const author = createAuthorLink(
        channelId || "unknown",
        channelName,
        channelId ? `${PLATFORM_BASE_URL}/channel/${channelId}` : null,
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
};

// Source: Is Channel URL (accepts PreserveTube and YouTube channel URLs)
source.isChannelUrl = function(url) {
    if (REGEX_CHANNEL_URL.test(url)) return true;
    if (_settings.youtubeChannelSeparation === false) return isYouTubeChannelUrl(url);
    return false;
};

// Source: Get Channel
source.getChannel = function(url) {
    const channelId = extractChannelId(url);

    if (!channelId) {
        throw new ScriptException("Invalid channel URL: " + url);
    }

    // Check cache
    if (state.channelCache[channelId]) {
        return state.channelCache[channelId];
    }

    // Fetch channel page to get metadata
    const channelUrl = `${PLATFORM_BASE_URL}/channel/${channelId}`;
    const htmlResult = makeGetRequest(channelUrl, false, true);

    let channelName = channelId;
    let avatar = "";

    if (htmlResult && htmlResult.error) {
        log(`PreserveTube channel page error for ${channelId}: HTTP ${htmlResult.code} — using fallback info`);
    } else if (htmlResult) {
        // Parse channel info from HTML
        // Try each name pattern until one matches
        // Pattern 1: h1 tag
        let nameFound = false;
        const h1Match = htmlResult.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1Match) {
            channelName = h1Match[1].trim();
            nameFound = true;
        }

        // Pattern 2: title tag (strip " | PreserveTube" suffix)
        if (!nameFound) {
            const titleMatch = htmlResult.match(/<title>([^|]+)\s*\|/i);
            if (titleMatch) {
                channelName = titleMatch[1].trim();
                nameFound = true;
            }
        }

        // Pattern 3: og:title meta tag
        if (!nameFound) {
            const ogMatch = htmlResult.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
            if (ogMatch) {
                channelName = ogMatch[1].replace(/\s*\|\s*PreserveTube\s*$/i, '').trim();
                nameFound = true;
            }
        }

        // Pattern 4: channel-name link on the page
        if (!nameFound) {
            const channelLinkMatch = htmlResult.match(/<a[^>]*href="\/channel\/(@?[\w\-_]+)"[^>]*>\s*([^<]+?)\s*<\/a>/i);
            if (channelLinkMatch) {
                channelName = channelLinkMatch[2].trim();
            }
        }

        // Look for channel avatar - try multiple patterns
        // Pattern 1: class="...avatar..."
        const avatarMatch = htmlResult.match(/<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]*)"[^>]*>/i);
        if (avatarMatch) {
            avatar = avatarMatch[1];
        }

        // Pattern 2: style with border-radius
        if (!avatar) {
            const altAvatarMatch = htmlResult.match(/<img[^>]*style="[^"]*border-radius[^"]*"[^>]*src="([^"]*)"[^>]*>/i);
            if (altAvatarMatch) {
                avatar = altAvatarMatch[1];
            }
        }

        // Pattern 3: inside channel-profile div (actual PreserveTube pattern)
        if (!avatar) {
            const profileMatch = htmlResult.match(/<div class="channel-profile">\s*<img src="([^"]*)"/i);
            if (profileMatch) {
                avatar = profileMatch[1];
            }
        }

        // Pattern 4: yt3.googleusercontent.com image (channel avatar on channel page)
        if (!avatar) {
            const ytImgMatch = htmlResult.match(/<img[^>]+src="(https:\/\/yt3\.googleusercontent\.com[^"]*)"/i);
            if (ytImgMatch) {
                avatar = ytImgMatch[1];
            }
        }

        // Pattern 5: first img that isn't a thumbnail
        if (!avatar) {
            const firstImgMatch = htmlResult.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
            // Only use it if it's not a thumbnail
            if (firstImgMatch && firstImgMatch[1] && !firstImgMatch[0].includes('class="thumbnail"')) {
                avatar = firstImgMatch[1];
            }
        }
    }

    // Build channel URLs: use PreserveTube as main when separation is enabled
    const youtubeChannelUrl = buildYouTubeChannelUrl(channelId);
    const mainUrl = _settings.youtubeChannelSeparation !== false ? channelUrl : (youtubeChannelUrl || channelUrl);
    const urlAlternatives = _settings.youtubeChannelSeparation !== false ? [] : (youtubeChannelUrl ? [channelUrl] : []);

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
};

// Source: Get Channel Capabilities
source.getChannelCapabilities = function() {
    return {
        types: ["Video"],
        sorts: [],
        filters: []
    };
};

// Source: Get Channel Contents
source.getChannelContents = function(url, type, order, filters) {
    const channelId = extractChannelId(url);

    if (!channelId) {
        throw new ScriptException("Invalid channel URL for contents: " + url);
    }

    // Try the /videos endpoint first for archived-only videos
    let channelUrl = `${PLATFORM_BASE_URL}/channel/${channelId}/videos`;
    let html = null;
    try {
        html = makeGetRequest(channelUrl, false);
    } catch (e) {
        log(`Channel /videos page failed, trying main page: ${e.message}`);
    }

    // If that fails, try the main channel page
    if (!html) {
        channelUrl = `${PLATFORM_BASE_URL}/channel/${channelId}`;
        html = makeGetRequest(channelUrl, false);
    }

    if (!html) {
        throw new ScriptException("Failed to fetch channel contents from PreserveTube: " + channelId);
    }

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
        : createAuthorLink(channelId, channelId, `${PLATFORM_BASE_URL}/channel/${channelId}`, "");

    for (const card of videoCards) {
        videos.push(new PlatformVideo({
            id: createPlatformID(card.id),
            name: card.title || `Video ${card.id}`,
            thumbnails: new Thumbnails([new Thumbnail(card.thumbnail, 0)]),
            author: author,
            uploadDate: parseDate(card.publishedDate),
            duration: 0,
            viewCount: -1,
            url: `${PLATFORM_BASE_URL}/watch?v=${card.id}`,
            isLive: false
        }));
    }

    return new VideoPager(videos, false);
};


// Helper: Create PlatformID
function createPlatformID(id) {
    return new PlatformID(PLATFORM, id, config?.id);
}

// Helper: Create PlatformID for a channel (with prefix when separation is enabled)
function createChannelPlatformID(channelId) {
    const prefixed = _settings.youtubeChannelSeparation !== false ? "preservetube://" + channelId : channelId;
    return createPlatformID(prefixed);
}

// Helper: Create PlatformAuthorLink
function createAuthorLink(channelId, channelName, channelUrl, thumbnail) {
    return new PlatformAuthorLink(
        createChannelPlatformID(channelId),
        channelName || "Unknown",
        channelUrl || `${PLATFORM_BASE_URL}/channel/${channelId}`,
        thumbnail || ""
    );
}

// Helper: Parse date string to Unix timestamp
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

// Helper: Extract video ID from URL (supports PreserveTube and YouTube URLs)
function extractVideoId(url) {
    // Try PreserveTube URL first
    let match = url.match(REGEX_VIDEO_URL);
    if (match) return match[1];

    // Try all YouTube URL patterns
    match = url.match(REGEX_YOUTUBE_VIDEO_WATCH);
    if (match) return match[1];

    match = url.match(REGEX_YOUTUBE_VIDEO_SHARE);
    if (match) return match[1];

    match = url.match(REGEX_YOUTUBE_VIDEO_EMBED);
    if (match) return match[1];

    match = url.match(REGEX_YOUTUBE_VIDEO_V);
    if (match) return match[1];

    match = url.match(REGEX_YOUTUBE_VIDEO_SHORTS);
    if (match) return match[1];

    return null;
}

// Helper: Check if URL is a YouTube video URL
function isYouTubeVideoUrl(url) {
    return REGEX_YOUTUBE_VIDEO_WATCH.test(url) ||
           REGEX_YOUTUBE_VIDEO_SHARE.test(url) ||
           REGEX_YOUTUBE_VIDEO_EMBED.test(url) ||
           REGEX_YOUTUBE_VIDEO_V.test(url) ||
           REGEX_YOUTUBE_VIDEO_SHORTS.test(url);
}

// Helper: Extract channel ID from URL (supports PreserveTube and YouTube URLs)
function extractChannelId(url) {
    // Try PreserveTube URL first
    let match = url.match(REGEX_CHANNEL_URL);
    if (match) return match[1];

    // Try YouTube channel ID (UCxxx)
    match = url.match(REGEX_YOUTUBE_CHANNEL_ID);
    if (match) return match[1];

    // Try YouTube handle (@name)
    match = url.match(REGEX_YOUTUBE_CHANNEL_HANDLE);
    if (match) return "@" + match[1];

    // Try YouTube custom URL (/c/name)
    match = url.match(REGEX_YOUTUBE_CHANNEL_CUSTOM);
    if (match) return match[1];

    // Try YouTube user URL (/user/name)
    match = url.match(REGEX_YOUTUBE_CHANNEL_USER);
    if (match) return match[1];

    return null;
}

// Helper: Check if URL is a YouTube channel URL
function isYouTubeChannelUrl(url) {
    return REGEX_YOUTUBE_CHANNEL_ID.test(url) ||
           REGEX_YOUTUBE_CHANNEL_HANDLE.test(url) ||
           REGEX_YOUTUBE_CHANNEL_CUSTOM.test(url) ||
           REGEX_YOUTUBE_CHANNEL_USER.test(url);
}

// Helper: Sleep for a given duration (catches error if Thread is not available)
function sleep(ms) {
    try {
        java.lang.Thread.sleep(ms);
    } catch (e) {
        log("Sleep not available, continuing without delay");
    }
}

// Helper: Make HTTP GET request with retry logic for transient failures
function makeGetRequest(url, parseJson = true, returnError = false) {
    const maxRetries = 3;
    const retryDelay = 1000;
    const retryStatuses = [408, 429, 500, 502, 503, 504];

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const resp = http.GET(url, {});
            if (!resp.isOk) {
                log(`Request failed with status ${resp.code}: ${url} (attempt ${attempt}/${maxRetries})`);
                if (resp.code === 404) {
                    // Not found is a normal response, not an error
                    if (returnError) {
                        return { error: true, code: 404, body: resp.body };
                    }
                    return null;
                }
                if (attempt < maxRetries && retryStatuses.includes(resp.code)) {
                    bridge.toast("PreserveTube is having issues, retrying...");
                    sleep(retryDelay);
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
                sleep(retryDelay);
            }
        }
    }

    bridge.toast("PreserveTube is unavailable right now");
    if (returnError) {
        return { error: true, code: 0, body: lastError ? lastError.message : "Unknown error" };
    }
    throw new ScriptException(`PreserveTube request failed after ${maxRetries} attempts: ${url} - ${lastError ? lastError.message : "Unknown error"}`);
}

// Helper: Build YouTube URL from video ID
function buildYouTubeUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

// Helper: Build YouTube channel URL from channel ID
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

// Helper: Parse video cards from HTML
// Returns array of objects with video info AND associated channel info
function parseVideoCardsFromHtml(html) {
    const videos = [];
    const seenIds = new Set();

    // Match each .video block using depth counting for nested divs
    const videoStart = '<div class="video">';
    let pos = 0;
    while ((pos = html.indexOf(videoStart, pos)) !== -1) {
        let depth = 1;
        let i = pos + videoStart.length;
        while (i < html.length && depth > 0) {
            const openTag = html.indexOf('<div', i);
            const closeTag = html.indexOf('</div>', i);
            if (closeTag === -1) break;
            if (openTag !== -1 && openTag < closeTag) {
                depth++;
                i = openTag + 4;
            } else {
                depth--;
                i = closeTag + 6;
            }
        }
        if (depth !== 0) break;
        const blockEnd = i;
        const cardContent = html.substring(pos + videoStart.length, blockEnd - 6);

        const videoLinkMatch = cardContent.match(/<a[^>]*href="\/watch\?v=([\w\-_]{11})"[^>]*>/i);
        if (!videoLinkMatch) { pos = blockEnd; continue; }
        const videoId = videoLinkMatch[1];
        if (seenIds.has(videoId)) { pos = blockEnd; continue; }
        seenIds.add(videoId);

        // Extract thumbnail
        const thumbMatch = cardContent.match(/<img[^>]*src="([^"]*)"[^>]*>/i);
        const thumbnail = thumbMatch ? thumbMatch[1] : "";

        // Extract title
        const titleMatch = cardContent.match(/<div class="title">([\s\S]*?)<\/div>/i);
        let title = titleMatch ? titleMatch[1].trim() : `Video ${videoId}`;
        title = title.replace(/\s+/g, ' ').trim();

        // Extract dates
        const dateMatch = cardContent.match(/<div class="date">([\s\S]*?)<\/div>/i);
        const dateText = dateMatch ? dateMatch[1] : "";
        let publishedDate = null;
        let archivedDate = null;
        const pubMatch = dateText.match(/Published on\s+([^|]+)/i);
        if (pubMatch) publishedDate = pubMatch[1].trim();
        const archMatch = dateText.match(/Archived on\s+(.+)/i);
        if (archMatch) archivedDate = archMatch[1].trim();

        // Extract channel info from channel-profile
        let channelInfo = null;
        const profileMatch = cardContent.match(/<div class="channel-profile">([\s\S]*?)<\/div>/i);
        if (profileMatch) {
            const channelContent = profileMatch[1];
            const channelLinkMatch = channelContent.match(/<a[^>]*href="\/channel\/(@?[\w\-_]+)"[^>]*>([\s\S]*?)<\/a>/i);
            if (channelLinkMatch) {
                const channelImgMatch = channelContent.match(/<img[^>]*src="([^"]*)"[^>]*>/i);
                channelInfo = {
                    id: channelLinkMatch[1],
                    name: channelLinkMatch[2].trim(),
                    avatar: channelImgMatch ? channelImgMatch[1] : "",
                    url: `${PLATFORM_BASE_URL}/channel/${channelLinkMatch[1]}`
                };
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

        pos = blockEnd;
    }

    return videos;
}

// Helper: Get video source descriptor
function getVideoSource(videoData) {
    const sourceUrl = videoData.source || `https://s0.archive.party/preservetube/${videoData.id}.webm`;

    return new VideoSourceDescriptor([
        new VideoUrlSource({
            name: "WebM",
            container: "video/webm",
            url: sourceUrl,
            width: 0,
            height: 0,
            duration: 0,
            codec: "vp9"
        })
    ]);
}

log("PreserveTube plugin loaded");
