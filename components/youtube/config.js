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
    html: ({ videoId, desc, ratio }) => `<${tagName} video-id="${videoId}" ratio="${ratio || '16:9'}">
        <a href="${externalHost(videoId)}">
            <img src="${imageSrc(videoId)}" alt="${text(desc)}" />
        </a>
    </${tagName}>`,
};