require("dotenv").config();
const { TwitterApi, EUploadMimeType } = require("twitter-api-v2");
const Canvas = require("canvas");
const Image = Canvas.Image;
const { SpachaImage } = require("spacha");

const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

const devlog = (data) => {
    if (process.env.DEV === "TRUE") {
        console.log(data);
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
    iconImg.src = author.protected ? process.env.DEFAULT_ICON : author.profile_image_url;
    await new Promise((resolve) => { iconImg.onload = resolve });
    devlog(author);
    const text = tweet.text.replaceAll("\n", " ");
    new SpachaImage(ctx, {
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
    const homeTimeline = await client.v2.homeTimeline({ exclude: ['replies', "retweets"], max_results: 100, expansions: ["author_id"], "user.fields": ["name", "profile_image_url", "id", "protected", "username"] });
    const tweets = homeTimeline.tweets.filter(v => v.author_id !== process.env.BOT_ID)
    devlog(tweets);
    devlog(homeTimeline.rateLimit);
    const tweet = tweets[getRandomInt(0, tweets.length)];
    devlog(tweet);
    if (!tweet) {
        process.exit(0);
    }
    const spachaBuf = await generateSpacha(tweet, homeTimeline.includes.author(tweet));

    const mediaId = await client.v1.uploadMedia(spachaBuf, { mimeType: EUploadMimeType.Png });

    await client.v2.tweet({ media: { media_ids: [mediaId] } });
    await client.v2.like(process.env.BOT_ID, tweet.id);
})();