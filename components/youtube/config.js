const tagName = 'youtube-video';
const text = (desc) => `YouTube video: ${desc}`;
const imageSrc = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
const externalHost = (id) => `https://www.youtube.com/watch?v=${id}`;

module.exports = {
    tagName,
    text,
    image: (id, desc) => ({
        src: imageSrc(id),
        alt: text(desc),
    }),
    externalHost,
    html: ({
        videoId,
        desc,
        ratio = "16:9",
        tone = "light",
    }) => `<${tagName} video-id="${videoId}" ratio="${ratio}" tone="${tone}">
        <a href="${externalHost(videoId)}">
            <img src="${imageSrc(videoId)}" alt="${text(desc)}" />
        </a>
    </${tagName}>`,
};