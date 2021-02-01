
class YouTubeVideo extends HTMLElement {
    static get observedAttributes() {
        return ['video-id', 'ratio'];
    }

    constructor() {
        super();
        this.addEventListener('click', (e) => {
            let ratioMultiplier = 0.5625; // 16:9;
            const ratio = this.getAttribute('ratio');
            if (typeof ratio === 'string') {
                const [denominator, numerator] = ratio.split(':');
                const userMultiplier = Number(numerator) / Number(denominator);
                if (Number.isFinite(userMultiplier)) {
                    ratioMultiplier = userMultiplier;
                }
            }

            const videoId = this.getAttribute('video-id');
            e.preventDefault();
            const shadow = this.attachShadow({ mode: 'open' });

            const frame = document.createElement('iframe');
            frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1`;
            frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            frame.setAttribute('allowfullscreen', '');
            frame.setAttribute('frameborder', 0);
            frame.width = 560;
            frame.height = 560 * ratioMultiplier;

            shadow.appendChild(frame);
        }, false);
    }
}

customElements.define('youtube-video', YouTubeVideo);