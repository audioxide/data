import canAutoplay from './canAutoplay';

class YouTubeVideo extends HTMLElement {
    static get observedAttributes() {
        return ['video-id', 'ratio', 'fullscreen'];
    }
    constructor() {
        super();
        this.clickHandler = (e) => {
            e.preventDefault();
            this.attachPlayer(true);
        };
        this.addEventListener('click', this.clickHandler, false);
        // Mobile browsers protect users from autoplaying videos, which is great! But it breaks our element
        // As a compromise, only load the YouTube player when it scrolls into view
        this.observer = new IntersectionObserver(([entry]) => {
            if (entry.intersectionRatio > 0) {
                canAutoplay().then((result) => {
                    if (result === true) return;
                    this.attachPlayer(false);
                });
            }
        });
        this.observer.observe(this);
    }

    attachPlayer(autoplay) {
        const videoId = this.getAttribute('video-id');
        const playsinline = this.getAttribute('fullscreen') === "false";
        const shadow = this.attachShadow({ mode: 'open' });

        const frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${Number(autoplay)}&playsinline=${Number(playsinline)}&modestbranding=1`;
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
        this.stopWatching();
    }

    stopWatching() {
        this.removeEventListener('click', this.clickHandler);
        this.observer.disconnect();
    }
}

customElements.define('youtube-video', YouTubeVideo);