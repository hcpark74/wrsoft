/**
 * WRSoft Common Include Script
 * Loads header and footer dynamically
 */

async function includeHTML() {
    const elements = document.querySelectorAll('[data-include]');
    
    for (const el of elements) {
        const file = el.getAttribute('data-include');
        if (file) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    const content = await response.text();
                    el.innerHTML = content;
                    el.removeAttribute('data-include');
                } else {
                    console.error('Failed to load:', file);
                }
            } catch (err) {
                console.error('Error fetching:', file, err);
            }
        }
    }

    // Trigger an event so other scripts know components are ready
    window.dispatchEvent(new CustomEvent('componentsLoaded'));
}

document.addEventListener('DOMContentLoaded', includeHTML);
