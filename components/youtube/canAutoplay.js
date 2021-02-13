/**
 * Based on https://github.com/video-dev/can-autoplay
 *
 * Test a <video> element for autoplay support by attempting to programmatically play a video.
 *
 * Video data used is the WEBM file from https://github.com/mathiasbynens/small/ due to its small size.
 * At the time of writing, desktop Safari still doesn't support WEBM, so the code makes a specific
 * exception for this error type.
 *
 * User-agent sniffing is used for iOS devices, short circuiting the feature detection. It is well
 * known that iOS devices don't allow preloading or autoplaying for a variety of reasons and it's
 * very unlikely that will change. iPads seem to be flakey on the feature detection check, causing
 * a poor UX, so a short circuit with a good feature detection fallback seems reasonable.
 *
 * Apple's docs for reference:
 * https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html#//apple_ref/doc/uid/TP40009523-CH5-SW1
 */
let timeoutId;
let sendOutput;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const element = document.createElement('video');
element.src = 'data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aGFtbXlXQUAGd2hhbW15RIlACECPQAAAAAAAFlSua0AxrkAu14EBY8WBAZyBACK1nEADdW5khkAFVl9WUDglhohAA1ZQOIOBAeBABrCBCLqBCB9DtnVAIueBAKNAHIEAAIAwAQCdASoIAAgAAUAmJaQAA3AA/vz0AAA=';
element.muted = true;
element.setAttribute('muted', 'muted');
let outputCache;

export default () => new Promise(resolve => {
    sendOutput = (result) => {
        outputCache = result;
        clearTimeout(timeoutId);
        resolve(result);
    }
    if (typeof outputCache === 'boolean') return sendOutput(outputCache);
    if (isIOS) return sendOutput(false);
    const playResult = element.play();
    timeoutId = setTimeout(() => {
        sendOutput(false)
    }, 250);

    if (playResult !== undefined) {
        playResult
            .then(() => sendOutput(true))
            .catch(playError => playError.name !== 'NotSupportedError' ? sendOutput(false) : sendOutput(true));
    } else {
        sendOutput(true);
    }
});