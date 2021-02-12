const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

class YouTubeVideo extends HTMLElement {
    static get observedAttributes() {
        return ['video-id', 'ratio'];
    }

    constructor() {
        super();
        this.isAttached = false;
        this.addEventListener('click', () => this.attachPlayer(true), false);
        if (isIOS()) {
            // iOS protects users from autoplaying videos, which is great! But it breaks our element
            // As a compromise, only load the YouTube player when it scrolls into view
            const observer = new IntersectionObserver(([entry]) => {
                if (entry.intersectionRatio > 0) {
                    this.attachPlayer(false);
                    observer.disconnect();
                }
            });
            observer.observe(this);
        }
    }

    attachPlayer(autoplay) {
        if (this.isAttached) return;
        const videoId = this.getAttribute('video-id');
        const playsinline = Number(this.getAttribute('fullscreen') === "false");
        e.preventDefault();
        const shadow = this.attachShadow({ mode: 'open' });

        const frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${Number(autoplay)}&playsinline=${playsinline}&modestbranding=1`;
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
        this.isAttached = true;
    }
}

customElements.define('youtube-video', YouTubeVideo);