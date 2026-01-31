/**
 * Company Page Specific Scripts
 */
document.addEventListener('DOMContentLoaded', function () {
    // Dynamic Year Calculation for "Who We Are" section
    const establishedYear = 2002;
    const currentYear = new Date().getFullYear();
    const years = currentYear - establishedYear;

    const recordEl = document.getElementById('years-of-record');
    if (recordEl) {
        recordEl.textContent = years;
    }
});
