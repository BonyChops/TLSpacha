require("dotenv").config();
const { TwitterApi, EUploadMimeType } = require("twitter-api-v2");
const Canvas = require("canvas");
const Image = Canvas.Image;
const { SpachaImage } = require("spacha");
const { findKanjiNumbers, kanji2number } = require('@geolonia/japanese-numeral');

const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

const devlog = (data) => {
    if (process.env.DEV === "TRUE") {
        console.dir(data, {depth: 4});
    }
}

const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_KEY_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

//const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);

const generateSpacha = async (tweet, author) => {
    const canvas = new Canvas.Canvas(600, 300);
    const ctx = canvas.getContext("2d");
    const iconImg = new Image;
    iconImg.src = author.protected ? process.env.DEFAULT_ICON : author.profile_image_url.replace("_normal", "");
    await new Promise((resolve) => { iconImg.onload = resolve });
    devlog(author);
    const text = tweet.text;
    devlog(text);
    devlog((text.match(/[0-9.,]+/g)));
    const numbers = [...(text.match(/[\-0-9.,]+/g) ?? []).map(v => v.replaceAll(",", "")), ...findKanjiNumbers(text).map(v => kanji2number(v))].filter(v => !isNaN(v)).map(v => Number(v));
    numbers.sort((a, b) => b - a);
    devlog(numbers);
    devlog(numbers[0]);
    new SpachaImage(ctx, {
        price: numbers[0],
        user: {
            name: author.protected ? "一般ユーザー" : author.name,
            img: iconImg
        },
        message: author.protected ? text.replaceAll(author.username, "一般ユーザー") : text
    });

    const b64 = canvas.toDataURL().split(",")[1];
    const buf = Buffer.from(b64, 'base64');
    return buf;
}

(async () => {
    const homeTimeline = await client.v2.homeTimeline({ exclude: ['replies', "retweets"], max_results: 100, expansions: ["author_id", "attachments.media_keys"], "user.fields": ["name", "profile_image_url", "id", "protected", "username"], "tweet.fields": ["entities"] });
    const tweets = homeTimeline.tweets.filter(v => v.author_id !== process.env.BOT_ID)
    devlog(tweets);
    devlog(homeTimeline.rateLimit);
    const tweet = process.env.TWEET_ID ? tweets.find(v => v.id === process.env.TWEET_ID) : tweets[getRandomInt(0, tweets.length)];
    tweet.text = tweet.entities?.urls ? tweet.entities.urls.reduce((acc, val) => (acc.replaceAll(val.url, val.expanded_url)), tweet.text) : tweet.text;
    devlog(tweet);
    if (!tweet) {
        process.exit(0);
    }
    const spachaBuf = await generateSpacha(tweet, homeTimeline.includes.author(tweet));

    if (process.env.MODE === "test") {
        process.exit(0);
    }

    const mediaId = await client.v1.uploadMedia(spachaBuf, { mimeType: EUploadMimeType.Png });

    await client.v2.tweet({ media: { media_ids: [mediaId] } });
    await client.v2.like(process.env.BOT_ID, tweet.id);
})();