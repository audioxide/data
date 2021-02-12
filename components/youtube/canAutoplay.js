/**
 * Based on https://github.com/video-dev/can-autoplay
 *
 * Test a <video> element for autoplay support by attempting to programmatically play a video.
 *
 * Video data used is the WEBM file from https://github.com/mathiasbynens/small/ due to its small size.
 * At the time of writing, Safari still doesn't support WEBM, so the code makes a specific exception
 * for this error type.
 */
const VIDEO = new Blob([new Uint8Array([26,69,223,163,64,32,66,134,129,1,66,247,129,1,66,242,129,4,66,243,129,8,66,130,64,4,119,101,98,109,66,135,129,2,66,133,129,2,24,83,128,103,64,141,21,73,169,102,64,40,42,215,177,64,3,15,66,64,77,128,64,6,119,104,97,109,109,121,87,65,64,6,119,104,97,109,109,121,68,137,64,8,64,143,64,0,0,0,0,0,22,84,174,107,64,49,174,64,46,215,129,1,99,197,129,1,156,129,0,34,181,156,64,3,117,110,100,134,64,5,86,95,86,80,56,37,134,136,64,3,86,80,56,131,129,1,224,64,6,176,129,8,186,129,8,31,67,182,117,64,34,231,129,0,163,64,28,129,0,0,128,48,1,0,157,1,42,8,0,8,0,1,64,38,37,164,0,3,112,0,254,252,244,0,0])], {type: 'video/webm'});

let playResult;
let timeoutId;
let sendOutput;

const element = document.createElement('video');
element.src = URL.createObjectURL(VIDEO);

export default new Promise(resolve => {
    playResult = element.play();
    timeoutId = setTimeout(() => {
    sendOutput(false, new Error(`Timeout ${timeout} ms has been reached`))
    }, 250);
    sendOutput = (result, error = null) => {
    clearTimeout(timeoutId);
    resolve({result, error});
    }

    if (playResult !== undefined) {
    playResult
        .then(() => sendOutput(true))
        .catch(playError => playError.name !== 'NotSupportedError' ? sendOutput(false, playError) : sendOutput(true));
    } else {
    sendOutput(true);
    }
});