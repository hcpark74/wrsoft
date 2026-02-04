
// Intro Video Logic
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('intro-overlay');
    const video = document.getElementById('intro-video');
    const skipBtn = document.getElementById('skip-btn');
    const startGate = document.getElementById('start-gate');
    const enterBtn = document.getElementById('enter-btn');
    const gateSkipBtn = document.getElementById('gate-skip-btn');
    const muteBtn = document.getElementById('mute-btn');
    const muteIcon = document.getElementById('mute-icon');
    const muteText = document.getElementById('mute-text');

    // Pause main page animations initially
    pauseMainAnimations();

    if (!overlay || !video) {
        startMainAnimations();
        return;
    }

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

    // Enter Button (Start Experience)
    if (enterBtn) {
        enterBtn.addEventListener('click', () => {
            // User interaction happened -> sound is allowed
            video.muted = false;
            video.play().catch(e => {
                console.log("Play failed after interaction:", e);
                // Last resort fallback
                video.muted = true;
                video.play();
            });

            // Fade out gate
            if (startGate) {
                startGate.style.opacity = '0';
                setTimeout(() => {
                    startGate.style.display = 'none';
                }, 500);
            }

            if (muteIcon) muteIcon.innerText = '🔊';
            if (muteText) muteText.innerText = 'Sound On';
        });
    }

    // Gate Skip Button
    if (gateSkipBtn) {
        gateSkipBtn.addEventListener('click', () => {
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

    // Smart Autoplay Logic: Try unmuted play, if failed show gate
    const trySmartAutoPlay = () => {
        video.muted = false; // Target: sound on
        video.play()
            .then(() => {
                // Success! Browser allowed it.
                if (muteIcon) muteIcon.innerText = '🔊';
                if (muteText) muteText.innerText = 'Sound On';
            })
            .catch(err => {
                // Fail! Browser blocked it. Show gate for interaction.
                console.log("Autoplay with sound blocked. Showing interaction gate.");
                if (startGate) startGate.style.display = 'flex';
            });
    };

    // Execute smart autoplay attempt
    trySmartAutoPlay();

    // Fallback: If video fails to load
    video.addEventListener('error', hideIntro);
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
