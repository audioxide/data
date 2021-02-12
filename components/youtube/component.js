
class YouTubeVideo extends HTMLElement {
    static get observedAttributes() {
        return ['video-id', 'ratio'];
    }

    constructor() {
        super();
        this.addEventListener('click', (e) => {
            const videoId = this.getAttribute('video-id');
            const playsinline = Number(this.getAttribute('fullscreen') === "false")
            e.preventDefault();
            const shadow = this.attachShadow({ mode: 'open' });

            const frame = document.createElement('iframe');
            frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=${playsinline}&modestbranding=1`;
            frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            frame.setAttribute('allowfullscreen', '');
            frame.setAttribute('frameborder', 0);
            Object.assign(frame.style, {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 0,
            });

            shadow.appendChild(frame);
        }, false);
    }
}

customElements.define('youtube-video', YouTubeVideo);