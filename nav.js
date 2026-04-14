/* ── Mobile hamburger menu ─────────────────────────────── */
(function () {
    const btn = document.getElementById('navToggle');
    const nav = document.querySelector('header nav');
    if (!btn || !nav) return;

    btn.addEventListener('click', function () {
        const open = nav.classList.toggle('nav-open');
        btn.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open);
        document.body.classList.toggle('nav-lock', open);
    });

    /* close on any nav link click */
    nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', close);
    });

    /* close on backdrop click (outside the nav panel) */
    nav.addEventListener('click', function (e) {
        if (e.target === nav) close();
    });

    function close() {
        nav.classList.remove('nav-open');
        btn.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-lock');
    }
})();
