const btn = document.getElementById('navToggle');
const nav = document.querySelector('header nav');

btn.addEventListener('click', () => {
    nav.classList.toggle('nav-open');
    btn.classList.toggle('is-open');
    document.body.classList.toggle('nav-lock');
});

nav.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
        nav.classList.remove('nav-open');
        btn.classList.remove('is-open');
        document.body.classList.remove('nav-lock');
    })
);
