
// Intro Video Logic
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('intro-overlay');
    const video = document.getElementById('intro-video');
    const skipBtn = document.getElementById('skip-btn');

    // Pause main page animations initially
    pauseMainAnimations();

    if (!overlay || !video) {
        startMainAnimations();
        return;
    }

    const muteBtn = document.getElementById('mute-btn');
    const muteIcon = document.getElementById('mute-icon');
    const muteText = document.getElementById('mute-text');

    // Function to hide overlay
    const hideIntro = () => {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            // Start main page animations here
            startMainAnimations();
        }, 500);
    };

    // Auto hide when video ends
    video.addEventListener('ended', hideIntro);

    // Skip button
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            video.pause();
            hideIntro();
        });
    }

    // Mute/Unmute toggle
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            video.muted = !video.muted;
            if (video.muted) {
                muteIcon.innerText = '🔇';
                muteText.innerText = 'Muted';
            } else {
                muteIcon.innerText = '🔊';
                muteText.innerText = 'Sound On';
            }
        });
    }

    // Fallback: If video fails to load or play (e.g. mobile autoplay restrictions), hide after 3 seconds
    video.addEventListener('error', hideIntro);

    // [CRITICAL] Force muted for initial autoplay success
    video.muted = true;
    muteIcon.innerText = '🔇';
    muteText.innerText = 'Muted (Auto)';

    // Ensure video plays
    video.play().catch(e => {
        console.log("Autoplay failed even with muted:", e);
        hideIntro();
    });
});

function pauseMainAnimations() {
    // Add logic to pause animations if possible, or just accept they might start playing behind
    // Since CSS animations start on load, we might need to add a class to body to prevent them
    document.body.classList.add('loading');
}

function startMainAnimations() {
    document.body.classList.remove('loading');
    // Trigger any JS-based animations
    // Example: If using Swiper autoplay, start it here if it was paused

    // Dispath event so index.js can catch it if needed
    window.dispatchEvent(new Event('introComplete'));
}
